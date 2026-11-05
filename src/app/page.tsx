import { ThemeToggle } from "./theme-toggle";

const Arrow = () => <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="M4 16 16 4M7 4h9v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Exchange = () => <svg aria-hidden="true" viewBox="0 0 34 24" fill="none"><path d="M2 7h21m0 0-4-4m4 4-4 4M32 17H11m0 0 4-4m-4 4 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
function Brand() { return <span className="brand"><span className="brand-mark"><i /><b /></span>swapgap<span>.ai</span></span>; }
function Avatar({ initial, mint = false }: { initial: string; mint?: boolean }) { return <span className={mint ? "avatar avatar-mint" : "avatar"}>{initial}</span>; }

export default function Home() {
  return (
    <main>
      <nav className="site-nav shell" aria-label="Main navigation">
        <a href="#top" aria-label="SwapGap AI home"><Brand /></a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#why-swapgap">Why SwapGap</a>
          <a href="#example-swap">Example swap</a>
        </div>
        <div className="nav-actions">
          <ThemeToggle />
          <a className="nav-cta" href="#how-it-works">Explore SwapGap <Arrow /></a>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Open navigation"><span /><span /><span /></summary>
          <div>
            <ThemeToggle />
            <a href="#how-it-works">How it works</a><a href="#why-swapgap">Why SwapGap</a><a href="#example-swap">Example swap</a>
          </div>
        </details>
      </nav>

      <section id="top" className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">The new economy of skills</p>
          <h1>Your Skills<br />Are <em>Currency.</em></h1>
          <p className="hero-lead">Trade what you know. Get what you need.</p>
          <p className="hero-description">Find your reciprocal match, make a fair exchange, and settle only the difference when you both agree.</p>
          <div className="hero-buttons">
            <a className="button button-primary" href="#how-it-works">Explore how it works <Arrow /></a>
            <a className="button button-secondary" href="#example-swap">See a skill swap</a>
          </div>
          <p className="hero-note"><span /> Built for meaningful exchanges, not endless transactions.</p>
        </div>
        <ExchangeBoard />
      </section>

      <section id="how-it-works" className="journey-section">
        <div className="shell">
          <div className="section-heading split-heading">
            <div><p className="eyebrow">A clear path to yes</p><h2>From expertise to exchange, with intention.</h2></div>
            <p>A fair swap is more than a match. It is a shared understanding of what each person brings to the table.</p>
          </div>
          <div className="journey">
            <div className="journey-step journey-offer"><span>01</span><div className="journey-icon"><i /></div><h3>Offer skills</h3><p>Frame the expertise you have and the outcome you need.</p></div>
            <div className="journey-link"><Arrow /></div>
            <div className="journey-step journey-discover"><span>02</span><div className="journey-icon"><i /><i /></div><h3>Discover matches</h3><p>See where two ambitions align in both directions.</p></div>
            <div className="journey-link"><Arrow /></div>
            <div className="journey-step journey-negotiate"><span>03</span><div className="journey-icon">AI</div><h3>Negotiate</h3><p>Use a thoughtful proposal as the starting point.</p></div>
            <div className="journey-link"><Arrow /></div>
            <div className="journey-step journey-settle"><span>04</span><div className="journey-icon">$</div><h3>Settle</h3><p>Use PayPal only for the agreed gap.</p></div>
          </div>
        </div>
      </section>

      <section id="example-swap" className="proposal-section shell">
        <div className="proposal-intro"><p className="eyebrow">Proposal preview</p><h2>Value is easier to discuss when everyone can see it.</h2><p>This illustrative view gives both people a clear, mutual starting point before they decide anything.</p><a href="#why-swapgap" className="text-link">Why the exchange feels different <Arrow /></a></div>
        <ProposalPreview />
      </section>

      <section id="why-swapgap" className="benefits-section">
        <div className="shell"><div className="section-heading"><p className="eyebrow">Designed for reciprocity</p><h2>A marketplace built around the mutual win.</h2></div>
          <div className="bento-grid">
            <article className="bento matching"><div className="mini-network"><i /><i /><i /><svg viewBox="0 0 180 80" fill="none" aria-hidden="true"><path d="M17 53C56 2 77 76 111 36s42 5 51 1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" /></svg></div><p className="bento-kicker">01 / Mutual fit</p><h3>Mutual AI matching</h3><p>Discover people whose needs and strengths naturally meet yours.</p></article>
            <article className="bento negotiation"><div className="mini-sliders"><span /><span /><span /></div><p className="bento-kicker">02 / Shared context</p><h3>Smart negotiation</h3><p>Shape a proposal together instead of starting from zero.</p></article>
            <article className="bento agreement"><div className="mini-agreement"><span>✓</span><i /><i /><i /></div><p className="bento-kicker">03 / No surprises</p><h3>Transparent agreements</h3><p>Every contribution, value, and decision stays in view.</p></article>
            <article className="bento settlement"><div className="mini-settlement"><span>Cash difference</span><strong>$15</strong><i /></div><p className="bento-kicker">04 / The final gap</p><h3>PayPal settlement</h3><p>Pay only for the difference you both agree is fair.</p></article>
          </div>
        </div>
      </section>

      <section className="closing-section"><div className="closing-curve" /><div className="shell closing-content"><div><p className="eyebrow">Make room for the reciprocal</p><h2>Your next opportunity might be someone else&apos;s skill.</h2></div><a className="button button-lime" href="#how-it-works">Find the exchange <Arrow /></a></div></section>
      <footer className="site-footer shell"><a href="#top"><Brand /></a><p>Where expertise becomes exchange.</p><small>© 2026 SwapGap AI</small></footer>
    </main>
  );
}

function ProfileCard({ name, role, offer, value, need, mint = false }: { name: string; role: string; offer: string; value: string; need: string; mint?: boolean }) {
  return <article className={mint ? "profile-card profile-sara" : "profile-card"}><div className="profile-top"><Avatar initial={name[0]} mint={mint} /><div><strong>{name}</strong><small>{role}</small></div></div><div className="skill-pill"><small>Offers</small><b>{offer}<em>{value}</em></b></div><p><strong>Needs</strong> {need}</p></article>;
}
function ExchangeBoard() {
  return <div className="exchange-board" aria-label="Illustrative skill exchange example">
    <div className="board-header"><span>Illustrative exchange</span><i>Draft proposal</i></div>
    <svg className="exchange-lines" viewBox="0 0 560 430" fill="none" aria-hidden="true"><path d="M90 150C185 53 281 96 358 185s107 39 135-19" /><path d="M469 264c-110 90-203 23-271-38S80 236 58 294" /></svg>
    <ProfileCard name="Aarav" role="Brand designer" offer="Logo Design" value="$100" need="Website Copywriting" />
    <ProfileCard name="Sara" role="Copywriter" offer="Website Copywriting" value="$85" need="Logo Design" mint />
    <div className="ai-orbit"><span>AI</span><i /><i /><i /></div>
    <div className="settlement-card"><div><small>Suggested top-up</small><b>$15</b></div><p>Sara pays Aarav</p><span>Subject to mutual agreement</span></div>
  </div>;
}
function ProposalPreview() {
  return <div className="proposal-card"><header><div><span className="proposal-symbol">✦</span><div><b>AI proposal</b><small>Illustrative preview - not an active agreement</small></div></div><span className="proposal-status">Ready to discuss</span></header><div className="proposal-people"><div><Avatar initial="A" /><span><b>Aarav</b><small>Logo Design</small></span><strong>$100</strong></div><span className="proposal-exchange"><Exchange /></span><div><Avatar initial="S" mint /><span><b>Sara</b><small>Website Copywriting</small></span><strong>$85</strong></div></div><div className="proposal-analysis"><div><p><b>Balanced exchange</b><span>Both services have a complementary project scope.</span></p><div className="agreement-bar"><i /><i /><i /></div><small>Mutual agreement required before settlement</small></div><aside><small>Cash difference</small><b>$15</b><span>Sara to Aarav</span></aside></div></div>;
}
/*
const Mark = () => <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] bg-[#251c40]"><span className="h-5 w-5 rounded-full border-[3px] border-[#a6f6d6]" /><span className="absolute h-2 w-5 rotate-[-38deg] rounded-full bg-[#a992ff]" /></span>;
const Mark = () => <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] bg-[#251c40]"><span className="h-5 w-5 rounded-full border-[3px] border-[#a6f6d6]" /><span className="absolute h-2 w-5 rotate-[-38deg] rounded-full bg-[#a992ff]" /></span>;
const Brand = () => <span className="flex items-center gap-2.5 text-[17px] font-bold tracking-[-.045em]"><Mark />swapgap<span className="-ml-2 text-[#7259df]">.ai</span></span>;
const Face = ({ children, mint = false }: { children: string; mint?: boolean }) => <span className={mint ? "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#d7f6e9] text-sm font-bold text-[#13775e]" : "grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#e5deff] text-sm font-bold text-[#6047bd]"}>{children}</span>;

export default function Home() {
  return <main className="overflow-hidden bg-[#f8f7f2] text-[#1c1830]">
    <nav className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10" aria-label="Main navigation"><a href="#top" aria-label="SwapGap AI home"><Brand /></a><div className="hidden gap-8 text-sm font-medium text-[#565267] md:flex"><a className="nav-link" href="#how-it-works">How it works</a><a className="nav-link" href="#why-swapgap">Why SwapGap</a><a className="nav-link" href="#example-swap">Example swap</a></div><a href="#how-it-works" className="hidden rounded-full bg-[#251c40] px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 sm:inline-flex">Start exploring <span className="ml-2"><Arrow /></span></a><details className="relative md:hidden"><summary className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[#ded9eb] bg-white marker:content-none" aria-label="Open navigation">☰</summary><div className="absolute right-0 top-12 z-30 flex w-52 flex-col gap-1 rounded-2xl border border-[#e4e0ec] bg-white p-2 shadow-xl"><a className="rounded-xl px-3 py-2 text-sm hover:bg-[#f4f1ff]" href="#how-it-works">How it works</a><a className="rounded-xl px-3 py-2 text-sm hover:bg-[#f4f1ff]" href="#why-swapgap">Why SwapGap</a><a className="rounded-xl px-3 py-2 text-sm hover:bg-[#f4f1ff]" href="#example-swap">Example swap</a></div></details></nav>
    <section id="top" className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:px-10 lg:pb-28 lg:pt-24"><div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" /><div className="relative grid items-center gap-12 lg:grid-cols-[.94fr_1.06fr]"><div className="relative z-10 max-w-[620px]"><p className="animate-in mb-7 inline-flex items-center gap-2 rounded-full border border-[#dcd5ff] bg-[#f1eeff] px-3 py-1.5 text-xs font-bold uppercase tracking-[.12em] text-[#6149c4]"><span className="h-1.5 w-1.5 rounded-full bg-[#6e54df]" />A better way to trade talent</p><h1 className="animate-in delay-1 text-balance text-[clamp(3.55rem,7vw,6.7rem)] font-[800] leading-[.88] tracking-[-.075em]">Your Skills<br />Are <span className="relative text-[#7056de]">Currency<span className="absolute -bottom-1 left-1 h-1.5 w-[94%] rounded-full bg-[#a6f6d6]" /></span>.</h1><p className="animate-in delay-2 mt-8 text-xl font-medium text-[#3b374b] sm:text-2xl">Trade what you know. Get what you need.</p><p className="animate-in delay-3 mt-4 max-w-lg leading-7 text-[#6a6578]">Meet your perfect skill match, negotiate smarter with AI, and let PayPal handle the difference.</p><div className="animate-in delay-4 mt-9 flex flex-col gap-3 sm:flex-row"><a href="#how-it-works" className="inline-flex items-center justify-center rounded-full bg-[#7259df] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_22px_rgba(105,78,211,.24)] transition-all hover:-translate-y-0.5">Explore how it works <span className="ml-2"><Arrow /></span></a><a href="#example-swap" className="inline-flex items-center justify-center rounded-full border border-[#dcd7e6] bg-white/70 px-6 py-3.5 text-sm font-bold">See a skill swap</a></div></div>
      <div className="animate-in delay-2 relative min-h-[465px] overflow-hidden rounded-[34px] border border-[#e4dfeb] bg-[#eeecf5] p-4 shadow-[0_28px_60px_rgba(42,31,74,.13)] sm:min-h-[525px] sm:p-6"><div className="absolute inset-0 opacity-70 [background-image:radial-gradient(#c9c0dd_1px,transparent_1px)] [background-size:18px_18px]" /><div className="relative flex justify-between"><span className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.12em] text-[#6a627e]">Live exchange map</span><span className="text-xs font-bold text-[#3c9278]">● 92% mutual fit</span></div><svg className="absolute left-[12%] top-[24%] h-[47%] w-[76%]" viewBox="0 0 400 240" fill="none" aria-hidden="true"><path d="M40 80C100 15 180 20 230 95s85 55 132 6" stroke="#8069e7" strokeWidth="2" strokeDasharray="6 7" /><path d="M350 158c-75 65-155 45-198-13S78 102 35 154" stroke="#52c7a3" strokeWidth="2" strokeDasharray="6 7" /></svg>
        <article className="card-float absolute left-4 top-[17%] w-[57%] max-w-[286px] rounded-[22px] border border-white/90 bg-white p-4 shadow-[0_14px_25px_rgba(42,31,74,.13)] sm:left-7 sm:p-5"><div className="flex gap-3"><Face>A</Face><div><b>Aarav Mehta</b><p className="text-[11px] text-[#766f83]">Brand designer · Mumbai</p></div></div><div className="mt-4 rounded-xl bg-[#f2efff] p-3"><p className="text-[9px] font-bold uppercase text-[#7965ce]">Offers</p><b className="text-sm text-[#302851]">Logo Design <span className="float-right text-[#6a52d7]">$100</span></b></div><p className="mt-3 text-xs text-[#625b70]"><b>Needs</b> · Website Copywriting</p></article>
        <article className="card-float-reverse absolute right-4 top-[41%] w-[57%] max-w-[286px] rounded-[22px] border border-white/90 bg-white p-4 shadow-[0_14px_25px_rgba(42,31,74,.13)] sm:right-7 sm:p-5"><div className="flex gap-3"><Face mint>S</Face><div><b>Sara Chen</b><p className="text-[11px] text-[#766f83]">Copywriter · Singapore</p></div></div><div className="mt-4 rounded-xl bg-[#e9faf3] p-3"><p className="text-[9px] font-bold uppercase text-[#27866c]">Offers</p><b className="text-sm text-[#263f38]">Web Copy <span className="float-right text-[#238264]">$85</span></b></div><p className="mt-3 text-xs text-[#625b70]"><b>Needs</b> · Logo Design</p></article>
        <div className="absolute bottom-5 left-1/2 w-[82%] -translate-x-1/2 rounded-2xl border border-[#d8d0f8] bg-[#272044] p-3.5 text-white shadow-xl sm:bottom-7 sm:w-[70%]"><div className="flex justify-between text-[10px] font-bold uppercase tracking-[.12em] text-[#c7bcff]">✦ Suggested settlement <span className="rounded-full bg-[#a6f6d6] px-2 py-1 text-[#193f36]">+$15</span></div><p className="mt-2 text-sm font-bold">Sara pays Aarav <span className="font-medium text-[#b8b1c8]">via PayPal</span></p><p className="mt-1 text-[10px] text-[#a9a3ba]">Subject to mutual agreement</p></div></div></div></section>
    <section id="how-it-works" className="border-y border-[#e4e0d8] bg-[#fdfcf9] py-20 sm:py-28"><div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10"><p className="eyebrow">The exchange, reimagined</p><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><h2 className="section-title mt-4 max-w-xl">A fair trade can start with one good introduction.</h2><p className="max-w-xs text-sm leading-6 text-[#706b79]">From a capability you have to a capability you need, the path stays clear.</p></div><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Step n="01" title="List your skills" copy="Share what you do brilliantly—and what would move your work forward." tint="bg-[#ede9ff] text-[#634ac7]" /><Step n="02" title="Discover mutual matches" copy="Our matching looks for a real two-way fit, not just another lead." tint="bg-[#e1f8ee] text-[#197b61]" /><Step n="03" title="Negotiate with AI" copy="See a balanced proposal you can shape together before anything is agreed." tint="bg-[#fff0d8] text-[#a6651d]" /><Step n="04" title="Settle the gap" copy="Use PayPal only for the agreed difference." tint="bg-[#22203a] text-white" /></div></div></section>
    <section id="example-swap" className="py-20 sm:py-28"><div className="mx-auto grid max-w-[1240px] gap-12 px-5 sm:px-8 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:px-10"><div><p className="eyebrow">One clear proposal</p><h2 className="section-title mt-4">Less guesswork. More good work.</h2><p className="mt-5 max-w-sm leading-7 text-[#706b79]">A shared starting point turns the awkward value conversation into an open, useful one.</p><a href="#why-swapgap" className="mt-7 inline-flex gap-2 text-sm font-bold text-[#6248cf]">Why it feels different <Arrow /></a></div><div className="rounded-[30px] border border-[#ded8e8] bg-[#fcfbff] p-5 shadow-[0_24px_55px_rgba(45,34,83,.08)]"><div className="flex justify-between border-b border-[#e9e5f0] pb-4"><span className="font-bold">✦ Match proposal <small className="ml-2 font-normal text-[#837c92]">Illustrative example · Not a live AI system</small></span><span className="text-xs font-bold text-[#197a61]">92% fit</span></div><div className="grid gap-3 py-5 sm:grid-cols-3"><Proposal name="Aarav" skill="Logo Design" value="$100" /><div className="grid place-items-center text-2xl text-[#7259df]">↔</div><Proposal name="Sara" skill="Website Copywriting" value="$85" mint /></div><div className="grid gap-4 border-t border-[#e9e5f0] pt-5 sm:grid-cols-[1.4fr_.8fr]"><p className="rounded-2xl bg-[#f3f0ff] p-4 text-sm leading-6 text-[#514a63]"><b className="text-[#5e48b7]">✦ AI&apos;s perspective</b><br />Both services have a complementary scope. A <b>$15 top-up</b> keeps the exchange balanced.</p><p className="rounded-2xl bg-[#26203f] p-4 text-white"><small className="font-bold uppercase tracking-[.12em] text-[#bdb2ef]">Proposed difference</small><b className="mt-2 block text-3xl">$15</b><small className="text-[#bdb7ca]">Sara → Aarav via PayPal</small></p></div></div></div></section>
    <section id="why-swapgap" className="bg-[#211b37] py-20 text-white sm:py-28"><div className="mx-auto max-w-[1240px] px-5 sm:px-8 lg:px-10"><p className="eyebrow text-[#adf3d7]">Built for balance</p><h2 className="section-title mt-4 max-w-2xl text-white">The kind of marketplace your skills deserve.</h2><div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Feature className="bg-[#7058db] lg:col-span-2" title="AI-powered matching" copy="Find reciprocal opportunity, not just a directory of profiles." mark="✦" /><Feature className="bg-[#e0f8ed] text-[#1e4037]" title="Smart negotiation" copy="A calm, shared starting point for talking value." mark="↗" /><Feature className="bg-[#31294d]" title="Fair, transparent agreements" copy="Everyone sees the same proposal—and everyone has a say." mark="✓" /><Feature className="bg-[#f7eddd] text-[#302543] lg:col-span-2" title="PayPal-powered settlement" copy="Settle only the difference, only when both people agree." mark="$15" /></div></div></section>
    <section className="relative overflow-hidden py-24 text-center sm:py-32"><div className="absolute left-1/2 top-0 h-[420px] w-[600px] -translate-x-1/2 rounded-full bg-[#e5ddff] blur-3xl opacity-65" /><div className="relative mx-auto max-w-3xl px-5"><p className="eyebrow">Start with what you know</p><h2 className="section-title mt-5">Your next opportunity might be someone else&apos;s skill.</h2><p className="mx-auto mt-5 max-w-lg leading-7 text-[#706b79]">Make your expertise go further—and discover what collaboration can unlock.</p><a href="#how-it-works" className="mt-9 inline-flex rounded-full bg-[#7259df] px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_22px_rgba(105,78,211,.24)]">See how SwapGap works <span className="ml-2"><Arrow /></span></a></div></section>
    <footer className="border-t border-[#e4e0d8]"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><a href="#top"><Brand /></a><p className="text-sm text-[#787283]">Where expertise becomes exchange.</p><p className="text-xs text-[#968f9d]">© 2026 SwapGap AI</p></div></footer>
  </main>;
}
function Step({ n, title, copy, tint }: { n: string; title: string; copy: string; tint: string }) { return <article className="group rounded-[24px] border border-[#e7e3dc] bg-white p-6 transition-transform hover:-translate-y-1"><b className={"grid h-11 w-11 place-items-center rounded-2xl text-sm " + tint}>{n}</b><h3 className="mt-7 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#706b79]">{copy}</p><span className="mt-6 block h-px w-8 bg-[#cfc8df] transition-all group-hover:w-full" /></article> }
function Proposal({ name, skill, value, mint = false }: { name: string; skill: string; value: string; mint?: boolean }) { return <div className={mint ? "rounded-2xl bg-[#e9f9f2] p-4" : "rounded-2xl bg-[#f1effa] p-4"}><div className="flex gap-2"><Face mint={mint}>{name[0]}</Face><span><b className="text-sm">{name}</b><small className="block text-[#716b80]">{skill}</small></span></div><b className="mt-4 block text-2xl">{value}</b></div> }
function Feature({ className, title, copy, mark }: { className: string; title: string; copy: string; mark: string }) { return <article className={"min-h-[225px] rounded-[28px] p-6 " + className}><b className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 text-lg">{mark}</b><h3 className="mt-8 text-xl font-bold">{title}</h3><p className="mt-3 max-w-sm text-sm leading-6 opacity-80">{copy}</p></article> }
*/
