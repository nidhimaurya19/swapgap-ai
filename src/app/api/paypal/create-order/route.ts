import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPayPalOrder, getPayPalOrder, paypalApprovalUrl, verifyOrderForAgreement } from "@/lib/paypal";
import { PaymentFlowError, toSafeError, verifyAgreementTopUp, verifyPaymentRecord } from "@/lib/paypal-payment";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new PaymentFlowError("Please sign in to use PayPal Sandbox.", 401);

    const body = (await request.json()) as { agreementId?: unknown };
    const agreementId = body.agreementId;
    if (typeof agreementId !== "string" || !/^[a-f0-9-]{36}$/i.test(agreementId)) {
      throw new PaymentFlowError("A valid agreement ID is required.");
    }
    const { data: agreement, error: agreementError } = await supabase
      .from("swap_agreements").select("*").eq("id", agreementId).single();
    if (agreementError || !agreement) throw new PaymentFlowError("Agreement not found or inaccessible.", 404);
    const terms = verifyAgreementTopUp(agreement as Record<string, unknown>, user.id);

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin.from("swap_payments")
      .select("*").eq("agreement_id", agreementId).maybeSingle();
    if (existingError) throw new Error("Could not check the existing payment record.");
    let resumedPendingId: string | null = null;
    let attempt = 1;
    if (existing) {
      verifyPaymentRecord(existing as Record<string, unknown>, terms);
      if (existing.status === "completed") {
        throw new PaymentFlowError("Sandbox payment is already completed.", 409);
      }
      // Never replace a possibly approved/captured order with a fresh one.
      if (existing.paypal_order_id) {
        // A 404 is NOT proof of nonpayment: wrong app/merchant permissions can
        // produce the same error. Never auto-replace or discard this order ID.
        let order: Awaited<ReturnType<typeof getPayPalOrder>>;
        try {
          order = await getPayPalOrder(String(existing.paypal_order_id));
        } catch {
          throw new PaymentFlowError(
            "The saved Sandbox order cannot be verified. Do NOT retry checkout yet. " +
            "Check the original Sandbox Business merchant's transaction activity " +
            "and API-app credentials; then use the reviewed manual recovery SQL if unpaid.",
            409,
          );
        }
        verifyOrderForAgreement(order, String(existing.paypal_order_id), agreementId, terms.amountCents);
        if (order.status === "APPROVED" || order.status === "COMPLETED") {
          return NextResponse.json({
            error: "Existing PayPal order is approved or captured. Check payment status and complete verification; do not start a new checkout.",
            orderStatus: order.status,
            code: "EXISTING_ORDER_READY_FOR_CAPTURE",
          }, { status: 409 });
        }
        if (order.status !== "CREATED" && order.status !== "PAYER_ACTION_REQUIRED" && order.status !== "SAVED") {
          throw new PaymentFlowError(`Existing PayPal order is ${order.status}. Review its status before starting another test.`, 409);
        }
        const approveUrl = paypalApprovalUrl(order);
        if (!approveUrl) throw new PaymentFlowError("Existing order has no valid checkout link. Check its status before retrying.", 409);
        return NextResponse.json({ success: true, orderId: order.id, approveUrl, reused: true });
      }
      // A stale/unavailable Sandbox order can only be cleared manually after
      // separately verifying no captured payment. Its ID is preserved in the
      // paypal_order_history audit column before the record becomes pending.
      if (existing.status !== "pending" || existing.paypal_capture_id) {
        throw new PaymentFlowError("An incomplete payment record exists. Review it before creating another order.", 409);
      }
      if (!Array.isArray(existing.paypal_order_history) || existing.paypal_order_history.length < 1 ||
          existing.paypal_order_history.some((item: unknown) =>
            !item || typeof item !== "object" ||
            typeof (item as { order_id?: unknown }).order_id !== "string")) {
        throw new PaymentFlowError("Pending payment has no valid archived order history. Recovery requires manual database review.", 409);
      }
      const recordId = existing.id;
      if (typeof recordId !== "string" || !/^[a-f0-9-]{36}$/i.test(recordId)) {
        throw new PaymentFlowError("Invalid pending payment record.", 409);
      }
      resumedPendingId = recordId;
      attempt = existing.paypal_order_history.length + 1;
    }

    const origin = request.nextUrl.origin;
    if (!origin.startsWith("https://") && !/^http:\/\/localhost(:\d+)?$/.test(origin)) {
      throw new PaymentFlowError("Checkout return URL must use HTTPS (or localhost for testing).", 400);
    }
    const returnUrl = `${origin}/workspace?paypal_action=return&agreement_id=${encodeURIComponent(agreementId)}`;
    const cancelUrl = `${origin}/workspace?paypal_action=cancel&agreement_id=${encodeURIComponent(agreementId)}`;
    const created = await createPayPalOrder({
      agreementId, version: terms.version, amountCents: terms.amountCents, returnUrl, cancelUrl, attempt,
    });
    // Create responses can be minimal. Read the full PayPal order before validating.
    const order = await getPayPalOrder(created.id);
    verifyOrderForAgreement(order, created.id, agreementId, terms.amountCents);
    const approveUrl = paypalApprovalUrl(order) || paypalApprovalUrl(created);
    if (!approveUrl) throw new Error("PayPal did not return a valid Sandbox approval link.");

    if (resumedPendingId) {
      // Conditional claim ensures two overlapping requests cannot replace one
      // another's saved order or overwrite a completed capture.
      const { data: claimed, error: claimError } = await admin.from("swap_payments")
        .update({
          paypal_order_id: order.id,
          status: "order_created",
          updated_at: new Date().toISOString(),
        })
        .eq("id", resumedPendingId)
        .eq("agreement_id", agreementId)
        .eq("payer_id", user.id)
        .eq("status", "pending")
        .is("paypal_order_id", null)
        .is("paypal_capture_id", null)
        .select("id")
        .maybeSingle();
      if (claimError || !claimed) {
        throw new PaymentFlowError("Another checkout attempt started. Refresh and check the saved order before retrying.", 409);
      }
    } else {
      // INSERT, never UPSERT: a concurrent request must not overwrite a completed order.
      const { error: insertError } = await admin.from("swap_payments").insert({
        agreement_id: agreementId,
        payer_id: user.id,
        amount_usd: terms.amountCents / 100,
        currency: "USD",
        paypal_order_id: order.id,
        status: "order_created",
      });
      if (insertError) {
        throw new PaymentFlowError("An order has already been created. Refresh the agreement and check payment status.", 409);
      }
    }
    return NextResponse.json({ success: true, orderId: order.id, approveUrl });
  } catch (error) {
    const safe = toSafeError(error);
    if (safe.status === 500) console.error("[PayPal create]", safe.error);
    return NextResponse.json({ error: safe.error }, { status: safe.status });
  }
}
