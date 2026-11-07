"use client";

import { useEffect, useState, useTransition } from "react";
import { exploreSwapOptions, findAiMatches, type AiMatch, type MatchResponse, type NegotiationResponse } from "./match-actions";

type AiMatchStudioProps = {
  onProposeSwap?: (match: AiMatch) => void;
};

export function AiMatchStudio({ onProposeSwap }: AiMatchStudioProps) {
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [negotiation, setNegotiation] = useState<{ key: string; response: NegotiationResponse } | null>(null);
  const [isNegotiating, startNegotiation] = useTransition();
  const [negotiationSeconds, setNegotiationSeconds] = useState(0);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = window.setInterval(() => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  useEffect(() => {
    if (negotiationSeconds <= 0) return;
    const timer = window.setInterval(() => setNegotiationSeconds((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [negotiationSeconds]);

  function findMatches() {
    startTransition(async () => {
      const nextResult = await findAiMatches();
      setResult(nextResult);
      if (nextResult.status === "matches" || nextResult.status === "no_matches") setSecondsRemaining(nextResult.cooldownSeconds);
      if (nextResult.status === "rate_limited" || nextResult.status === "api_limit") setSecondsRemaining(nextResult.retryAfterSeconds);
    });
  }

  function exploreOptions(myListingId: string, candidateListingId: string) {
    const key = `${myListingId}:${candidateListingId}`;
    startNegotiation(async () => {
      const response = await exploreSwapOptions(myListingId, candidateListingId);
      setNegotiation({ key, response });
      if (response.status === "options") setNegotiationSeconds(response.cooldownSeconds);
      if (response.status === "rate_limited" || response.status === "api_limit") setNegotiationSeconds(response.retryAfterSeconds ?? 0);
    });
  }

  return (
    <section className="ws-match-studio" aria-labelledby="ai-match-studio-title">
      <div className="ws-match-intro">
        <div><p className="ws-eyebrow">AI MATCH STUDIO</p><h2 id="ai-match-studio-title">Look for the reciprocal.</h2><p>We first narrow published listings locally, then ask Gemini to review only plausible two-way skill exchanges.</p></div>
        <button className="ws-btn ws-btn-lime" type="button" onClick={findMatches} disabled={isPending || secondsRemaining > 0}>
          <span aria-hidden="true">✦</span>{isPending ? "Reviewing published skills…" : secondsRemaining > 0 ? `Available in ${secondsRemaining}s` : "Find AI Matches"}
        </button>
      </div>

      {isPending && <p className="ws-match-status" role="status">Reviewing reciprocal service needs. No agreement or payment will be created.</p>}
      {result?.status === "error" && <p className="ws-match-status ws-match-error" role="alert">{result.message}</p>}
      {(result?.status === "rate_limited" || result?.status === "api_limit") && <p className="ws-match-status ws-match-warning" role="status">{result.message} Try again in about {result.retryAfterSeconds} seconds.</p>}
      {result?.status === "no_matches" && <p className="ws-match-status" role="status">{result.message}</p>}

      {result?.status === "matches" && <div className="ws-match-results">
        {result.matches.map((match) => <article className="ws-match-card" key={`${match.myListingId}:${match.candidateListingId}`}>
          <div className="ws-match-services"><div><span>YOU OFFER</span><strong>{match.myOffer}</strong><small>In return for: {match.myNeed}</small></div><span className="ws-match-exchange" aria-hidden="true">↔</span><div><span>THEY OFFER</span><strong>{match.candidateOffer}</strong><small>Looking for: {match.candidateNeed}</small></div></div>
          <p className="ws-match-explanation">{match.compatibilityExplanation}</p>
          {match.complementarySkills.length > 0 && <div className="ws-match-detail"><strong>Complementary skills</strong><ul>{match.complementarySkills.map((skill) => <li key={skill}>{skill}</li>)}</ul></div>}
          {match.potentialScopeConcerns.length > 0 && <div className="ws-match-detail"><strong>Scope to clarify</strong><ul>{match.potentialScopeConcerns.map((concern) => <li key={concern}>{concern}</li>)}</ul></div>}
          <div className="ws-match-next"><strong>Suggested next discussion</strong><p>{match.suggestedNextDiscussion}</p></div>
          <div className="ws-negotiation-action">
            <div className="ws-match-action-btns">
              <button className="ws-btn ws-btn-secondary" type="button" onClick={() => exploreOptions(match.myListingId, match.candidateListingId)} disabled={isNegotiating || negotiationSeconds > 0}>
                {isNegotiating ? "Exploring options…" : negotiationSeconds > 0 ? `Options available in ${negotiationSeconds}s` : "Explore Swap Options"}
              </button>
              {onProposeSwap && (
                <button className="ws-btn ws-btn-lime" type="button" onClick={() => onProposeSwap(match)}>
                  <span aria-hidden="true">✦</span> Create Swap Proposal
                </button>
              )}
            </div>
            <small>Nonbinding suggestions only — no agreement or payment is created until mutually approved.</small>
          </div>
          {negotiation?.key === `${match.myListingId}:${match.candidateListingId}` && (
            <NegotiationOptions
              response={negotiation.response}
              onProposeSwap={onProposeSwap ? () => onProposeSwap(match) : undefined}
            />
          )}
        </article>)}
      </div>}
    </section>
  );
}

function NegotiationOptions({
  response,
  onProposeSwap,
}: {
  response: NegotiationResponse;
  onProposeSwap?: () => void;
}) {
  if (response.status !== "options") return <p className={response.status === "error" ? "ws-match-status ws-match-error" : "ws-match-status"} role={response.status === "error" ? "alert" : "status"}>{response.message}</p>;
  const payerText = response.payer === "none" ? "No cash balance suggested" : response.payer === "you" ? "You would pay the community member" : "The community member would pay you";
  const options = [["A. Cash Balance", response.cashBalance], ["B. Scope Balance", response.scopeBalance], ["C. Pure Barter", response.pureBarter]] as const;
  return (
    <section className="ws-negotiation-options" aria-label="Nonbinding AI swap suggestions">
      <p className="ws-negotiation-note">Nonbinding AI suggestions. Service values are estimates, not agreed amounts.</p>
      <div className="ws-negotiation-values">
        <span><small>{response.myOffer}</small><strong>${response.myValue}</strong></span>
        <span><small>{response.candidateOffer}</small><strong>${response.candidateValue}</strong></span>
        <span><small>Cash difference</small><strong>${response.cashDifference}</strong><em>{payerText}</em></span>
      </div>
      {options.map(([title, option]) => (
        <article className="ws-negotiation-option" key={title}>
          <strong>{title}</strong>
          <p>{option.reasoning}</p>
          {option.scopeAssumptions.length > 0 && <small><b>Scope assumptions:</b> {option.scopeAssumptions.join(" · ")}</small>}
          {option.concerns.length > 0 && <small><b>Concerns:</b> {option.concerns.join(" · ")}</small>}
        </article>
      ))}
      {onProposeSwap && (
        <div className="ws-negotiation-create-bar">
          <div>
            <strong>Ready to formalize an agreement?</strong>
            <p>Customize specific deliverables and values into a verifiable bilateral proposal.</p>
          </div>
          <button className="ws-btn ws-btn-lime" type="button" onClick={onProposeSwap}>
            <span aria-hidden="true">✦</span> Create Swap Proposal
          </button>
        </div>
      )}
    </section>
  );
}
