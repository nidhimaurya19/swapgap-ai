"use client";

import { useEffect, useState, useTransition } from "react";
import { findAiMatches, type MatchResponse } from "./match-actions";

export function AiMatchStudio() {
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [isPending, startTransition] = useTransition();
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = window.setInterval(() => setSecondsRemaining((seconds) => Math.max(0, seconds - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [secondsRemaining]);

  function findMatches() {
    startTransition(async () => {
      const nextResult = await findAiMatches();
      setResult(nextResult);
      if (nextResult.status === "matches" || nextResult.status === "no_matches") setSecondsRemaining(nextResult.cooldownSeconds);
      if (nextResult.status === "rate_limited" || nextResult.status === "api_limit") setSecondsRemaining(nextResult.retryAfterSeconds);
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
        </article>)}
      </div>}
    </section>
  );
}
