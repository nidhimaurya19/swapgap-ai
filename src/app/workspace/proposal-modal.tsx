"use client";

import { useState, useTransition, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeTopUp } from "./swap-types";

type ProposalModalProps = {
  myListingId: string;
  candidateListingId: string;
  myOffer: string;
  candidateOffer: string;
  initialValueA?: number;
  initialValueB?: number;
  initialDeliverablesA?: string;
  initialDeliverablesB?: string;
  candidateOwnerName?: string;
  onClose: () => void;
  onSuccess: (agreementId: string) => void;
};

export function ProposalModal({
  myListingId,
  candidateListingId,
  myOffer,
  candidateOffer,
  initialValueA = 100,
  initialValueB = 100,
  initialDeliverablesA = "",
  initialDeliverablesB = "",
  candidateOwnerName = "Swap Partner",
  onClose,
  onSuccess,
}: ProposalModalProps) {
  const [valueA, setValueA] = useState<number>(initialValueA || 100);
  const [valueB, setValueB] = useState<number>(initialValueB || 100);
  const [deliverablesA, setDeliverablesA] = useState<string>(initialDeliverablesA);
  const [deliverablesB, setDeliverablesB] = useState<string>(initialDeliverablesB);
  const [deadlineA, setDeadlineA] = useState<string>("");
  const [deadlineB, setDeadlineB] = useState<string>("");

  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isSubmitting, startSubmit] = useTransition();

  const topUp = computeTopUp(valueA, valueB, "You", candidateOwnerName, true);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!myListingId || !candidateListingId) {
      setErrorMessage("Both listings are required to propose a swap.");
      return;
    }

    if (myListingId.startsWith("demo-") || candidateListingId.startsWith("demo-")) {
      setErrorMessage("Proposals require published listings from real members in Supabase. Select a real user listing to proceed.");
      return;
    }

    if (!Number.isFinite(valueA) || valueA < 1 || valueA > 10000) {
      setErrorMessage("Enter a valid service value for your offer ($1 - $10,000).");
      return;
    }

    if (!Number.isFinite(valueB) || valueB < 1 || valueB > 10000) {
      setErrorMessage("Enter a valid service value for partner's offer ($1 - $10,000).");
      return;
    }

    if (!deliverablesA.trim() || deliverablesA.trim().length < 5) {
      setErrorMessage("Specify your deliverables clearly (at least 5 characters).");
      return;
    }

    if (!deliverablesB.trim() || deliverablesB.trim().length < 5) {
      setErrorMessage("Specify partner's expected deliverables clearly (at least 5 characters).");
      return;
    }

    startSubmit(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("create_swap_proposal", {
          p_listing_a_id: myListingId,
          p_listing_b_id: candidateListingId,
          p_value_a: valueA,
          p_value_b: valueB,
          p_deliverables_a: deliverablesA.trim(),
          p_deliverables_b: deliverablesB.trim(),
          p_deadline_a: deadlineA ? deadlineA : null,
          p_deadline_b: deadlineB ? deadlineB : null,
        });

        if (error) {
          console.error("[SwapGap] create_swap_proposal failed:", error);
          setErrorMessage(error.message || "Failed to create swap proposal. Please check your inputs.");
          return;
        }

        const agreementId = typeof data === "string" ? data : String(data ?? "");
        onSuccess(agreementId);
      } catch (err) {
        console.error("[SwapGap] Unexpected error creating proposal:", err);
        setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
      }
    });
  }

  return (
    <div className="ws-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="proposal-modal-title">
      <div className="ws-proposal-modal">
        <div className="ws-proposal-modal-header">
          <div>
            <span className="ws-eyebrow">BILATERAL SWAP PROPOSAL</span>
            <h2 id="proposal-modal-title">Propose Exchange Terms</h2>
            <p>Define clear scope, values, and optional deadlines. Both you and {candidateOwnerName} must approve the exact terms before an agreement is formed.</p>
          </div>
          <button type="button" className="ws-icon-btn" onClick={onClose} aria-label="Close proposal form" disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="ws-proposal-form">
          <div className="ws-proposal-grid">
            {/* User A (You) Column */}
            <div className="ws-proposal-party-card">
              <div className="ws-party-card-head">
                <span className="ws-party-badge">YOU OFFER (PARTY A)</span>
                <h3>{myOffer}</h3>
              </div>

              <label className="ws-field-label">
                <span>Agreed Service Value (USD) *</span>
                <div className="ws-input-prefix">
                  <span>$</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={valueA}
                    onChange={(e) => setValueA(Number(e.target.value))}
                    required
                  />
                </div>
              </label>

              <label className="ws-field-label">
                <span>Your Specific Deliverables *</span>
                <textarea
                  rows={4}
                  value={deliverablesA}
                  onChange={(e) => setDeliverablesA(e.target.value)}
                  placeholder="Detail the deliverables, formats, and scope you will produce..."
                  required
                />
              </label>

              <label className="ws-field-label">
                <span>Your Completion Deadline (optional)</span>
                <input
                  type="date"
                  value={deadlineA}
                  onChange={(e) => setDeadlineA(e.target.value)}
                />
              </label>
            </div>

            {/* User B (Partner) Column */}
            <div className="ws-proposal-party-card">
              <div className="ws-party-card-head">
                <span className="ws-party-badge ws-party-badge-partner">{candidateOwnerName.toUpperCase()} OFFERS (PARTY B)</span>
                <h3>{candidateOffer}</h3>
              </div>

              <label className="ws-field-label">
                <span>Agreed Service Value (USD) *</span>
                <div className="ws-input-prefix">
                  <span>$</span>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    step="1"
                    value={valueB}
                    onChange={(e) => setValueB(Number(e.target.value))}
                    required
                  />
                </div>
              </label>

              <label className="ws-field-label">
                <span>Partner&apos;s Specific Deliverables *</span>
                <textarea
                  rows={4}
                  value={deliverablesB}
                  onChange={(e) => setDeliverablesB(e.target.value)}
                  placeholder="Detail what partner will deliver in return..."
                  required
                />
              </label>

              <label className="ws-field-label">
                <span>Partner&apos;s Completion Deadline (optional)</span>
                <input
                  type="date"
                  value={deadlineB}
                  onChange={(e) => setDeadlineB(e.target.value)}
                />
              </label>
            </div>
          </div>

          {/* Deterministic Cash Top-Up Callout */}
          <div className="ws-topup-callout" aria-live="polite">
            <div className="ws-topup-header">
              <span className="ws-topup-badge">PROPOSED CASH TOP-UP (DETERMINISTIC)</span>
              <strong className="ws-topup-amount">
                {topUp.cashDifference === 0 ? "$0 (Pure Barter)" : `$${topUp.cashDifference}`}
              </strong>
            </div>
            <p className="ws-topup-text">{topUp.summaryText}</p>
            <small className="ws-topup-note">
              Deterministic calculation: Difference between ${valueA} and ${valueB}. No funds move until both users approve and checkout is initiated.
            </small>
          </div>

          {errorMessage && (
            <p className="ws-match-status ws-match-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="ws-proposal-footer">
            <span className="ws-proposal-footnote">Creates Version 1 in Supabase swap_agreements.</span>
            <div className="ws-proposal-btns">
              <button type="button" className="ws-btn ws-btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="ws-btn ws-btn-lime" disabled={isSubmitting}>
                {isSubmitting ? "Creating proposal in database..." : "Submit Swap Proposal"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
