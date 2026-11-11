"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "../theme-toggle";
import { LogoutButton } from "../logout-button";
import { AiMatchStudio } from "./ai-match-studio";
import { ProposalModal } from "./proposal-modal";
import { SwapsView } from "./swaps-view";
import { parseAgreement, type NormalizedSwapAgreement, type SkillCategory, type SwapPaymentRecord } from "./swap-types";
import type { AiMatch } from "./match-actions";

type SkillListing = {
  id: string;
  owner: string;
  isMine: boolean;
  offer: string;
  need: string;
  category: SkillCategory;
  value: number;
  description: string;
};
type View = "overview" | "marketplace" | "swaps";

const CATEGORIES: SkillCategory[] = ["Design", "Development", "Writing", "Marketing", "Video", "Business"];
const SAMPLE_LISTINGS: SkillListing[] = [
  { id: "demo-aarav", owner: "Aarav", isMine: false, offer: "Logo & Brand Identity", need: "Website copywriting", category: "Design", value: 100, description: "A memorable logo and a compact brand starter kit for your next big idea." },
  { id: "demo-sara", owner: "Sara", isMine: false, offer: "Website Copywriting", need: "Logo & brand identity", category: "Writing", value: 85, description: "Warm, concise landing-page copy that makes your product easier to understand." },
  { id: "demo-mira", owner: "Mira", isMine: false, offer: "UX Audit & Wireframes", need: "SEO content strategy", category: "Design", value: 130, description: "Actionable UX suggestions and low-fidelity wireframes for two key screens." },
  { id: "demo-kabir", owner: "Kabir", isMine: false, offer: "React Landing Page", need: "Investor pitch deck", category: "Development", value: 180, description: "A responsive frontend landing page built from an agreed design brief." },
  { id: "demo-zoya", owner: "Zoya", isMine: false, offer: "Pitch Deck Design", need: "React components", category: "Business", value: 120, description: "A sharp presentation layout for your startup story and product narrative." },
  { id: "demo-neha", owner: "Neha", isMine: false, offer: "Social Media Strategy", need: "Product video editing", category: "Marketing", value: 110, description: "A two-week content plan, posting ideas, and an audience-first messaging guide." },
];

type DatabaseListing = {
  id: string;
  owner_id: string;
  offer: string;
  need: string;
  category: string;
  value: number;
  description: string;
};

function money(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

function Icon({ name, size = 19 }: { name: "arrow" | "exchange" | "grid" | "search" | "plus" | "spark" | "check" | "close" | "trash" | "filter"; size?: number }) {
  const path: Record<typeof name, ReactNode> = {
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    exchange: <><path d="M4 8h16m-5-4 5 4-5 4M20 16H4m5-4-5 4 5 4" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" /></>,
    check: <><path d="m5 12 5 5L20 7" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    trash: <><path d="M4 7h16M10 3h4M7 7l1 14h8l1-14M10 11v6m4-6v6" /></>,
    filter: <><path d="M4 7h16M7 12h10M10 17h4" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{path[name]}</svg>;
}

function AppBrand() {
  return <span className="ws-brand"><span className="ws-brand-icon"><Icon name="exchange" size={19} /></span><span>swapgap<span className="ws-brand-accent">.ai</span></span></span>;
}

export default function WorkspaceClient() {
  const [remoteListings, setRemoteListings] = useState<SkillListing[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [agreements, setAgreements] = useState<NormalizedSwapAgreement[]>([]);
  const [isLoadingSwaps, setIsLoadingSwaps] = useState(false);
  const [swapsError, setSwapsError] = useState("");

  const [proposalTarget, setProposalTarget] = useState<{
    myListingId: string;
    candidateListingId: string;
    myOffer: string;
    candidateOffer: string;
    initialValueA?: number;
    initialValueB?: number;
    initialDeliverablesA?: string;
    initialDeliverablesB?: string;
    candidateOwnerName?: string;
  } | null>(null);

  const [view, setView] = useState<View>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("paypal_action")) return "swaps";
    }
    return "overview";
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All skills");
  const [onlyMine, setOnlyMine] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const action = p.get("paypal_action");
      if (action === "return") {
        return "Verifying PayPal Sandbox transaction with server...";
      }
      if (action === "cancel") {
        return "PayPal Sandbox checkout was cancelled. You can retry payment when ready.";
      }
    }
    return "";
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const listings = useMemo(() => [...remoteListings, ...SAMPLE_LISTINGS], [remoteListings]);
  const ownListings = useMemo(() => remoteListings.filter((item) => item.isMine), [remoteListings]);

  const loadAgreements = useCallback(async (currentUid?: string) => {
    const targetUid = currentUid || userId;
    if (!targetUid) return;
    setIsLoadingSwaps(true);
    setSwapsError("");
    try {
      const supabase = createClient();
      const { data: rawAgreements, error: aggError } = await supabase
        .from("swap_agreements")
        .select("*")
        .order("created_at", { ascending: false });

      if (aggError) {
        console.error("[SwapGap] Swap agreements load failed:", aggError.message);
        setSwapsError("Could not load swap agreements from Supabase: " + aggError.message);
        setIsLoadingSwaps(false);
        return;
      }

      const rows = (rawAgreements ?? []) as Record<string, unknown>[];
      if (rows.length === 0) {
        setAgreements([]);
        setIsLoadingSwaps(false);
        return;
      }

      const listingIds = Array.from(new Set(rows.flatMap((r) => [r.listing_a_id, r.listing_b_id]).filter(Boolean).map(String)));
      const { data: listingsData } = listingIds.length > 0
        ? await supabase.from("skill_listings").select("id,owner_id,offer,need,description,value").in("id", listingIds)
        : { data: [] as DatabaseListing[] };

      const listingsMap = new Map((listingsData ?? []).map((l) => [l.id, l]));

      const userIds = Array.from(new Set([
        ...rows.flatMap((r) => [r.user_a_id, r.user_b_id, r.party_a_id, r.party_b_id, r.creator_id]).filter(Boolean).map(String),
        ...(listingsData ?? []).map((l) => l.owner_id).filter(Boolean).map(String),
      ]));

      const { data: profilesData } = userIds.length > 0
        ? await supabase.from("profiles").select("id,display_name").in("id", userIds)
        : { data: [] as { id: string; display_name: string }[] };

      const profilesMap = new Map((profilesData ?? []).map((p) => [p.id, p.display_name]));

      const agreementIds = rows.map((r) => String(r.id)).filter(Boolean);
      let paymentsMap = new Map<string, SwapPaymentRecord>();
      if (agreementIds.length > 0) {
        try {
          const { data: paymentsData } = await supabase
            .from("swap_payments")
            .select("*")
            .in("agreement_id", agreementIds);

          if (paymentsData) {
            paymentsMap = new Map((paymentsData as SwapPaymentRecord[]).map((p) => [p.agreement_id, p]));
          }
        } catch (pErr) {
          console.warn("[SwapGap] swap_payments load warning:", pErr);
        }
      }

      const parsed = rows.map((r) => parseAgreement(r, targetUid, listingsMap, profilesMap, paymentsMap));
      setAgreements(parsed);
      setIsLoadingSwaps(false);
    } catch (err) {
      console.error("[SwapGap] Unexpected error loading agreements:", err);
      setSwapsError(err instanceof Error ? err.message : "Error loading agreements.");
      setIsLoadingSwaps(false);
    }
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function loadWorkspaceData() {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (!mounted) return;
      if (authError || !auth.user) {
        setLoadError("Your session could not be verified. Please sign in again.");
        setIsLoading(false);
        return;
      }
      const uid = auth.user.id;
      setUserId(uid);

      const { data, error } = await supabase
        .from("skill_listings")
        .select("id,owner_id,offer,need,category,value,description")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!mounted) return;
      if (error) {
        setLoadError("Could not load marketplace listings. Check your Supabase API permissions and RLS policies.");
        console.error("[SwapGap] Marketplace load failed:", error.message);
        setIsLoading(false);
        return;
      }

      const rows = (data ?? []) as DatabaseListing[];
      const ids = Array.from(new Set(rows.map((row) => row.owner_id)));
      const profiles = ids.length
        ? await supabase.from("profiles").select("id,display_name").in("id", ids)
        : { data: [] as { id: string; display_name: string }[] };

      if (!mounted) return;
      const ownerNames = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.display_name]));
      setRemoteListings(rows.map((row) => ({
        id: row.id,
        owner: row.owner_id === uid ? "You" : ownerNames.get(row.owner_id) || "SwapGap member",
        isMine: row.owner_id === uid,
        offer: row.offer,
        need: row.need,
        category: CATEGORIES.includes(row.category as SkillCategory) ? row.category as SkillCategory : "Business",
        value: Number(row.value),
        description: row.description,
      })));
      setIsLoading(false);

      void loadAgreements(uid);
    }

    void loadWorkspaceData();
    return () => { mounted = false; };
  }, [loadAgreements]);

  // Handle return or cancel redirects from PayPal Sandbox
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("paypal_action");
    const agreementId = params.get("agreement_id");
    const token = params.get("token"); // PayPal order ID

    if (action === "return" && agreementId && token) {
      // Clear URL parameters immediately to prevent repeated triggers on reload
      window.history.replaceState({}, "", window.location.pathname);

      fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agreementId, orderId: token }),
      })
        .then((res) => res.json())
        .then((data: { success?: boolean; amount?: number; error?: string }) => {
          if (!data.success) {
            throw new Error(data.error || "Capture verification failed.");
          }
          setNotice(`✓ PayPal Sandbox payment of $${data.amount} USD was successfully verified and completed!`);
          void loadAgreements();
        })
        .catch((err: unknown) => {
          console.error("[PayPal Return] Capture failed:", err);
          setNotice(`PayPal payment notice: ${err instanceof Error ? err.message : String(err)}`);
          void loadAgreements();
        });
    } else if (action === "cancel") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [loadAgreements]);

  const results = useMemo(() => listings.filter((item) => {
    if (onlyMine && !item.isMine) return false;
    if (category !== "All skills" && item.category !== category) return false;
    const content = `${item.owner} ${item.offer} ${item.need} ${item.description} ${item.category}`.toLowerCase();
    return content.includes(query.trim().toLowerCase());
  }), [listings, query, category, onlyMine]);

  function openCreate() {
    setView("marketplace");
    setShowForm(true);
    setNotice("");
  }

  function handleOpenProposalFromMatch(match: AiMatch) {
    const myListing = remoteListings.find((l) => l.id === match.myListingId);
    const candidateListing = remoteListings.find((l) => l.id === match.candidateListingId);

    setProposalTarget({
      myListingId: match.myListingId,
      candidateListingId: match.candidateListingId,
      myOffer: match.myOffer,
      candidateOffer: match.candidateOffer,
      initialValueA: myListing?.value || 100,
      initialValueB: candidateListing?.value || 100,
      initialDeliverablesA: myListing?.description || "",
      initialDeliverablesB: candidateListing?.description || "",
      candidateOwnerName: candidateListing?.owner || "Community member",
    });
  }

  function handleProposalCreated(agreementId: string) {
    setProposalTarget(null);
    setView("swaps");
    setNotice(`Swap proposal #${agreementId.slice(0, 8)} created successfully! Review the proposal below.`);
    void loadAgreements();
  }

  async function addListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const offer = String(data.get("offer") ?? "").trim();
    const need = String(data.get("need") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const chosenCategory = String(data.get("category") ?? "") as SkillCategory;
    const value = Number(data.get("value"));
    if (offer.length < 3 || need.length < 3 || !description || !CATEGORIES.includes(chosenCategory) ||
      !Number.isFinite(value) || value < 1 || value > 10000) {
      setNotice("Complete all fields with a valid service value between $1 and $10,000.");
      return;
    }
    if (!userId) {
      setNotice("Your session is not ready. Please sign in again.");
      return;
    }
    const supabase = createClient();
    const { data: row, error } = await supabase.from("skill_listings")
      .insert({ owner_id: userId, offer, need, description, category: chosenCategory, value, status: "published" })
      .select("id,offer,need,description,category,value")
      .single();
    if (error || !row) {
      console.error("[SwapGap] Listing save failed:", error?.message);
      setNotice("Could not save your listing. Please check the database connection and try again.");
      return;
    }
    setRemoteListings((items) => [{
      id: row.id,
      owner: "You",
      isMine: true,
      offer: row.offer,
      need: row.need,
      description: row.description,
      category: row.category as SkillCategory,
      value: Number(row.value),
    }, ...items]);
    form.reset();
    setShowForm(false);
    setOnlyMine(false);
    setCategory("All skills");
    setQuery("");
    setNotice("Your listing was published to the SwapGap database.");
  }

  async function removeListing(id: string) {
    const chosen = remoteListings.find((item) => item.id === id);
    if (!chosen?.isMine || !userId) return;
    if (!window.confirm("Delete this skill listing?")) return;
    const supabase = createClient();
    const { data, error } = await supabase.from("skill_listings")
      .delete().eq("id", id).eq("owner_id", userId).select("id");
    if (error || !data?.length) {
      console.error("[SwapGap] Listing delete failed:", error?.message);
      setNotice("Could not delete the listing. Please try again.");
      return;
    }
    setRemoteListings((items) => items.filter((item) => item.id !== id));
    setExpandedId(null);
    setNotice("Your listing was deleted from the SwapGap database.");
  }

  function goToMarketplace() { setView("marketplace"); setNotice(""); }

  const pendingSwapsCount = useMemo(() => agreements.filter((a) => a.status === "pending").length, [agreements]);

  return (
    <div className="ws-root">
      <aside className="ws-sidebar" aria-label="Workspace navigation">
        <Link href="/" className="ws-home-link" aria-label="Back to SwapGap AI homepage"><AppBrand /></Link>
        <span className="ws-demo-tag"><span /> WORKSPACE PREVIEW</span>
        <div className="ws-side-label">YOUR SPACE</div>
        <nav className="ws-side-nav" aria-label="Workspace sections">
          <button
            type="button"
            className={view === "overview" ? "ws-nav-item active" : "ws-nav-item"}
            aria-current={view === "overview" ? "page" : undefined}
            onClick={() => setView("overview")}
          >
            <Icon name="grid" /> Overview
          </button>
          <button
            type="button"
            className={view === "marketplace" ? "ws-nav-item active" : "ws-nav-item"}
            aria-current={view === "marketplace" ? "page" : undefined}
            onClick={goToMarketplace}
          >
            <Icon name="search" /> Skill marketplace <span className="ws-nav-count">{listings.length}</span>
          </button>
          <button
            type="button"
            className={view === "swaps" ? "ws-nav-item active" : "ws-nav-item"}
            aria-current={view === "swaps" ? "page" : undefined}
            onClick={() => { setView("swaps"); setNotice(""); }}
          >
            <Icon name="exchange" /> My Swaps
            {agreements.length > 0 && (
              <span className={`ws-nav-count ${pendingSwapsCount > 0 ? "ws-nav-count-alert" : ""}`}>
                {agreements.length}
              </span>
            )}
          </button>
        </nav>
        <div className="ws-side-bottom">
          <div className="ws-status-panel">
            <p className="ws-side-label">CURRENT BUILD</p>
            <strong>Bilateral Swap Agreements</strong>
            <span>Mutual proposals, counteroffers, and dual approvals backed by PostgreSQL RPCs.</span>
          </div>
          <Link href="/" className="ws-back-link">← Back to landing page</Link>
        </div>
      </aside>

      <div className="ws-main">
        <header className="ws-topbar">
          <div className="ws-breadcrumb">
            <span>SwapGap AI</span>
            <span className="ws-slash">/</span>
            <strong>{view === "overview" ? "Overview" : view === "marketplace" ? "Skill marketplace" : "My Swaps"}</strong>
          </div>
          <div className="ws-top-actions">
            <span className="ws-local-chip">{isLoading ? "Connecting..." : loadError ? "Database unavailable" : "Supabase connected"}</span>
            <ThemeToggle />
            <LogoutButton />
            <button className="ws-btn ws-btn-primary ws-add-top" type="button" onClick={openCreate}>
              <Icon name="plus" size={17} /> Add a skill
            </button>
          </div>
        </header>

        <main className="ws-content">
          {isLoading && <p className="ws-notice" role="status">Loading live marketplace listings...</p>}
          {loadError && <p className="ws-notice" role="alert">{loadError}</p>}
          {notice && <p className="ws-notice" role="status">{notice}</p>}

          {view === "overview" && (
            <>
              <div className="ws-page-intro">
                <div>
                  <p className="ws-eyebrow">WELCOME TO YOUR EXCHANGE SPACE</p>
                  <h1>Your skills open doors.</h1>
                  <p>Start with what you can offer. Find the expertise you need. Build something valuable together.</p>
                </div>
                <button className="ws-btn ws-btn-primary" type="button" onClick={openCreate}>
                  <Icon name="plus" /> List a skill
                </button>
              </div>

              <section className="ws-hero-panel" aria-label="Get started">
                <div className="ws-hero-text">
                  <span className="ws-hero-kicker"><Icon name="spark" size={15} /> THE NEW ECONOMY OF SKILLS</span>
                  <h2>Give your expertise a new exchange rate.</h2>
                  <p>Create your first listing, then discover what other people are bringing to the table.</p>
                  <button className="ws-btn ws-btn-lime" type="button" onClick={goToMarketplace}>
                    Explore the marketplace <Icon name="arrow" size={17} />
                  </button>
                </div>
                <div className="ws-hero-art" aria-hidden="true">
                  <div className="ws-art-card ws-art-card-a">
                    <span>YOU OFFER</span>
                    <strong>Your expertise</strong>
                    <small>Skills are valuable</small>
                  </div>
                  <span className="ws-art-exchange"><Icon name="exchange" size={27} /></span>
                  <div className="ws-art-card ws-art-card-b">
                    <span>YOU RECEIVE</span>
                    <strong>New possibilities</strong>
                    <small>Mutual opportunity</small>
                  </div>
                </div>
              </section>

              <AiMatchStudio onProposeSwap={handleOpenProposalFromMatch} />

              <section className="ws-overview-metrics" aria-label="Workspace summary">
                <div>
                  <span>My skill listings</span>
                  <strong>{ownListings.length.toString().padStart(2, "0")}</strong>
                  <small>Saved in Supabase</small>
                </div>
                <div>
                  <span>Community examples</span>
                  <strong>{listings.filter((item) => !item.isMine).length.toString().padStart(2, "0")}</strong>
                  <small>Community and demo profiles</small>
                </div>
                <div
                  style={{ cursor: "pointer" }}
                  onClick={() => setView("swaps")}
                  tabIndex={0}
                  role="button"
                  aria-label="View exchange agreements"
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setView("swaps"); }}
                >
                  <span>Exchange agreements</span>
                  <strong>{agreements.length > 0 ? agreements.length.toString().padStart(2, "0") : "00"}</strong>
                  <small>
                    {agreements.length > 0
                      ? `${agreements.filter((a) => a.status === "approved").length} approved · ${pendingSwapsCount} pending`
                      : "View in My Swaps"}
                  </small>
                </div>
              </section>

              <div className="ws-section-heading">
                <div>
                  <p className="ws-eyebrow">EXPLORE POSSIBILITIES</p>
                  <h2>Meet the skills in the room.</h2>
                </div>
                <button type="button" className="ws-inline-link" onClick={goToMarketplace}>
                  View all listings <Icon name="arrow" size={17} />
                </button>
              </div>

              <div className="ws-cards ws-overview-list">
                {listings.slice(0, 3).map((item) => (
                  <ListingCard
                    key={item.id}
                    listing={item}
                    expanded={expandedId === item.id}
                    onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    onRemove={removeListing}
                  />
                ))}
              </div>

              <p className="ws-demo-note">
                Real listings and swap agreements are saved in Supabase. Mutual proposals require approval from both parties.
              </p>
            </>
          )}

          {view === "marketplace" && (
            <>
              <div className="ws-page-intro">
                <div>
                  <p className="ws-eyebrow">DISCOVER & EXCHANGE</p>
                  <h1>Talent meets opportunity.</h1>
                  <p>Browse offers, discover complementary skills, or share something you&apos;re great at.</p>
                </div>
                <button className="ws-btn ws-btn-primary" type="button" onClick={openCreate}>
                  <Icon name="plus" /> Create listing
                </button>
              </div>

              <div className="ws-market-tools">
                <label className="ws-search">
                  <Icon name="search" />
                  <span className="ws-sr-only">Search skills</span>
                  <input
                    type="search"
                    placeholder="Search skills, people, or needs..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <label className="ws-filter">
                  <Icon name="filter" size={18} />
                  <span className="ws-sr-only">Filter by category</span>
                  <select value={category} onChange={(event) => setCategory(event.target.value)}>
                    <option>All skills</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                <label className="ws-my-filter">
                  <input type="checkbox" checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)} /> My listings only
                </label>
              </div>

              {showForm && (
                <section className="ws-create-panel" aria-label="Create skill listing">
                  <div className="ws-form-top">
                    <div>
                      <p className="ws-eyebrow">SHARE WHAT YOU KNOW</p>
                      <h2>Create a skill listing</h2>
                      <p>Your published listing will appear for signed-in members.</p>
                    </div>
                    <button className="ws-icon-btn" onClick={() => setShowForm(false)} type="button" aria-label="Close listing form">
                      <Icon name="close" />
                    </button>
                  </div>
                  <form className="ws-create-form" onSubmit={addListing}>
                    <label>
                      Skill you offer
                      <input name="offer" maxLength={70} placeholder="e.g. Brand identity design" required />
                    </label>
                    <label>
                      Skill you need
                      <input name="need" maxLength={70} placeholder="e.g. Website copywriting" required />
                    </label>
                    <label>
                      Category
                      <select name="category" defaultValue="" required>
                        <option value="" disabled>Choose a category</option>
                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                      </select>
                    </label>
                    <label>
                      Example service value (USD)
                      <input name="value" type="number" min="1" max="10000" step="1" placeholder="100" required />
                    </label>
                    <label className="ws-span-full">
                      What will you deliver?
                      <textarea name="description" maxLength={220} rows={3} placeholder="Briefly describe your service and its scope." required />
                    </label>
                    <div className="ws-form-actions">
                      <span>Example amount only — not a market-price estimate.</span>
                      <button className="ws-btn ws-btn-primary" type="submit">
                        <Icon name="check" size={17} /> Save my listing
                      </button>
                    </div>
                  </form>
                </section>
              )}

              <div className="ws-results-heading">
                <div>
                  <p className="ws-eyebrow">SKILL DISCOVERY</p>
                  <h2>{results.length} {results.length === 1 ? "listing" : "listings"} found</h2>
                </div>
                <span>Fictional examples + real published listings</span>
              </div>

              {results.length ? (
                <div className="ws-cards">
                  {results.map((item) => (
                    <ListingCard
                      key={item.id}
                      listing={item}
                      expanded={expandedId === item.id}
                      onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      onRemove={removeListing}
                    />
                  ))}
                </div>
              ) : (
                <div className="ws-empty">
                  <Icon name="search" size={32} />
                  <h3>No skills found yet</h3>
                  <p>Try another search or remove your filters.</p>
                  <button
                    type="button"
                    className="ws-btn ws-btn-secondary"
                    onClick={() => { setQuery(""); setCategory("All skills"); setOnlyMine(false); }}
                  >
                    Clear filters
                  </button>
                </div>
              )}

              <p className="ws-demo-note">
                Real listings are stored in Supabase and visible to signed-in members. Demo profiles are fictional.
              </p>
            </>
          )}

          {view === "swaps" && (
            <SwapsView
              agreements={agreements}
              isLoading={isLoadingSwaps}
              loadError={swapsError}
              onRefresh={loadAgreements}
              onExploreMarketplace={() => setView("overview")}
            />
          )}

          {/* Active Proposal Form Modal */}
          {proposalTarget && (
            <ProposalModal
              myListingId={proposalTarget.myListingId}
              candidateListingId={proposalTarget.candidateListingId}
              myOffer={proposalTarget.myOffer}
              candidateOffer={proposalTarget.candidateOffer}
              initialValueA={proposalTarget.initialValueA}
              initialValueB={proposalTarget.initialValueB}
              initialDeliverablesA={proposalTarget.initialDeliverablesA}
              initialDeliverablesB={proposalTarget.initialDeliverablesB}
              candidateOwnerName={proposalTarget.candidateOwnerName}
              onClose={() => setProposalTarget(null)}
              onSuccess={handleProposalCreated}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function ListingCard({ listing, expanded, onExpand, onRemove }: { listing: SkillListing; expanded: boolean; onExpand: () => void; onRemove: (id: string) => void }) {
  return (
    <article className="ws-listing">
      <div className="ws-listing-top">
        <span className="ws-person-avatar">{listing.owner.slice(0, 1).toUpperCase()}</span>
        <div>
          <strong>{listing.owner}</strong>
          <span>{listing.isMine ? "Your published listing" : listing.id.startsWith("demo-") ? "Fictional example" : "Community member"}</span>
        </div>
        <span className="ws-value">{money(listing.value)}</span>
      </div>
      <span className="ws-category">{listing.category}</span>
      <h3>{listing.offer}</h3>
      <p className="ws-need-label">LOOKING FOR</p>
      <p className="ws-need">{listing.need}</p>
      {expanded && (
        <div className="ws-detail">
          <strong>What&apos;s included</strong>
          <p>{listing.description}</p>
          <small>Listed amount is illustrative and requires mutual agreement in a future swap.</small>
        </div>
      )}
      <div className="ws-listing-actions">
        <button className="ws-card-btn" type="button" aria-expanded={expanded} onClick={onExpand}>
          {expanded ? "Hide details" : "View details"} <Icon name="arrow" size={15} />
        </button>
        {listing.isMine && (
          <button className="ws-delete" type="button" onClick={() => onRemove(listing.id)} aria-label={`Remove ${listing.offer} listing`}>
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
    </article>
  );
}
