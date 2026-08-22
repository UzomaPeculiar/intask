import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  Building2,
  BookOpen,
  BarChart3,
  CheckCircle2,
  Code,
  Film,
  FileText,
  GraduationCap,
  Mail,
  Megaphone,
  Menu,
  Palette,
  PenTool,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  X,
  Zap,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { naira } from "@/lib/format";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { WaitlistPage } from "@/components/WaitlistPage";

/* ------------------------------------------------------------------ */
/*  Route                                                              */
/* ------------------------------------------------------------------ */

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InTask — Find & Hire Verified Nigerian Students | Freelance Marketplace" },
      {
        name: "description",
        content:
          "InTask connects Nigerian university students with real paid tasks. Web design, content writing, research, tutoring. Verified students, escrow payments via Paystack, ratings on every job.",
      },
      { property: "og:title", content: "InTask — Find & Hire Verified Nigerian Students" },
      {
        property: "og:description",
        content:
          "Built for Nigerian students. Find work or hire verified students. Secure escrow payments via Paystack.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://intask.ng" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "InTask — Find & Hire Verified Nigerian Students" },
      {
        name: "twitter:description",
        content:
          "Built for Nigerian students. Find work or hire verified students. Secure escrow payments via Paystack.",
      },
      { name: "keywords", content: "freelance nigeria, student freelancer, hire students, nigerian freelancer, escrow payment, student marketplace, paid tasks, web design nigeria, content writing nigeria" },
      { name: "canonical", content: "https://intask.ng" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "How does InTask work for students?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Students create a verified profile, browse available tasks, apply to ones that match their skills, complete the work, and get paid securely via escrow.",
              },
            },
            {
              "@type": "Question",
              name: "How does InTask work for businesses?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Businesses post tasks with a budget, review applications from verified students, fund the task via escrow, and only release payment when the work is approved.",
              },
            },
            {
              "@type": "Question",
              name: "Is payment secure on InTask?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. All payments are held in escrow via Paystack. Funds are only released to the student once the client approves the completed work.",
              },
            },
            {
              "@type": "Question",
              name: "How are students verified on InTask?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Students verify their status by uploading a valid student ID or confirming their university email address. Only verified students can receive tasks.",
              },
            },
            {
              "@type": "Question",
              name: "What types of tasks can be posted on InTask?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Web design, content writing, research, tutoring, data entry, graphic design, social media management, video editing, and more.",
              },
            },
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [{
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://intask.ng",
          }],
        }),
      },
    ],
  }),
  component: () => (import.meta.env.VITE_WAITLIST_MODE !== "false" ? <WaitlistPage /> : <Landing />),
});

/* ------------------------------------------------------------------ */
/*  Reveal-on-scroll wrapper (IntersectionObserver + CSS)              */
/* ------------------------------------------------------------------ */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.remove("reveal-hidden");
          el.classList.add("reveal-visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal-hidden ${className ?? ""}`}
      style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Static data                                                        */
/* ------------------------------------------------------------------ */


const STUDENT_PERKS = [
  "Find tasks that match your skills",
  "Build your portfolio while studying",
  "Get paid safely via escrow",
  "Earn ratings that open more work",
];

const BUSINESS_PERKS = [
  "Access verified student talent",
  "Post tasks in minutes",
  "Funds held until work is approved",
  "Ratings help you pick the best fit",
];

const HOW_IT_WORKS = [
  {
    n: 1,
    title: "Create your profile",
    body: "Sign up as a student, alumni, or business. Verify your status and list your skills.",
  },
  {
    n: 2,
    title: "Apply or post a task",
    body: "Students browse and apply for open tasks. Businesses post tasks and review applicants.",
  },
  {
    n: 3,
    title: "Get paid safely",
    body: "Money is held in escrow via Paystack and released only when work is approved.",
  },
];

const SEARCH_SUGGESTIONS = [
  "Web Design",
  "Content Writing",
  "UI/UX",
  "Research",
  "Video Editing",
  "Tutoring",
];

const CATEGORIES_DATA = [
  { name: "Web Design", icon: Code },
  { name: "Content Writing", icon: PenTool },
  { name: "UI/UX Design", icon: Palette },
  { name: "Research", icon: BookOpen },
  { name: "Video Editing", icon: Film },
  { name: "Graphic Design", icon: Sparkles },
  { name: "Data Analysis", icon: BarChart3 },
  { name: "App Development", icon: Zap },
  { name: "Social Media", icon: Megaphone },
  { name: "Copywriting", icon: FileText },
  { name: "Tutoring", icon: GraduationCap },
  { name: "Virtual Assistant", icon: Briefcase },
];


const UNIVERSITIES = [
  "University of Lagos",
  "Obafemi Awolowo University",
  "University of Nigeria",
  "Ahmadu Bello University",
  "University of Ibadan",
  "Federal University of Technology",
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate({ to: "/auth/login", search: { redirect: q ? `/app/browse?q=${encodeURIComponent(q)}` : "/app/browse" } });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* --- Header -------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              InTask
            </Link>
            <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <Link to="/auth/login" search={{ redirect: "/app/browse" }} className="transition-colors hover:text-foreground">
                Find work
              </Link>
              <Link to="/app/talent" className="transition-colors hover:text-foreground">
                For businesses
              </Link>
              <Link to="/auth/login" search={{ redirect: "/app/browse" }} className="transition-colors hover:text-foreground">
                Categories
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth/login" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to="/auth/signup" className="hidden sm:inline-flex">
              <Button size="sm">Sign up free</Button>
            </Link>
            <button
              className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* --- Mobile menu overlay -------------------------------------- */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-full max-w-xs bg-background shadow-lg">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <Link
                to="/"
                className="flex items-center gap-2 font-semibold tracking-tight"
                onClick={() => setMobileOpen(false)}
              >
                <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles className="size-4" />
                </span>
                InTask
              </Link>
              <button
                className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4">
              <Link
                to="/auth/login"
                search={{ redirect: "/app/browse" }}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                Find work
              </Link>
              <Link
                to="/app/talent"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                For businesses
              </Link>
              <Link
                to="/auth/login"
                search={{ redirect: "/app/browse" }}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                Categories
              </Link>
            </nav>
            <div className="border-t border-border p-4">
              <Link to="/auth/login" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  Log in
                </Button>
              </Link>
              <Link to="/auth/signup" onClick={() => setMobileOpen(false)} className="mt-2 block">
                <Button className="w-full">Sign up free</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* --- Hero: Upwork-style with search bar ------------------------ */}
      <section
        className="relative overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1600&q=80)",
        }}
      >
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/10" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-8 px-4 pb-12 pt-12 sm:pt-16 md:grid-cols-2">
          {/* Text side */}
          <div>
            <h1 className="hero-fade-in hero-delay-1 text-3xl font-semibold leading-[1.1] tracking-tight text-white sm:text-4xl md:text-5xl">
              Find work that fits your skills.
            </h1>

            <p className="hero-fade-in hero-delay-2 mt-4 max-w-lg text-sm leading-relaxed text-white/80 sm:text-base md:text-lg">
              InTask connects Nigerian university students with real paid tasks.
              Verified talent. Safe escrow payments.
            </p>

            <div className="hero-fade-in hero-delay-3 mt-7">
              <form onSubmit={handleSearch} className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for a skill..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="sm" className="shrink-0">
                  Search
                </Button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {SEARCH_SUGGESTIONS.map((s) => (
                  <Link
                    key={s}
                    to="/auth/login"
                    search={{ redirect: `/app/browse?q=${encodeURIComponent(s)}` }}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Hero visual: task card mockup */}
          <div className="hero-fade-in hero-delay-4 relative">
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-pop">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Web Design - Remote
                  </p>
                  <h3 className="mt-1 truncate text-base font-semibold text-foreground">
                    Landing page for fashion brand
                  </h3>
                </div>
                <span className="shrink-0 rounded-md bg-success/15 px-2 py-1 text-sm font-semibold text-success">
                  {naira(35000)}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                Need a clean, mobile-first landing page with hero section,
                product showcase, and contact form.
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name="KE Styles" size={28} />
                  <div className="text-xs">
                    <div className="font-medium text-foreground">KE Styles</div>
                    <div className="text-muted-foreground">5 applicants</div>
                  </div>
                </div>
                <Link to="/auth/signup">
                  <Button size="sm" variant="secondary">
                    Apply
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- University targeting strip (scrolling marquee) ----------- */}
      <section className="border-y border-border/60 bg-card/50">
        <p className="pt-4 text-center text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Built for students at
        </p>
        <div className="overflow-hidden py-4">
          <div className="animate-marquee flex w-max gap-8">
            {[...UNIVERSITIES, ...UNIVERSITIES].map((u, i) => (
              <span key={`${u}-${i}`} className="whitespace-nowrap text-sm font-medium text-muted-foreground/70">
                {u}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* --- Pricing --------------------------------------------------- */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                Simple, transparent pricing
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                No upfront fees. No subscriptions. You only pay when a task is completed.
              </p>
            </div>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            <Reveal>
              <div className="rounded-2xl border border-border/80 bg-background p-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">Students</p>
                <p className="mt-2 text-3xl font-bold text-foreground">Free</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sign up, apply to tasks, and get paid. No fees to join or use the platform.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="rounded-2xl border border-primary bg-primary/5 p-6 text-center">
                <p className="text-sm font-medium text-primary">Clients</p>
                <p className="mt-2 text-3xl font-bold text-foreground">8%</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Platform fee on completed tasks. Held in escrow via Paystack — only pay when you approve the work.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="rounded-2xl border border-border/80 bg-background p-6 text-center">
                <p className="text-sm font-medium text-muted-foreground">Withdrawals</p>
                <p className="mt-2 text-3xl font-bold text-foreground">₦50</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Flat processing fee per withdrawal to your bank account. Minimum withdrawal ₦550.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* --- For Students / For Businesses (Upwork dual-path pattern) - */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
            Two ways to use InTask
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Students card */}
          <Reveal>
            <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-primary/5 p-6 sm:p-8">
              <div className="grid size-10 place-items-center rounded-full bg-primary/15 text-primary">
                <GraduationCap className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                For students
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Find paid tasks, build your portfolio, and earn while you study.
              </p>
              <ul className="mt-4 space-y-2">
                {STUDENT_PERKS.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                    {p}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Link to="/auth/signup">
                  <Button className="w-full">Join as student</Button>
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Businesses card */}
          <Reveal delay={0.08}>
            <div className="flex h-full flex-col rounded-2xl border border-border/80 bg-card p-6 sm:p-8">
              <div className="grid size-10 place-items-center rounded-full bg-success/15 text-success">
                <Building2 className="size-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                For businesses
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Access affordable, verified student talent for short-term tasks.
              </p>
              <ul className="mt-4 space-y-2">
                {BUSINESS_PERKS.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                    {p}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Link to="/app/tasks/create">
                  <Button variant="outline" className="w-full">
                    Post a task
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- How it works: 3 steps (Toptal pattern) ------------------- */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              How it works
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.n} delay={i * 0.08}>
                <div className="relative">
                  <span className="text-5xl font-bold tracking-tighter text-primary/20">
                    {step.n}
                  </span>
                  <h3 className="mt-2 text-lg font-medium text-foreground">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- Why InTask: 2+1 bento grid (asymmetric, varied BGs) ----- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
            Why InTask?
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {/* Verified students - large card (col-span-2) */}
          <Reveal className="sm:col-span-2 sm:row-span-2">
            <div className="flex h-full min-h-[180px] flex-col justify-between rounded-2xl bg-primary/8 p-5 sm:min-h-[220px] sm:p-8">
              <div className="grid size-10 place-items-center rounded-full bg-primary/15 text-primary">
                <ShieldCheck className="size-5" />
              </div>
              <div className="mt-auto">
                <h3 className="text-xl font-medium text-foreground sm:text-2xl">
                  Verified students only
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Every student is checked with their school email or student ID
                  before they can work. No fake profiles, no guesswork.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Secure escrow - tinted card */}
          <Reveal delay={0.08}>
            <div className="flex h-full min-h-[140px] flex-col justify-between rounded-2xl bg-success/8 p-6">
              <div className="grid size-10 place-items-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="mt-auto">
                <h3 className="mt-4 font-medium text-foreground">
                  Secure escrow
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Funds held via Paystack until you approve the work.
                </p>
              </div>
            </div>
          </Reveal>

          {/* Ratings - plain card with border */}
          <Reveal delay={0.16}>
            <div className="flex h-full min-h-[140px] flex-col justify-between rounded-2xl border border-border/80 bg-card p-6">
              <div className="grid size-10 place-items-center rounded-full bg-warning/15 text-warning">
                <Star className="size-5" />
              </div>
              <div className="mt-auto">
                <h3 className="mt-4 font-medium text-foreground">
                  Ratings on every job
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Both sides leave reviews. Build a reputation that earns you
                  more.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- Verification example -------------------------------------- */}
      <VerificationExample />

      {/* --- Popular skills (replaces fake student cards) --------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
            Skills students are offering
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Verified students ready to work across these categories
          </p>
        </Reveal>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { skill: "Web Design", desc: "Landing pages, websites, e-commerce stores" },
            { skill: "Content Writing", desc: "Blog posts, articles, product descriptions" },
            { skill: "UI/UX Design", desc: "Mobile apps, dashboards, wireframes" },
            { skill: "Video Editing", desc: "YouTube, social media, reels" },
            { skill: "Research", desc: "Academic papers, market research, reports" },
            { skill: "Tutoring", desc: "Math, science, English, programming" },
          ].map((item, i) => (
            <Reveal key={item.skill} delay={i * 0.06}>
              <Link
                to="/auth/login"
                search={{ redirect: `/app/browse?q=${encodeURIComponent(item.skill)}` }}
                className="group flex items-start gap-3 rounded-2xl border border-border/80 bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <CheckCircle2 className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.skill}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- Categories: visual icon grid (Upwork pattern) ------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
            Find work by category
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Browse tasks across popular student skills
          </p>
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {CATEGORIES_DATA.map((c, i) => (
            <Reveal key={c.name} delay={i * 0.04}>
              <Link
                to="/auth/login"
                search={{ redirect: `/app/browse?q=${encodeURIComponent(c.name)}` }}
                className="group flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <c.icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.name}
                  </p>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- How it feels (value prop, no fake testimonials) ----------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              Built for how students actually work
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              No upfront fees. No chasing clients for payment. Post a profile,
              find tasks that match your skills, and get paid safely through
              escrow. Your reputation grows with every completed job.
            </p>
            <div className="mt-6">
              <Link to="/auth/signup">
                <Button size="lg" className="gap-2">
                  Get started free <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* --- Email capture -------------------------------------------- */}
      <EmailCapture />

      {/* --- CTA banner ------------------------------------------------ */}
      <section className="bg-primary">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14 text-center">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight text-primary-foreground sm:text-2xl md:text-3xl">
              Ready to get started?
            </h2>
            <p className="mt-3 text-sm text-primary-foreground/80">
              Create your account and start finding tasks or hiring verified students today.
            </p>
            <div className="mt-6">
              <Link to="/auth/signup">
                <Button size="lg" variant="secondary" className="gap-2">
                  Create free account <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- Footer ---------------------------------------------------- */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-3" />
              </span>
              InTask
            </div>
            <p className="mt-1 text-xs">
              Work, collaborate, and grow. Built for students.
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <Link to="/about" className="hover:text-foreground">
              About
            </Link>
            <Link to="/contact" className="hover:text-foreground">
              Contact
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Verification example (collapsible, isolated for clarity)           */
/* ------------------------------------------------------------------ */

function VerificationExample() {
  const [show, setShow] = useState(false);

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <Reveal>
          <Collapsible open={show} onOpenChange={setShow}>
            <div className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-foreground sm:text-sm">
                  See how verification works
                </p>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    {show ? "Hide" : "View"} details
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="mt-3 flex items-start gap-3">
                  <InitialsAvatar name="Chiamaka Okafor" size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        Chiamaka Okafor
                      </p>
                      <VerifiedBadge role="student" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      UNILAG - 300L - Computer Science
                    </p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3 fill-warning text-warning" />{" "}
                      4.9 - 12 tasks completed
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {["Web Design", "UI/UX", "Figma"].map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Briefcase className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Email capture                                                      */
/* ------------------------------------------------------------------ */

function EmailCapture() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setLoading(true);
    // Store in localStorage as a fallback — in production, send to a
    // Supabase table or email service (Loops, Resend Audiences, etc.)
    try {
      const existing = JSON.parse(localStorage.getItem("intask_waitlist") || "[]");
      if (!existing.includes(email.toLowerCase().trim())) {
        existing.push(email.toLowerCase().trim());
        localStorage.setItem("intask_waitlist", JSON.stringify(existing));
      }
    } catch {
      // localStorage might be full or disabled — ignore
    }
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <div className="mx-auto max-w-xl text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
              <Mail className="size-6" />
            </div>
            <h2 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl">
              Not ready to sign up yet?
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Get notified when we launch at your university. No spam — just one email when InTask goes live at your school.
            </p>

            {submitted ? (
              <div className="mt-6 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
                ✓ You&apos;re on the list! We&apos;ll notify you when InTask launches at your university.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu.ng"
                  required
                  className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <Button type="submit" size="lg" disabled={loading} className="shrink-0">
                  {loading ? "Saving..." : "Notify me"}
                </Button>
              </form>
            )}

            <p className="mt-3 text-xs text-muted-foreground/60">
              Join 200+ students already on the waitlist.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
