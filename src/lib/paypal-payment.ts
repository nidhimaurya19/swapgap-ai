/** Shared, server-side checks for PayPal Sandbox top-ups. */

export type VerifiedTopUp = {
  agreementId: string;
  version: number;
  payerId: string;
  amountCents: number;
};

type AgreementRow = Record<string, unknown>;

export class PaymentFlowError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "PaymentFlowError";
  }
}

function firstPresent(row: AgreementRow, keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function requiredBoolean(row: AgreementRow, keys: string[]) {
  const raw = firstPresent(row, keys);
  return raw === true; // fail closed: a missing approval is NOT approval
}

function cents(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return NaN;
  const value = Number(raw);
  const rounded = Math.round(value * 100);
  if (!Number.isFinite(value) || rounded < 0 || rounded > 1_000_000 || Math.abs(value * 100 - rounded) > 0.00001) {
    return NaN;
  }
  return rounded;
}

/** Rejects stale/unapproved agreements and determines amount/payer ONLY from database fields. */
export function verifyAgreementTopUp(row: AgreementRow, userId: string): VerifiedTopUp {
  const agreementId = String(row.id ?? "");
  const userAId = String(row.user_a_id ?? "");
  const userBId = String(row.user_b_id ?? "");
  if (!agreementId || !userAId || !userBId || userAId === userBId) {
    throw new PaymentFlowError("Agreement participants are invalid.");
  }
  if (userId !== userAId && userId !== userBId) {
    throw new PaymentFlowError("You are not a participant in this agreement.", 403);
  }
  const version = Number(firstPresent(row, ["proposal_version", "version", "current_version"]));
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new PaymentFlowError("Could not verify the current agreement version.");
  }
  const aVersion = firstPresent(row, [
    "approved_a_version", "user_a_approved_version", "approved_version_a", "a_approved_version",
    "user_a_approval_version", "approval_a_version", "approval_version_a",
  ]);
  const bVersion = firstPresent(row, [
    "approved_b_version", "user_b_approved_version", "approved_version_b", "b_approved_version",
    "user_b_approval_version", "approval_b_version", "approval_version_b",
  ]);
  // Some supported agreement schemas store current-version approvals as integers
  // rather than boolean flags. In either case, fail closed if approval isn't provable.
  const aApproved = requiredBoolean(row, ["user_a_approved", "approved_a", "a_approved"]) ||
    (aVersion !== undefined && Number(aVersion) === version);
  const bApproved = requiredBoolean(row, ["user_b_approved", "approved_b", "b_approved"]) ||
    (bVersion !== undefined && Number(bVersion) === version);
  if (String(row.status ?? "").toLowerCase() !== "approved" || !aApproved || !bApproved) {
    throw new PaymentFlowError("Both participants must approve the current proposal before checkout.");
  }
  if ((aVersion !== undefined && Number(aVersion) !== version) ||
      (bVersion !== undefined && Number(bVersion) !== version)) {
    throw new PaymentFlowError("Agreement approvals are stale for the current proposal version.");
  }
  const valueA = cents(row.value_a);
  const valueB = cents(row.value_b);
  if (!Number.isSafeInteger(valueA) || !Number.isSafeInteger(valueB)) {
    throw new PaymentFlowError("Agreement service values are invalid.");
  }
  const amountCents = Math.abs(valueA - valueB);
  if (amountCents === 0) throw new PaymentFlowError("Pure barter requires no PayPal checkout.");
  const payerId = valueA > valueB ? userBId : userAId;
  if (userId !== payerId) {
    throw new PaymentFlowError("Only the participant owing the top-up may pay.", 403);
  }
  return { agreementId, version, payerId, amountCents };
}

export function verifyPaymentRecord(
  payment: Record<string, unknown> | null,
  terms: VerifiedTopUp,
): asserts payment is Record<string, unknown> {
  if (!payment) throw new PaymentFlowError("No payment order exists for this agreement. Start checkout first.", 404);
  if (payment.payer_id !== terms.payerId || payment.currency !== "USD" ||
    cents(payment.amount_usd) !== terms.amountCents) {
    throw new PaymentFlowError("Payment record does not match the approved agreement. Review it before retrying.", 409);
  }
}

export function toSafeError(error: unknown) {
  return error instanceof PaymentFlowError
    ? { error: error.message, status: error.status }
    : { error: error instanceof Error ? error.message : "PayPal Sandbox request failed.", status: 500 };
}
