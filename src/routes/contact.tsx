import { createFileRoute, Link } from "@tanstack/react-router";
import React, { type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Clock,
  Mail,
  Menu,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact InTask — Get in Touch | Support" },
      {
        name: "description",
        content:
          "Need help with your account, payments, or disputes? Reach out to the InTask support team. We respond within 24 hours.",
      },
      { property: "og:title", content: "Contact InTask — Get in Touch" },
      {
        property: "og:description",
        content:
          "Need help with your account, payments, or disputes? Reach out to the InTask support team.",
      },
      { name: "canonical", content: "https://intask.ng/contact" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact InTask",
          url: "https://intask.ng/contact",
          mainEntity: {
            "@type": "Organization",
            name: "InTask",
            url: "https://intask.ng",
            email: "support@intask.ng",
          },
        }),
      },
    ],
  }),
  component: ContactPage,
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
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function ContactPage() {
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
              <Link to="/auth/signup" className="transition-colors hover:text-foreground">
                For businesses
              </Link>
              <Link to="/contact" className="text-foreground">
                Contact
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
                to="/app/browse"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                Find work
              </Link>
              <Link
                to="/auth/signup"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                For businesses
              </Link>
              <Link
                to="/contact"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-foreground bg-accent"
                onClick={() => setMobileOpen(false)}
              >
                Contact
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

      {/* --- Hero ----------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:pt-16">
        <Reveal>
          <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Get in touch
          </h1>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base md:text-lg">
            Need help with your account, payments, or disputes? We are here to
            help.
          </p>
        </Reveal>
      </section>

      {/* --- Contact methods: 2-col grid ------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2">
          <Reveal>
            <div className="rounded-2xl border border-border/80 bg-card p-6">
              <div className="grid size-10 place-items-center rounded-full bg-primary/15 text-primary">
                <Mail className="size-5" />
              </div>
              <h3 className="mt-4 font-medium text-foreground">
                Email us
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                For account issues, payment questions, or general inquiries.
              </p>
              <a
                href="mailto:support@intask.ng"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                support@intask.ng
                <ArrowRight className="size-3.5" />
              </a>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-border/80 bg-card p-6">
              <div className="grid size-10 place-items-center rounded-full bg-success/15 text-success">
                <Clock className="size-5" />
              </div>
              <h3 className="mt-4 font-medium text-foreground">
                Response hours
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Our team is available during business hours.
              </p>
              <p className="mt-4 text-sm font-medium text-foreground">
                Mon - Fri, 9:00 AM - 5:00 PM (WAT)
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* --- Common questions ----------------------------------------- */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
              Common questions
            </h2>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Reveal delay={0}>
              <div className="rounded-2xl border border-border/80 bg-background p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MessageCircle className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      How do I reset my password?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Go to the login page and tap &quot;Forgot password&quot;.
                      You will receive a reset link via email.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="rounded-2xl border border-border/80 bg-background p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                    <MessageCircle className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      How do escrow payments work?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      When a task is accepted, the client&apos;s funds are held
                      in escrow via Paystack. They are released when the work
                      is approved.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.16}>
              <div className="rounded-2xl border border-border/80 bg-background p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning/10 text-warning">
                    <MessageCircle className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      What if there is a dispute?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Both sides can raise a dispute. Our team reviews the
                      evidence and makes a fair decision based on the facts.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="rounded-2xl border border-border/80 bg-background p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                    <MessageCircle className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      How do I verify my student status?
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Sign up with your school email or upload your student ID.
                      Verification usually takes less than 24 hours.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* --- CTA banner ------------------------------------------------ */}
      <section className="bg-primary">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14 text-center">
          <Reveal>
            <h2 className="text-xl font-semibold tracking-tight text-primary-foreground sm:text-2xl md:text-3xl">
              Still have questions?
            </h2>
            <p className="mt-3 text-sm text-primary-foreground/80">
              Send us an email and we will get back to you as soon as possible.
            </p>
            <div className="mt-6">
              <a href="mailto:support@intask.ng">
                <Button size="lg" variant="secondary" className="gap-2">
                  Email support <ArrowRight className="size-4" />
                </Button>
              </a>
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
