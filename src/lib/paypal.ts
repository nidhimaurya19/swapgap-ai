/** PayPal Sandbox ONLY — all functions run on the server. */

const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";
let cachedToken: { token: string; expiresAt: number } | null = null;

function ensureSandbox() {
  if (process.env.PAYPAL_ENVIRONMENT !== "sandbox") {
    throw new Error("PayPal Sandbox integration is disabled: PAYPAL_ENVIRONMENT must equal sandbox.");
  }
}

export async function getPayPalAccessToken(): Promise<string> {
  ensureSandbox();
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing PayPal Sandbox credentials.");
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) return cachedToken.token;
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("[PayPal] Sandbox OAuth failed:", response.status);
    throw new Error(`PayPal Sandbox authentication failed (HTTP ${response.status}).`);
  }
  const result = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
  return result.access_token;
}

export type PayPalOrderResponse = {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method: string }>;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: { currency_code: string; value: string };
    payee?: { email_address?: string; merchant_id?: string };
    payments?: {
      captures?: Array<{
        id: string;
        status: string;
        amount?: { currency_code: string; value: string };
      }>;
    };
  }>;
};

type ApiError = { name?: string; message?: string; details?: Array<{ issue?: string; description?: string }> };

function paypalFailure(status: number, details: ApiError, operation: string) {
  const issue = details.details?.[0]?.issue || details.name || "UNKNOWN";
  // Show a safe short API issue, but never dump responses, credentials or auth headers.
  return new Error(`PayPal Sandbox ${operation} failed (HTTP ${status}: ${issue}). Check the Sandbox merchant's currency/receiving settings if checkout was blocked.`);
}

export function paypalApprovalUrl(order: PayPalOrderResponse) {
  const link = order.links?.find((item) => item.rel === "approve" || item.rel === "payer-action");
  if (!link?.href) return null;
  try {
    const url = new URL(link.href);
    return url.protocol === "https:" &&
      (url.hostname === "www.sandbox.paypal.com" || url.hostname === "sandbox.paypal.com")
      ? url.href : null;
  } catch {
    return null;
  }
}

export async function createPayPalOrder(params: {
  agreementId: string;
  version: number;
  amountCents: number;
  attempt?: number;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PayPalOrderResponse> {
  const token = await getPayPalAccessToken();
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      // Different archived attempts must not replay the expired original order.
      // The same pending attempt retains the same idempotency key on retries.
      "PayPal-Request-Id": `swapgap_${params.agreementId}_v${params.version}_a${params.attempt ?? 1}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: params.agreementId,
        custom_id: params.agreementId,
        description: `SwapGap AI Sandbox top-up ${params.agreementId.slice(0, 8)}`,
        amount: { currency_code: "USD", value: (params.amountCents / 100).toFixed(2) },
      }],
      application_context: {
        brand_name: "SwapGap AI (Sandbox)",
        user_action: "PAY_NOW",
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
    cache: "no-store",
  });
  const result = (await response.json()) as PayPalOrderResponse & ApiError;
  if (!response.ok || !result.id) throw paypalFailure(response.status, result, "create order");
  if (!paypalApprovalUrl(result)) throw new Error("PayPal order has no valid Sandbox approval link.");
  return result;
}

export async function getPayPalOrder(orderId: string): Promise<PayPalOrderResponse> {
  const token = await getPayPalAccessToken();
  if (!/^[A-Z0-9]{1,36}$/.test(orderId)) throw new Error("Invalid PayPal order ID.");
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const result = (await response.json()) as PayPalOrderResponse & ApiError;
  if (!response.ok) throw paypalFailure(response.status, result, "get order");
  return result;
}

export async function capturePayPalOrder(orderId: string): Promise<PayPalOrderResponse> {
  const token = await getPayPalAccessToken();
  if (!/^[A-Z0-9]{1,36}$/.test(orderId)) throw new Error("Invalid PayPal order ID.");
  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `swapgap_capture_${orderId}`,
    },
    body: "{}",
    cache: "no-store",
  });
  const result = (await response.json()) as PayPalOrderResponse & ApiError;
  if (!response.ok) {
    if (response.status === 422 && result.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
      return getPayPalOrder(orderId);
    }
    throw paypalFailure(response.status, result, "capture order");
  }
  return result;
}

export function verifyOrderForAgreement(
  order: PayPalOrderResponse, orderId: string, agreementId: string, amountCents: number,
): void {
  if (order.id !== orderId) throw new Error("PayPal order ID mismatch.");
  if (!order.purchase_units || order.purchase_units.length !== 1) {
    throw new Error("PayPal order must contain exactly one purchase unit.");
  }
  const unit = order.purchase_units[0];
  if (unit.reference_id !== agreementId || unit.custom_id !== agreementId) {
    throw new Error("PayPal order is not linked to the expected agreement.");
  }
  if (unit.amount?.currency_code !== "USD" || unit.amount.value !== (amountCents / 100).toFixed(2)) {
    throw new Error("PayPal order amount/currency does not match the approved top-up.");
  }
  // A business Sandbox app creates the order for its configured merchant. Optionally
  // pin that merchant ID, if supplied, to independently validate the recipient.
  const expectedMerchantId = process.env.PAYPAL_SANDBOX_MERCHANT_ID;
  if (expectedMerchantId && unit.payee?.merchant_id !== expectedMerchantId) {
    throw new Error("PayPal Sandbox merchant does not match the expected business account.");
  }
}

export function verifyCapture(
  order: PayPalOrderResponse, orderId: string, agreementId: string, amountCents: number,
): { captureId: string; amount: number } {
  verifyOrderForAgreement(order, orderId, agreementId, amountCents);
  if (order.status !== "COMPLETED") throw new Error(`PayPal order is ${order.status}, not COMPLETED.`);
  const captures = order.purchase_units?.[0]?.payments?.captures;
  if (!captures || captures.length !== 1) throw new Error("Exactly one PayPal capture is required.");
  const capture = captures[0];
  if (capture.status !== "COMPLETED" || !capture.id ||
      capture.amount?.currency_code !== "USD" ||
      capture.amount.value !== (amountCents / 100).toFixed(2)) {
    throw new Error("PayPal capture status/amount/currency failed verification.");
  }
  return { captureId: capture.id, amount: amountCents / 100 };
}
