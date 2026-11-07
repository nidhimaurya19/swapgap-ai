"use server";

import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const REQUEST_COOLDOWN_MS = 90_000;
const MAX_SHORTLISTED_PAIRS = 8;
const recentRequests = new Map<string, number>();
const recentNegotiations = new Map<string, number>();

type ListingRow = { id: string; owner_id: string; offer: string; need: string; description: string; category: string };
type CandidatePair = { mine: ListingRow; candidate: ListingRow; score: number };

export type AiMatch = {
  myListingId: string;
  candidateListingId: string;
  myOffer: string;
  myNeed: string;
  candidateOffer: string;
  candidateNeed: string;
  compatibilityExplanation: string;
  complementarySkills: string[];
  potentialScopeConcerns: string[];
  suggestedNextDiscussion: string;
};

export type MatchResponse =
  | { status: "matches"; matches: AiMatch[]; cooldownSeconds: number }
  | { status: "no_matches"; message: string; cooldownSeconds: number }
  | { status: "rate_limited"; message: string; retryAfterSeconds: number }
  | { status: "api_limit"; message: string; retryAfterSeconds: number }
  | { status: "error"; message: string };

type NegotiationOption = { reasoning: string; scopeAssumptions: string[]; concerns: string[] };
export type NegotiationResponse =
  | { status: "options"; myOffer: string; candidateOffer: string; myValue: number; candidateValue: number; cashDifference: number; payer: "you" | "member" | "none"; cashBalance: NegotiationOption; scopeBalance: NegotiationOption; pureBarter: NegotiationOption; cooldownSeconds: number }
  | { status: "empty" | "rate_limited" | "api_limit" | "error"; message: string; retryAfterSeconds?: number };

const AI_MATCH_SCHEMA = {
  type: "object",
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          my_listing_id: { type: "string" },
          candidate_listing_id: { type: "string" },
          compatibility_explanation: { type: "string" },
          complementary_skills: { type: "array", items: { type: "string" } },
          potential_scope_concerns: { type: "array", items: { type: "string" } },
          suggested_next_discussion: { type: "string" },
        },
        required: ["my_listing_id", "candidate_listing_id", "compatibility_explanation", "complementary_skills", "potential_scope_concerns", "suggested_next_discussion"],
      },
    },
  },
  required: ["matches"],
} as const;

const NEGOTIATION_SCHEMA = {
  type: "object",
  properties: {
    cash_balance: { type: "object", properties: { reasoning: { type: "string" }, scope_assumptions: { type: "array", items: { type: "string" } }, concerns: { type: "array", items: { type: "string" } } }, required: ["reasoning", "scope_assumptions", "concerns"] },
    scope_balance: { type: "object", properties: { reasoning: { type: "string" }, scope_assumptions: { type: "array", items: { type: "string" } }, concerns: { type: "array", items: { type: "string" } } }, required: ["reasoning", "scope_assumptions", "concerns"] },
    pure_barter: { type: "object", properties: { reasoning: { type: "string" }, scope_assumptions: { type: "array", items: { type: "string" } }, concerns: { type: "array", items: { type: "string" } } }, required: ["reasoning", "scope_assumptions", "concerns"] },
  },
  required: ["cash_balance", "scope_balance", "pure_barter"],
} as const;

const SYNONYM_GROUPS = [
  ["react", "next", "nextjs", "javascript", "typescript", "frontend", "front end", "web development", "web app"],
  ["ui", "ux", "ui ux", "ui/ux", "user interface", "user experience", "product design", "wireframe", "figma"],
  ["logo", "brand", "branding", "brand identity", "visual identity"],
  ["copy", "copywriting", "content", "writing", "website copy"],
  ["seo", "search engine", "content strategy"],
  ["video", "editing", "video editing", "motion"],
  ["marketing", "social media", "growth", "campaign"],
  ["pitch deck", "investor", "presentation", "business"],
];

function words(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((word) => word.length > 2));
}

function localSimilarity(offered: string, required: string) {
  const offeredWords = words(offered);
  const requiredWords = words(required);
  const sharedWords = [...offeredWords].filter((word) => requiredWords.has(word)).length;
  const lexicalScore = sharedWords / Math.max(1, Math.min(offeredWords.size, requiredWords.size));
  const offeredText = offered.toLowerCase();
  const requiredText = required.toLowerCase();
  const semanticSignal = SYNONYM_GROUPS.some((group) => group.some((phrase) => offeredText.includes(phrase)) && group.some((phrase) => requiredText.includes(phrase)));
  return Math.max(lexicalScore, semanticSignal ? 0.7 : 0);
}

function shortlistPairs(mine: ListingRow[], candidates: ListingRow[]) {
  const pairs: CandidatePair[] = [];
  for (const myListing of mine) {
    for (const candidateListing of candidates) {
      const myOfferMatchesTheirNeed = localSimilarity(`${myListing.offer} ${myListing.description}`, candidateListing.need);
      const theirOfferMatchesMyNeed = localSimilarity(`${candidateListing.offer} ${candidateListing.description}`, myListing.need);
      if (myOfferMatchesTheirNeed >= 0.25 && theirOfferMatchesMyNeed >= 0.25) {
        pairs.push({ mine: myListing, candidate: candidateListing, score: myOfferMatchesTheirNeed + theirOfferMatchesMyNeed });
      }
    }
  }
  return pairs.sort((left, right) => right.score - left.score).slice(0, MAX_SHORTLISTED_PAIRS);
}

function isListingRow(value: unknown): value is ListingRow {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return ["id", "owner_id", "offer", "need", "description", "category"].every((key) => typeof row[key] === "string");
}

function readableStrings(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, limit).map((item) => item.slice(0, 240));
}

function safeText(value: unknown, limit: number) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function promptText(value: string) {
  return value.trim().slice(0, 360);
}

function isApiLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b429\b|resource exhausted|rate limit|quota/i.test(message);
}

function optionFrom(value: unknown): NegotiationOption | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const reasoning = safeText(item.reasoning, 600);
  if (!reasoning) return null;
  return { reasoning, scopeAssumptions: readableStrings(item.scope_assumptions, 5), concerns: readableStrings(item.concerns, 5) };
}

export async function findAiMatches(): Promise<MatchResponse> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return { status: "error", message: "Your session could not be verified. Please sign in again." };

  const requestedAt = recentRequests.get(userId);
  const elapsed = requestedAt ? Date.now() - requestedAt : REQUEST_COOLDOWN_MS;
  if (elapsed < REQUEST_COOLDOWN_MS) {
    return { status: "rate_limited", message: "Please wait before requesting another AI match scan.", retryAfterSeconds: Math.ceil((REQUEST_COOLDOWN_MS - elapsed) / 1000) };
  }

  const { data, error } = await supabase.from("skill_listings")
    .select("id,owner_id,offer,need,description,category")
    .eq("status", "published")
    .limit(100);
  if (error) return { status: "error", message: "Published listings could not be loaded for matching. Please try again." };

  const listings = (data ?? []).filter(isListingRow);
  const mine = listings.filter((listing) => listing.owner_id === userId);
  const pairs = shortlistPairs(mine, listings.filter((listing) => listing.owner_id !== userId));
  if (!mine.length) return { status: "no_matches", message: "Publish a skill listing first, then ask AI to look for a reciprocal fit.", cooldownSeconds: 0 };
  if (!pairs.length) return { status: "no_matches", message: "No reciprocal opportunities were found among the current published listings.", cooldownSeconds: 0 };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { status: "error", message: "AI matching is not configured yet. Add the Gemini API key and try again." };
  recentRequests.set(userId, Date.now());

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
    const shortlist = pairs.map((pair) => ({
      my_listing_id: pair.mine.id,
      candidate_listing_id: pair.candidate.id,
      my_service: { offer: promptText(pair.mine.offer), description: promptText(pair.mine.description), need: promptText(pair.mine.need) },
      candidate_service: { offer: promptText(pair.candidate.offer), description: promptText(pair.candidate.description), need: promptText(pair.candidate.need) },
    }));
    const response = await ai.models.generateContent({
      model,
      contents: `Evaluate reciprocal service exchanges using only these shortlisted pairs. Return only genuinely reciprocal, practical matches. A match requires both directions: the first listing's offer serves the second listing's need, and the second listing's offer serves the first listing's need. Do not invent listings, people, services, outcomes, estimates, percentages, or agreements. Be concise and flag scope uncertainty. Return at most five matches.\n\n${JSON.stringify(shortlist)}`,
      config: { responseMimeType: "application/json", responseJsonSchema: AI_MATCH_SCHEMA, temperature: 0.2, maxOutputTokens: 1600 },
    });
    const parsed: unknown = response.text ? JSON.parse(response.text) : null;
    const modelMatches = parsed && typeof parsed === "object" && Array.isArray((parsed as { matches?: unknown }).matches)
      ? (parsed as { matches: unknown[] }).matches : [];
    const validPairs = new Map(pairs.map((pair) => [`${pair.mine.id}:${pair.candidate.id}`, pair]));
    const seen = new Set<string>();
    const matches = modelMatches.flatMap((modelMatch): AiMatch[] => {
      if (typeof modelMatch !== "object" || modelMatch === null) return [];
      const item = modelMatch as Record<string, unknown>;
      const myListingId = safeText(item.my_listing_id, 100);
      const candidateListingId = safeText(item.candidate_listing_id, 100);
      const key = `${myListingId}:${candidateListingId}`;
      const pair = validPairs.get(key);
      const compatibilityExplanation = safeText(item.compatibility_explanation, 600);
      const suggestedNextDiscussion = safeText(item.suggested_next_discussion, 400);
      if (!pair || seen.has(key) || !compatibilityExplanation || !suggestedNextDiscussion) return [];
      seen.add(key);
      return [{
        myListingId, candidateListingId, myOffer: pair.mine.offer, myNeed: pair.mine.need,
        candidateOffer: pair.candidate.offer, candidateNeed: pair.candidate.need,
        compatibilityExplanation, complementarySkills: readableStrings(item.complementary_skills, 5),
        potentialScopeConcerns: readableStrings(item.potential_scope_concerns, 5), suggestedNextDiscussion,
      }];
    });
    if (!matches.length) return { status: "no_matches", message: "AI did not confirm a reciprocal opportunity among the shortlisted listings.", cooldownSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) };
    return { status: "matches", matches, cooldownSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) };
  } catch (error) {
    if (isApiLimitError(error)) return { status: "api_limit", message: "Gemini’s free-tier request limit was reached. Please wait and try again.", retryAfterSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) };
    return { status: "error", message: "AI matching is temporarily unavailable. Please try again shortly." };
  }
}

export async function exploreSwapOptions(myListingId: string, candidateListingId: string): Promise<NegotiationResponse> {
  if (!myListingId || !candidateListingId || myListingId === candidateListingId) return { status: "empty", message: "This match no longer has two valid listings." };
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = typeof claimsData?.claims?.sub === "string" ? claimsData.claims.sub : null;
  if (!userId) return { status: "error", message: "Your session could not be verified. Please sign in again." };

  const requestedAt = recentNegotiations.get(userId);
  const elapsed = requestedAt ? Date.now() - requestedAt : REQUEST_COOLDOWN_MS;
  if (elapsed < REQUEST_COOLDOWN_MS) return { status: "rate_limited", message: "Please wait before requesting another swap suggestion.", retryAfterSeconds: Math.ceil((REQUEST_COOLDOWN_MS - elapsed) / 1000) };

  const { data, error } = await supabase.from("skill_listings")
    .select("id,owner_id,offer,need,description,value")
    .eq("status", "published")
    .in("id", [myListingId, candidateListingId]);
  if (error || !data || data.length !== 2) return { status: "empty", message: "One or both published listings are no longer available." };

  const mine = data.find((listing) => listing.id === myListingId && listing.owner_id === userId);
  const candidate = data.find((listing) => listing.id === candidateListingId && listing.owner_id !== userId);
  if (!mine || !candidate || typeof mine.value !== "number" || typeof candidate.value !== "number" || mine.value < 0 || candidate.value < 0) {
    return { status: "empty", message: "These listings cannot be used for a swap suggestion." };
  }

  const myValue = Number(mine.value);
  const candidateValue = Number(candidate.value);
  const cashDifference = Math.abs(myValue - candidateValue);
  const payer: "you" | "member" | "none" = myValue === candidateValue ? "none" : myValue > candidateValue ? "member" : "you";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { status: "error", message: "AI negotiation is not configured yet." };
  recentNegotiations.set(userId, Date.now());

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite",
      contents: `Suggest three nonbinding swap negotiation options for two reciprocal services. Do not calculate money, invent values, agreements, people, or deliverables. Explain only scope assumptions, tradeoffs, and questions to discuss. The deterministic values are supplied as context.\n\n${JSON.stringify({ my_service: { offer: promptText(mine.offer), description: promptText(mine.description), need: promptText(mine.need), estimated_value: myValue }, candidate_service: { offer: promptText(candidate.offer), description: promptText(candidate.description), need: promptText(candidate.need), estimated_value: candidateValue }, deterministic_cash_difference: cashDifference })}`,
      config: { responseMimeType: "application/json", responseJsonSchema: NEGOTIATION_SCHEMA, temperature: 0.25, maxOutputTokens: 1500 },
    });
    const parsed: unknown = response.text ? JSON.parse(response.text) : null;
    if (typeof parsed !== "object" || parsed === null) return { status: "empty", message: "AI did not return usable swap options." };
    const options = parsed as Record<string, unknown>;
    const cashBalance = optionFrom(options.cash_balance);
    const scopeBalance = optionFrom(options.scope_balance);
    const pureBarter = optionFrom(options.pure_barter);
    if (!cashBalance || !scopeBalance || !pureBarter) return { status: "empty", message: "AI did not return three usable swap options." };
    return { status: "options", myOffer: mine.offer, candidateOffer: candidate.offer, myValue, candidateValue, cashDifference, payer, cashBalance, scopeBalance, pureBarter, cooldownSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) };
  } catch (error) {
    if (isApiLimitError(error)) return { status: "api_limit", message: "Gemini’s free-tier request limit was reached. Please wait and try again.", retryAfterSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) };
    return { status: "error", message: "AI negotiation is temporarily unavailable. Please try again shortly." };
  }
}
