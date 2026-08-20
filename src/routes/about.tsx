import { createFileRoute, Link } from "@tanstack/react-router";
import React, { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Menu,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About InTask — Our Mission | Nigerian Student Freelance Marketplace" },
      {
        name: "description",
        content:
          "Learn about InTask — the marketplace connecting Nigerian university students with real paid tasks. Our mission, values, and how we ensure secure escrow payments.",
      },
      { property: "og:title", content: "About InTask — Our Mission" },
      {
        property: "og:description",
        content:
          "Learn about InTask — the marketplace connecting Nigerian university students with real paid tasks. Secure escrow payments, verified students.",
      },
      { name: "canonical", content: "https://intask.ng/about" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "AboutPage",
          name: "About InTask",
          url: "https://intask.ng/about",
          mainEntity: {
            "@type": "Organization",
            name: "InTask",
            url: "https://intask.ng",
            description: "InTask connects Nigerian university students with clients who need quality work done quickly. Verified students, secure escrow payments, fair outcomes.",
            areaServed: {
              "@type": "Country",
              name: "Nigeria",
            },
          },
        }),
      },
    ],
  }),
  component: AboutPage,
});

/* ------------------------------------------------------------------ */
/*  Reveal-on-scroll (same as landing page)                            */
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
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Verified talent",
    body: "Every student is verified with their school email or student ID. No fake profiles, no guesswork.",
    color: "bg-primary/15 text-primary",
  },
  {
    icon: CheckCircle2,
    title: "Secure payments",
    body: "Funds are held in escrow via Paystack and released only when work is approved. Both sides are protected.",
    color: "bg-success/15 text-success",
  },
  {
    icon: Star,
    title: "Ratings that matter",
    body: "Both clients and students leave reviews after every task. Build a reputation that opens doors.",
    color: "bg-warning/15 text-warning",
  },
];


/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function AboutPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
              <Link to="/app/browse" className="transition-colors hover:text-foreground">
                Find work
              </Link>
              <Link to="/auth/signup" search={{ ref: "" }} className="transition-colors hover:text-foreground">
                For businesses
              </Link>
              <Link to="/about" className="text-foreground">
                About
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth/login" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to="/auth/signup" search={{ ref: "" }} className="hidden sm:inline-flex">
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
                to="/app/browse"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                Find work
              </Link>
              <Link
                to="/auth/signup" search={{ ref: "" }}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                For businesses
              </Link>
              <Link
                to="/about"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                About
              </Link>
            </nav>
            <div className="border-t border-border p-4">
              <Link to="/auth/login" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">
                  Log in
                </Button>
              </Link>
              <Link to="/auth/signup" search={{ ref: "" }} onClick={() => setMobileOpen(false)} className="mt-2 block">
                <Button className="w-full">Sign up free</Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* --- Hero ----------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:pt-16">
        <Reveal>
          <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
            About InTask
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
            InTask is a marketplace that connects Nigerian university students
            and alumni with clients who need quality work done quickly. We focus
            on verified profiles, secure escrow payments, and fair outcomes for
            both sides.
          </p>
        </Reveal>
      </section>

      {/* --- Mission statement ---------------------------------------- */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
                <GraduationCap className="size-6" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
                Our mission
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Help students earn, build experience, and grow professional
                confidence while still in school. Every task completed on InTask
                is a step toward a stronger career.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- Values: 3 cards ------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
            What we stand for
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.08}>
              <div className="rounded-2xl border border-border/80 bg-card p-6">
                <div
                  className={`grid size-10 place-items-center rounded-full ${v.color}`}
                >
                  <v.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-medium text-foreground">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {v.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* --- Launching banner ----------------------------------------- */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center sm:py-10">
          <Reveal>
            <p className="text-sm font-medium text-muted-foreground">
              Currently onboarding at Nigerian universities
            </p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Real numbers will appear here as students and businesses join.
            </p>
          </Reveal>
        </div>
      </section>

      {/* --- Why students trust InTask -------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
        <Reveal>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
            Why students trust InTask
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Reveal>
            <div className="rounded-2xl border border-border/80 bg-card p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Users className="size-4" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    Built for students, by people who understand students
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We know what it is like to juggle classes, side projects,
                    and the need to earn. InTask is designed around that reality.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-border/80 bg-card p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    Your money is safe until you approve the work
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Escrow via Paystack means clients do not pay until they are
                    satisfied, and students know the funds are real.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.16}>
            <div className="rounded-2xl border border-border/80 bg-card p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
                  <Star className="size-4" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    Ratings open doors
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A strong profile with good reviews leads to more and better
                    tasks. Your reputation grows with every job.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="rounded-2xl border border-border/80 bg-card p-6">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    Fair outcomes for both sides
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We do not take sides in disputes. Our process ensures both
                    clients and students get a fair deal.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- CTA banner ------------------------------------------------ */}
      <section className="bg-primary">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14 text-center">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight text-primary-foreground sm:text-2xl md:text-3xl">
              Ready to join?
            </h2>
            <p className="mt-3 text-sm text-primary-foreground/80">
              Create your account and start finding tasks or hiring verified
              students today.
            </p>
            <div className="mt-6">
              <Link to="/auth/signup" search={{ ref: "" }}>
                <Button size="lg" variant="secondary" className="gap-2">
                  Get started <ArrowRight className="size-4" />
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
