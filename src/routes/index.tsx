import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  Star,
  User,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { naira } from "@/lib/format";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InTask — Get paid for your skills" },
      { name: "description", content: "InTask connects Nigerian students with real paid tasks — from web design to research to content writing. Verified students, escrow payments, ratings on every job." },
      { property: "og:title", content: "InTask — Get paid for your skills" },
      { property: "og:description", content: "Built for Nigerian students. Find work or hire verified students. Escrow payments via Paystack." },
    ],
  }),
  component: Landing,
});

const HOW_IT_WORKS = [
  { n: 1, title: "Create your profile", body: "Sign up as a student, alumni, or business. Verify your status and list your skills." },
  { n: 2, title: "Apply or post a task", body: "Students browse and apply for open tasks. Businesses post tasks and review applicants." },
  { n: 3, title: "Get paid safely", body: "Money is held in escrow via Paystack and released only when work is approved." },
];

const CATEGORIES = [
  "Web Design", "Content Writing", "UI/UX", "Research", "Video Editing",
  "Tutoring", "Business", "Data Analysis", "App Development", "Social Media",
  "Graphic Design", "Copywriting", "Python", "Virtual Assistant",
];

const TRUST = [
  { icon: ShieldCheck, title: "Verified students only", body: "Every student is checked with their school email or student ID before they can work." },
  { icon: CheckCircle2, title: "Secure escrow payments", body: "Funds are held safely via Paystack until you approve the delivered work." },
  { icon: Star, title: "Ratings on every job", body: "Both sides leave reviews after every task. Build a reputation that earns you more." },
];

const WHO_IS_IT_FOR = [
  {
    icon: GraduationCap,
    title: "Students",
    body: "Find paid tasks that match your skills. Build your portfolio and earn while you study.",
    cta: "Find work",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: User,
    title: "Alumni",
    body: "Keep earning after graduation. Take on tasks, build your portfolio, and grow your network.",
    cta: "Join as alumni",
    color: "bg-warning/10 text-warning",
  },
  {
    icon: Building2,
    title: "Businesses",
    body: "Access affordable, verified student talent for short-term tasks and projects.",
    cta: "Post a task",
    color: "bg-success/10 text-success",
  },
];

function Landing() {
  return <MobileLanding />;
}

function MobileLanding() {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showTrustExample, setShowTrustExample] = useState(false);
  const visibleCategories = showAllCategories ? CATEGORIES : CATEGORIES.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            InTask
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/auth/signup"><Button size="sm">Sign up free</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="size-3" /> Built for students
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Get paid for your skills. <span className="text-primary">No experience needed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              InTask connects university students with real paid tasks — web design, content writing, research, tutoring, and more. Safe payments. Verified talent.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth/signup">
                <Button size="lg" className="gap-2">
                  Find work <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button size="lg" variant="outline">Post a task</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Free to sign up · Payments secured by Paystack · Verified students only</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/15 via-accent to-success/10 blur-2xl" />
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_18px_48px_-24px_rgba(37,99,235,0.38)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Web Design · Remote</p>
                  <h3 className="mt-1 truncate text-base font-semibold text-foreground">Landing page for fashion brand</h3>
                </div>
                <span className="shrink-0 rounded-md bg-success/15 px-2 py-1 text-sm font-semibold text-success">{naira(35000)}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                Need a clean, mobile-first landing page with hero section, product showcase, and contact form. Figma mockup available.
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name="KE Styles" size={28} />
                  <div className="text-xs">
                    <div className="font-medium text-foreground">KE Styles</div>
                    <div className="text-muted-foreground">5 applicants</div>
                  </div>
                </div>
                <Link to="/auth/signup"><Button size="sm" variant="secondary">Apply</Button></Link>
              </div>
              <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3 text-success" /> Payment held safely until work is approved
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Who is InTask for?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {WHO_IS_IT_FOR.map((w) => (
              <div key={w.title} className="rounded-2xl border border-border/80 bg-background p-5 shadow-sm">
                <div className={`grid size-9 place-items-center rounded-lg ${w.color}`}>
                  <w.icon className="size-5" />
                </div>
                <h3 className="mt-3 font-medium text-foreground">{w.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
                <Link to="/auth/signup">
                  <Button size="sm" variant="outline" className="mt-4 w-full">{w.cta} →</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{s.n}</div>
                <h3 className="mt-3 font-medium text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Popular categories</h2>
            <button onClick={() => setShowAllCategories((prev) => !prev)} className="text-sm font-medium text-primary hover:underline">
              {showAllCategories ? "Show less" : "Browse all"} →
            </button>
          </div>
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2">
            {visibleCategories.map((c) => (
              <span key={c} className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Why InTask?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {TRUST.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm">
                <div className="grid size-9 place-items-center rounded-lg bg-success/15 text-success">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-3 font-medium text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <Collapsible open={showTrustExample} onOpenChange={setShowTrustExample}>
            <div className="mt-8 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verification example</p>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    {showTrustExample ? "Hide" : "View"} details
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="mt-3 flex items-start gap-3">
                  <InitialsAvatar name="Chiamaka Okafor" size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">Chiamaka Okafor</p>
                      <VerifiedBadge role="student" />
                    </div>
                    <p className="text-xs text-muted-foreground">UNILAG · 300L · Computer Science</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3 fill-warning text-warning" /> 4.9 · 12 tasks completed
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {["Web Design", "UI/UX", "Figma"].map((s) => (
                        <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
                      ))}
                    </div>
                  </div>
                  <Briefcase className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      </section>

      <section className="border-t border-border bg-primary">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl">
            Ready to start earning?
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/80">
            Join thousands of students already using InTask to earn, learn, and grow.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/auth/signup">
              <Button size="lg" variant="secondary" className="gap-2">
                Create free account <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Post a task
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-3" />
              </span>
              InTask
            </div>
            <p className="mt-1 text-xs">Work, collaborate, and grow — built for students.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
