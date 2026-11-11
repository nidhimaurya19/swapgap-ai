import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayPalOrder, verifyOrderForAgreement } from "@/lib/paypal";
import { PaymentFlowError, toSafeError, verifyAgreementTopUp, verifyPaymentRecord } from "@/lib/paypal-payment";

/** Read-only order status — no capture, no new order, no secrets sent to browser. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new PaymentFlowError("Please sign in.", 401);
    const agreementId = request.nextUrl.searchParams.get("agreementId");
    if (!agreementId || !/^[a-f0-9-]{36}$/i.test(agreementId)) {
      throw new PaymentFlowError("Invalid agreement ID.");
    }
    const { data: agreement, error: agreementError } = await supabase
      .from("swap_agreements").select("*").eq("id", agreementId).single();
    if (agreementError || !agreement) throw new PaymentFlowError("Agreement not found.", 404);
    const terms = verifyAgreementTopUp(agreement as Record<string, unknown>, user.id);
    const admin = createAdminClient();
    const { data: payment, error: paymentError } = await admin.from("swap_payments")
      .select("*").eq("agreement_id", agreementId).maybeSingle();
    if (paymentError) throw new Error("Could not load payment record.");
    verifyPaymentRecord(payment as Record<string, unknown> | null, terms);
    if (payment.status === "completed") {
      return NextResponse.json({ paymentStatus: "completed", orderStatus: "COMPLETED", canCapture: false });
    }
    if (!payment.paypal_order_id) throw new PaymentFlowError("Payment record has no PayPal order ID.", 409);
    const orderId = String(payment.paypal_order_id);
    const order = await getPayPalOrder(orderId);
    verifyOrderForAgreement(order, orderId, agreementId, terms.amountCents);
    return NextResponse.json({
      paymentStatus: payment.status,
      orderStatus: order.status,
      canCapture: order.status === "APPROVED" || order.status === "COMPLETED",
      // The checkout button uses create-order, which returns the existing approval URL.
    });
  } catch (error) {
    const safe = toSafeError(error);
    if (safe.status === 500) console.error("[PayPal order status]", safe.error);
    return NextResponse.json({ error: safe.error }, { status: safe.status });
  }
}
