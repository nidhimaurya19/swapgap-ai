export type SkillCategory = "Design" | "Development" | "Writing" | "Marketing" | "Video" | "Business";

export type SwapPaymentRecord = {
  agreement_id: string;
  payer_id: string;
  amount_usd: number;
  currency: string;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  status: "pending" | "order_created" | "completed" | "failed";
  created_at?: string;
  updated_at?: string;
};

export type NormalizedSwapAgreement = {
  id: string;
  listing_a_id: string;
  listing_b_id: string;
  user_a_id: string;
  user_b_id: string;
  creatorName: string;
  partnerName: string;
  offerA: string;
  offerB: string;
  value_a: number;
  value_b: number;
  deliverables_a: string;
  deliverables_b: string;
  deadline_a: string | null;
  deadline_b: string | null;
  version: number;
  status: "pending" | "approved" | "rejected";
  user_a_approved: boolean;
  user_b_approved: boolean;
  isUserA: boolean;
  isUserB: boolean;
  myApproval: boolean;
  partnerApproval: boolean;
  created_at?: string;
  updated_at?: string;
  payment?: SwapPaymentRecord | null;
};

export type TopUpCalculation = {
  cashDifference: number;
  payer: "a" | "b" | "none";
  payerLabel: string;
  receiverLabel: string;
  summaryText: string;
};

/**
 * Deterministically computes the cash top-up difference between two service values.
 * Rule: If User A offers $120 and User B offers $100, User B pays User A $20, subject to mutual agreement.
 */
export function computeTopUp(
  valueA: number,
  valueB: number,
  partyAName: string = "Party A",
  partyBName: string = "Party B",
  isCurrentPartyA: boolean = false
): TopUpCalculation {
  const valA = Math.max(0, Number(valueA) || 0);
  const valB = Math.max(0, Number(valueB) || 0);
  const cashDifference = Math.abs(valA - valB);

  if (valA === valB) {
    return {
      cashDifference: 0,
      payer: "none",
      payerLabel: "None",
      receiverLabel: "None",
      summaryText: "Pure barter: Even exchange with $0 cash difference.",
    };
  }

  if (valA > valB) {
    // Service A is worth more. Party B pays Party A the difference.
    const payerLabel = isCurrentPartyA ? partyBName : (partyBName === "You" ? "You" : partyBName);
    const receiverLabel = isCurrentPartyA ? "You" : partyAName;
    return {
      cashDifference,
      payer: "b",
      payerLabel,
      receiverLabel,
      summaryText: `${payerLabel} pays ${receiverLabel} $${cashDifference} (subject to mutual agreement).`,
    };
  } else {
    // Service B is worth more. Party A pays Party B the difference.
    const payerLabel = isCurrentPartyA ? "You" : partyAName;
    const receiverLabel = isCurrentPartyA ? partyBName : (partyBName === "You" ? "You" : partyBName);
    return {
      cashDifference,
      payer: "a",
      payerLabel,
      receiverLabel,
      summaryText: `${payerLabel} pays ${receiverLabel} $${cashDifference} (subject to mutual agreement).`,
    };
  }
}

export function parseAgreement(
  row: Record<string, unknown>,
  currentUserId: string,
  listingsMap: Map<string, { id: string; owner_id: string; offer: string; need: string; description: string; value: number }>,
  profilesMap: Map<string, string>,
  paymentsMap?: Map<string, SwapPaymentRecord>
): NormalizedSwapAgreement {
  const id = String(row.id || "");
  const listing_a_id = String(row.listing_a_id || "");
  const listing_b_id = String(row.listing_b_id || "");

  const listingA = listingsMap.get(listing_a_id);
  const listingB = listingsMap.get(listing_b_id);

  const user_a_id = String(row.user_a_id || row.party_a_id || row.creator_id || row.user_a || listingA?.owner_id || "");
  const user_b_id = String(row.user_b_id || row.party_b_id || row.counterparty_id || row.user_b || listingB?.owner_id || "");

  const value_a = Number(row.value_a ?? listingA?.value ?? 0);
  const value_b = Number(row.value_b ?? listingB?.value ?? 0);

  const deliverables_a = String(row.deliverables_a || listingA?.description || "");
  const deliverables_b = String(row.deliverables_b || listingB?.description || "");

  const deadline_a = row.deadline_a ? String(row.deadline_a) : null;
  const deadline_b = row.deadline_b ? String(row.deadline_b) : null;

  const version = Number(row.version ?? row.proposal_version ?? row.current_version ?? 1);
  const rawStatus = String(row.status || "pending").toLowerCase();

  const user_a_approved = Boolean(
    row.user_a_approved ?? row.approved_a ?? row.a_approved ?? row.is_approved_a ?? row.party_a_approved ?? row.creator_approved ?? (rawStatus === "approved")
  );
  const user_b_approved = Boolean(
    row.user_b_approved ?? row.approved_b ?? row.b_approved ?? row.is_approved_b ?? row.party_b_approved ?? row.counterparty_approved ?? (rawStatus === "approved")
  );

  const status: "pending" | "approved" | "rejected" =
    rawStatus === "rejected"
      ? "rejected"
      : rawStatus === "approved" || (user_a_approved && user_b_approved)
      ? "approved"
      : "pending";

  const isUserA = currentUserId ? user_a_id === currentUserId : false;
  const isUserB = currentUserId ? user_b_id === currentUserId : false;

  const creatorName = isUserA
    ? "You"
    : profilesMap.get(user_a_id) || (user_a_id ? "Proposal Creator" : "Member");

  const partnerName = isUserB
    ? "You"
    : profilesMap.get(user_b_id) || (user_b_id ? "Swap Partner" : "Member");

  const myApproval = isUserA ? user_a_approved : isUserB ? user_b_approved : false;
  const partnerApproval = isUserA ? user_b_approved : isUserB ? user_a_approved : false;

  const offerA = listingA?.offer || (row.offer_a ? String(row.offer_a) : "Offered Service A");
  const offerB = listingB?.offer || (row.offer_b ? String(row.offer_b) : "Offered Service B");

  const payment = paymentsMap?.get(id) || null;

  return {
    id,
    listing_a_id,
    listing_b_id,
    user_a_id,
    user_b_id,
    creatorName,
    partnerName,
    offerA,
    offerB,
    value_a,
    value_b,
    deliverables_a,
    deliverables_b,
    deadline_a,
    deadline_b,
    version,
    status,
    user_a_approved,
    user_b_approved,
    isUserA,
    isUserB,
    myApproval,
    partnerApproval,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    payment,
  };
}
