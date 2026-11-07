"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { computeTopUp, type NormalizedSwapAgreement } from "./swap-types";

type SwapsViewProps = {
  agreements: NormalizedSwapAgreement[];
  isLoading: boolean;
  loadError: string;
  onRefresh: () => Promise<void>;
  onExploreMarketplace: () => void;
};

export function SwapsView({
  agreements,
  isLoading,
  loadError,
  onRefresh,
  onExploreMarketplace,
}: SwapsViewProps) {
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [activeCounterId, setActiveCounterId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>("");
  const [actionSuccess, setActionSuccess] = useState<string>("");

  const filtered = agreements.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  const pendingCount = agreements.filter((a) => a.status === "pending").length;
  const approvedCount = agreements.filter((a) => a.status === "approved").length;
  const rejectedCount = agreements.filter((a) => a.status === "rejected").length;

  return (
    <section className="ws-swaps-container" aria-labelledby="my-swaps-title">
      <div className="ws-page-intro">
        <div>
          <p className="ws-eyebrow">BILATERAL AGREEMENTS</p>
          <h1 id="my-swaps-title">My Swaps</h1>
          <p>
            Track real exchange proposals from Supabase. Review terms, submit counteroffers, and explicitly approve agreements.
          </p>
        </div>
        <button
          type="button"
          className="ws-btn ws-btn-secondary"
          onClick={() => {
            setActionError("");
            setActionSuccess("");
            void onRefresh();
          }}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing..." : "↻ Refresh Swaps"}
        </button>
      </div>

      {actionSuccess && (
        <p className="ws-notice ws-notice-success" role="status">
          {actionSuccess}
        </p>
      )}

      {actionError && (
        <p className="ws-match-status ws-match-error" role="alert">
          {actionError}
        </p>
      )}

      {loadError && (
        <p className="ws-match-status ws-match-error" role="alert">
          {loadError}
        </p>
      )}

      {/* Tabs */}
      <div className="ws-swaps-tabs">
        <button
          type="button"
          className={filter === "all" ? "ws-tab-btn active" : "ws-tab-btn"}
          onClick={() => setFilter("all")}
        >
          All Swaps <span className="ws-tab-count">{agreements.length}</span>
        </button>
        <button
          type="button"
          className={filter === "pending" ? "ws-tab-btn active" : "ws-tab-btn"}
          onClick={() => setFilter("pending")}
        >
          Pending <span className="ws-tab-count">{pendingCount}</span>
        </button>
        <button
          type="button"
          className={filter === "approved" ? "ws-tab-btn active" : "ws-tab-btn"}
          onClick={() => setFilter("approved")}
        >
          Approved <span className="ws-tab-count">{approvedCount}</span>
        </button>
        <button
          type="button"
          className={filter === "rejected" ? "ws-tab-btn active" : "ws-tab-btn"}
          onClick={() => setFilter("rejected")}
        >
          Rejected <span className="ws-tab-count">{rejectedCount}</span>
        </button>
      </div>

      {isLoading && (
        <p className="ws-notice" role="status">
          Loading bilateral swap agreements from database...
        </p>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="ws-empty">
          <h3>No {filter === "all" ? "" : filter} swap proposals found</h3>
          <p>
            {filter === "all"
              ? "You haven't initiated or received any bilateral swap proposals yet. Discover skills and propose a swap from AI Match Studio."
              : `There are currently no proposals in "${filter}" status.`}
          </p>
          <button type="button" className="ws-btn ws-btn-lime" onClick={onExploreMarketplace}>
            Explore Skills & Matches
          </button>
        </div>
      )}

      <div className="ws-swaps-list">
        {filtered.map((agreement) => (
          <AgreementCard
            key={agreement.id}
            agreement={agreement}
            isCountering={activeCounterId === agreement.id}
            onToggleCounter={() => {
              setActionError("");
              setActionSuccess("");
              setActiveCounterId(activeCounterId === agreement.id ? null : agreement.id);
            }}
            onCancelCounter={() => setActiveCounterId(null)}
            onActionSuccess={(msg) => {
              setActionError("");
              setActionSuccess(msg);
              setActiveCounterId(null);
              void onRefresh();
            }}
            onActionError={(err) => {
              setActionError(err);
              setActionSuccess("");
            }}
          />
        ))}
      </div>
    </section>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Flexible / No date";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

type AgreementCardProps = {
  agreement: NormalizedSwapAgreement;
  isCountering: boolean;
  onToggleCounter: () => void;
  onCancelCounter: () => void;
  onActionSuccess: (message: string) => void;
  onActionError: (error: string) => void;
};

function AgreementCard({
  agreement,
  isCountering,
  onToggleCounter,
  onCancelCounter,
  onActionSuccess,
  onActionError,
}: AgreementCardProps) {
  const [isPendingAction, startTransition] = useTransition();

  const isCurrentPartyA = agreement.isUserA;
  const topUp = computeTopUp(
    agreement.value_a,
    agreement.value_b,
    agreement.creatorName,
    agreement.partnerName,
    isCurrentPartyA
  );

  function handleApprove() {
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("approve_swap_proposal", {
          p_agreement_id: agreement.id,
          p_expected_version: agreement.version,
        });

        if (error) {
          console.error("[SwapGap] approve_swap_proposal error:", error);
          onActionError(error.message || "Failed to approve proposal.");
          return;
        }

        const returnedText = typeof data === "string" ? data : "";
        const isNowApproved = returnedText.toLowerCase().includes("approved") || agreement.partnerApproval;
        onActionSuccess(
          isNowApproved
            ? `Proposal approved! Both parties have approved version ${agreement.version}. Status is now Approved.`
            : `You have approved Version ${agreement.version}. Waiting for ${agreement.isUserA ? agreement.partnerName : agreement.creatorName} to approve.`
        );
      } catch (err) {
        onActionError(err instanceof Error ? err.message : "Error during approval.");
      }
    });
  }

  function handleReject() {
    if (!window.confirm(`Are you sure you want to decline this swap proposal (Version ${agreement.version})?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.rpc("reject_swap_proposal", {
          p_agreement_id: agreement.id,
          p_expected_version: agreement.version,
        });

        if (error) {
          console.error("[SwapGap] reject_swap_proposal error:", error);
          onActionError(error.message || "Failed to decline proposal.");
          return;
        }

        onActionSuccess(`Proposal Version ${agreement.version} has been rejected.`);
      } catch (err) {
        onActionError(err instanceof Error ? err.message : "Error during rejection.");
      }
    });
  }

  return (
    <article className={`ws-swap-card ws-swap-card-${agreement.status}`}>
      {/* Top Header */}
      <div className="ws-swap-card-top">
        <div className="ws-swap-id-group">
          <span className="ws-swap-badge-id">SWAP #{agreement.id.slice(0, 8)}</span>
          <span className="ws-swap-version-badge">Version {agreement.version}</span>
        </div>

        <div className="ws-swap-status-badge-container">
          {agreement.status === "approved" && (
            <span className="ws-badge ws-badge-approved">✓ Approved</span>
          )}
          {agreement.status === "rejected" && (
            <span className="ws-badge ws-badge-rejected">✕ Rejected</span>
          )}
          {agreement.status === "pending" && (
            <span className="ws-badge ws-badge-pending">
              {agreement.myApproval ? "⏳ Waiting for Partner" : "● Action Required"}
            </span>
          )}
        </div>
      </div>

      {/* Reciprocal Services Comparison */}
      <div className="ws-swap-services-grid">
        {/* Party A */}
        <div className={`ws-swap-party-box ${agreement.isUserA ? "ws-party-mine" : ""}`}>
          <div className="ws-party-title-row">
            <span className="ws-role-tag">CREATOR {agreement.isUserA ? "(YOU)" : ""}</span>
            <span className={`ws-approval-pill ${agreement.user_a_approved ? "approved" : "pending"}`}>
              {agreement.user_a_approved ? `✓ Approved (v${agreement.version})` : "⏳ Pending"}
            </span>
          </div>
          <h4>{agreement.offerA}</h4>
          <span className="ws-swap-party-owner">Owner: {agreement.creatorName}</span>

          <div className="ws-swap-details-block">
            <strong>Deliverables</strong>
            <p>{agreement.deliverables_a || "No specific deliverables specified."}</p>
          </div>

          <div className="ws-swap-meta-row">
            <div>
              <small>Agreed Value</small>
              <strong>${agreement.value_a}</strong>
            </div>
            <div>
              <small>Target Deadline</small>
              <span>{formatDate(agreement.deadline_a)}</span>
            </div>
          </div>
        </div>

        {/* Exchange Center Icon */}
        <div className="ws-swap-exchange-divider" aria-hidden="true">
          <span>↔</span>
        </div>

        {/* Party B */}
        <div className={`ws-swap-party-box ${agreement.isUserB ? "ws-party-mine" : ""}`}>
          <div className="ws-party-title-row">
            <span className="ws-role-tag">PARTNER {agreement.isUserB ? "(YOU)" : ""}</span>
            <span className={`ws-approval-pill ${agreement.user_b_approved ? "approved" : "pending"}`}>
              {agreement.user_b_approved ? `✓ Approved (v${agreement.version})` : "⏳ Pending"}
            </span>
          </div>
          <h4>{agreement.offerB}</h4>
          <span className="ws-swap-party-owner">Owner: {agreement.partnerName}</span>

          <div className="ws-swap-details-block">
            <strong>Deliverables</strong>
            <p>{agreement.deliverables_b || "No specific deliverables specified."}</p>
          </div>

          <div className="ws-swap-meta-row">
            <div>
              <small>Agreed Value</small>
              <strong>${agreement.value_b}</strong>
            </div>
            <div>
              <small>Target Deadline</small>
              <span>{formatDate(agreement.deadline_b)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settlement Callout */}
      <div className="ws-swap-settlement-bar">
        <div>
          <span className="ws-settlement-kicker">PROPOSED TOP-UP SETTLEMENT</span>
          <strong>{topUp.cashDifference === 0 ? "Pure Barter ($0)" : `$${topUp.cashDifference}`}</strong>
        </div>
        <p>{topUp.summaryText}</p>
      </div>

      {/* Banner for Finalized States */}
      {agreement.status === "approved" && (
        <div className="ws-agreement-banner ws-banner-approved">
          <strong>✓ Bilateral Agreement Finalized</strong>
          <p>
            Both participants have approved Version {agreement.version}. Deliverables and terms are mutually locked in.
            {topUp.cashDifference > 0 && ` Settlement of $${topUp.cashDifference} to be executed.`}
          </p>
        </div>
      )}

      {agreement.status === "rejected" && (
        <div className="ws-agreement-banner ws-banner-rejected">
          <strong>✕ Proposal Declined</strong>
          <p>This proposal was declined and is no longer active.</p>
        </div>
      )}

      {/* Action Buttons for Pending State */}
      {agreement.status === "pending" && !isCountering && (
        <div className="ws-swap-actions-row">
          <div className="ws-approval-info">
            {agreement.myApproval ? (
              <span className="ws-text-approved">✓ You have approved Version {agreement.version}. Waiting for counterparty.</span>
            ) : (
              <span className="ws-text-pending">Your approval is requested for Version {agreement.version}.</span>
            )}
          </div>

          <div className="ws-action-btn-group">
            {!agreement.myApproval && (
              <button
                type="button"
                className="ws-btn ws-btn-lime"
                onClick={handleApprove}
                disabled={isPendingAction}
              >
                {isPendingAction ? "Approving..." : `Approve Proposal (v${agreement.version})`}
              </button>
            )}

            <button
              type="button"
              className="ws-btn ws-btn-secondary"
              onClick={onToggleCounter}
              disabled={isPendingAction}
            >
              Counteroffer
            </button>

            <button
              type="button"
              className="ws-btn ws-btn-danger"
              onClick={handleReject}
              disabled={isPendingAction}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Inline Counteroffer Editing Form */}
      {isCountering && agreement.status === "pending" && (
        <CounterofferForm
          agreement={agreement}
          onCancel={onCancelCounter}
          onSuccess={onActionSuccess}
          onError={onActionError}
        />
      )}
    </article>
  );
}

type CounterofferFormProps = {
  agreement: NormalizedSwapAgreement;
  onCancel: () => void;
  onSuccess: (message: string) => void;
  onError: (error: string) => void;
};

function CounterofferForm({ agreement, onCancel, onSuccess, onError }: CounterofferFormProps) {
  const [valA, setValA] = useState<number>(agreement.value_a);
  const [valB, setValB] = useState<number>(agreement.value_b);
  const [delA, setDelA] = useState<string>(agreement.deliverables_a);
  const [delB, setDelB] = useState<string>(agreement.deliverables_b);
  const [deadA, setDeadA] = useState<string>(agreement.deadline_a || "");
  const [deadB, setDeadB] = useState<string>(agreement.deadline_b || "");
  const [isSubmitting, startSubmit] = useTransition();

  const previewTopUp = computeTopUp(
    valA,
    valB,
    agreement.creatorName,
    agreement.partnerName,
    agreement.isUserA
  );

  function handleSubmitCounter(e: React.FormEvent) {
    e.preventDefault();

    if (!Number.isFinite(valA) || valA < 1 || valA > 10000 || !Number.isFinite(valB) || valB < 1 || valB > 10000) {
      onError("Values must be numbers between $1 and $10,000.");
      return;
    }

    if (!delA.trim() || !delB.trim()) {
      onError("Deliverables cannot be blank.");
      return;
    }

    startSubmit(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("counter_swap_proposal", {
          p_agreement_id: agreement.id,
          p_expected_version: agreement.version,
          p_value_a: valA,
          p_value_b: valB,
          p_deliverables_a: delA.trim(),
          p_deliverables_b: delB.trim(),
          p_deadline_a: deadA || null,
          p_deadline_b: deadB || null,
        });

        if (error) {
          console.error("[SwapGap] counter_swap_proposal error:", error);
          onError(error.message || "Failed to submit counteroffer.");
          return;
        }

        const nextVersion = typeof data === "number" ? data : agreement.version + 1;
        onSuccess(`Counteroffer submitted! Proposal updated to Version ${nextVersion}. Approval state has been reset for review.`);
      } catch (err) {
        onError(err instanceof Error ? err.message : "Error submitting counteroffer.");
      }
    });
  }

  return (
    <form className="ws-counter-panel" onSubmit={handleSubmitCounter}>
      <div className="ws-counter-header">
        <div>
          <span className="ws-eyebrow">MAKE A COUNTEROFFER</span>
          <h4>Propose Revised Terms (for Version {agreement.version + 1})</h4>
          <p>Adjust deliverables, service values, or deadlines. Submitting will update the agreement to Version {agreement.version + 1} and reset approval state.</p>
        </div>
      </div>

      <div className="ws-counter-grid">
        {/* Creator Terms */}
        <div className="ws-counter-side">
          <span className="ws-party-badge">CREATOR TERMS ({agreement.creatorName.toUpperCase()})</span>
          <label>
            <span>Service Value (USD) *</span>
            <input
              type="number"
              min="1"
              max="10000"
              value={valA}
              onChange={(e) => setValA(Number(e.target.value))}
              required
            />
          </label>
          <label>
            <span>Deliverables *</span>
            <textarea
              rows={3}
              value={delA}
              onChange={(e) => setDelA(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Deadline (optional)</span>
            <input
              type="date"
              value={deadA}
              onChange={(e) => setDeadA(e.target.value)}
            />
          </label>
        </div>

        {/* Partner Terms */}
        <div className="ws-counter-side">
          <span className="ws-party-badge ws-party-badge-partner">PARTNER TERMS ({agreement.partnerName.toUpperCase()})</span>
          <label>
            <span>Service Value (USD) *</span>
            <input
              type="number"
              min="1"
              max="10000"
              value={valB}
              onChange={(e) => setValB(Number(e.target.value))}
              required
            />
          </label>
          <label>
            <span>Deliverables *</span>
            <textarea
              rows={3}
              value={delB}
              onChange={(e) => setDelB(e.target.value)}
              required
            />
          </label>
          <label>
            <span>Deadline (optional)</span>
            <input
              type="date"
              value={deadB}
              onChange={(e) => setDeadB(e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="ws-topup-callout ws-counter-callout">
        <span className="ws-topup-badge">NEW PROPOSED TOP-UP</span>
        <strong>{previewTopUp.cashDifference === 0 ? "$0 (Pure Barter)" : `$${previewTopUp.cashDifference}`}</strong>
        <p>{previewTopUp.summaryText}</p>
      </div>

      <div className="ws-counter-footer">
        <small>Passing expected version {agreement.version} to prevent race conditions.</small>
        <div className="ws-counter-btns">
          <button type="button" className="ws-btn ws-btn-secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="ws-btn ws-btn-lime" disabled={isSubmitting}>
            {isSubmitting ? "Submitting Counteroffer..." : `Submit Counteroffer (v${agreement.version + 1})`}
          </button>
        </div>
      </div>
    </form>
  );
}
