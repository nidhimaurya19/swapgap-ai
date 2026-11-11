import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { capturePayPalOrder, getPayPalOrder, verifyCapture, verifyOrderForAgreement } from "@/lib/paypal";
import { PaymentFlowError, toSafeError, verifyAgreementTopUp, verifyPaymentRecord } from "@/lib/paypal-payment";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new PaymentFlowError("Please sign in to complete the Sandbox checkout.", 401);
    const body = (await request.json()) as { agreementId?: unknown; orderId?: unknown };
    const agreementId = body.agreementId;
    if (typeof agreementId !== "string" || !/^[a-f0-9-]{36}$/i.test(agreementId)) {
      throw new PaymentFlowError("Invalid agreement ID.");
    }
    const { data: agreement, error: agreementError } = await supabase
      .from("swap_agreements").select("*").eq("id", agreementId).single();
    if (agreementError || !agreement) throw new PaymentFlowError("Agreement not found.", 404);
    const terms = verifyAgreementTopUp(agreement as Record<string, unknown>, user.id);
    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin.from("swap_payments")
      .select("*").eq("agreement_id", agreementId).maybeSingle();
    if (paymentError) throw new Error("Could not verify the payment record.");
    verifyPaymentRecord(payment as Record<string, unknown> | null, terms);
    if (payment.status === "completed" && payment.paypal_capture_id) {
      return NextResponse.json({ success: true, captureId: payment.paypal_capture_id, amount: terms.amountCents / 100 });
    }
    if (!payment.paypal_order_id || payment.status !== "order_created") {
      throw new PaymentFlowError("No active PayPal Sandbox order is available for capture.", 409);
    }
    const orderId = String(payment.paypal_order_id);
    // Browser-supplied token is only a correlation check. Server chooses the persisted ID.
    if (body.orderId !== undefined && body.orderId !== orderId) {
      throw new PaymentFlowError("Returned PayPal token does not match the saved order.", 400);
    }

    const existingOrder = await getPayPalOrder(orderId);
    verifyOrderForAgreement(existingOrder, orderId, agreementId, terms.amountCents);
    if (existingOrder.status === "APPROVED") {
      await capturePayPalOrder(orderId);
    } else if (existingOrder.status !== "COMPLETED") {
      throw new PaymentFlowError(`PayPal order is ${existingOrder.status}. Buyer has not approved a capturable checkout. No payment was recorded.`, 409);
    }
    // Always re-fetch the canonical order before trusting capture details.
    const capturedOrder = await getPayPalOrder(orderId);
    const verified = verifyCapture(capturedOrder, orderId, agreementId, terms.amountCents);
    const { data: updated, error: updateError } = await admin.from("swap_payments")
      .update({
        status: "completed",
        paypal_capture_id: verified.captureId,
        completed_at: new Date().toISOString(), // required by completed_payment_verified CHECK
        updated_at: new Date().toISOString(),
      })
      .eq("agreement_id", agreementId)
      .eq("paypal_order_id", orderId)
      .eq("payer_id", user.id)
      .eq("status", "order_created")
      .select("paypal_capture_id");
    if (updateError || !updated?.length) {
      throw new Error("PayPal Sandbox capture verified, but database sync failed. Do not retry checkout; use Check Order Status to reconcile.");
    }
    return NextResponse.json({ success: true, captureId: verified.captureId, amount: verified.amount, currency: "USD" });
  } catch (error) {
    const safe = toSafeError(error);
    if (safe.status === 500) console.error("[PayPal capture]", safe.error);
    return NextResponse.json({ error: safe.error }, { status: safe.status });
  }
}
