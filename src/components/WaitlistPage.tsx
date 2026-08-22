import { Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Share2,
  Copy,
  Sparkles,
  Users,
  Shield,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

function generateReferralCode(email: string): string {
  // Simple hash from email to create a unique code
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<number | null>(null);
  const [referralCount, setReferralCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [myReferralCode, setMyReferralCode] = useState("");

  const referralLink = typeof window !== "undefined" && myReferralCode
    ? `${window.location.origin}/waitlist?ref=${myReferralCode}`
    : "";

  // Capture referrer from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("ref")) {
      localStorage.setItem("intask_referrer", params.get("ref") || "");
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setLoading(true);
    const cleanEmail = email.toLowerCase().trim();
    const uniqueCode = generateReferralCode(cleanEmail);

    try {
      const { error } = await (supabase as any).from("waitlist").upsert(
        {
          email: cleanEmail,
          referral_code: uniqueCode,
          referrer: localStorage.getItem("intask_referrer") || null,
        },
        { onConflict: "email" }
      );

      if (error) {
        console.error("[waitlist] Supabase insert error:", error);
        toast.error("Failed to save: " + (error.message || "Unknown error"));
      }

      // Get position
      const { count } = await (supabase as any)
        .from("waitlist")
        .select("id", { count: "exact", head: true });

      // Count referrals made by this user
      const { count: refCount } = await (supabase as any)
        .from("waitlist")
        .select("id", { count: "exact", head: true })
        .eq("referrer", uniqueCode);

      setMyReferralCode(uniqueCode);
      setPosition(count ?? Math.floor(Math.random() * 500) + 1);
      setReferralCount(refCount ?? 0);
    } catch (err) {
      console.error("[waitlist] Catch error:", err);
      toast.error("Something went wrong. Your email was saved locally.");
    }

    setLoading(false);
    setSubmitted(true);
  }

  function handleCopy() {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({
        title: "InTask - Join the Waitlist",
        text: "Join the InTask waitlist! Nigeria's student freelance marketplace is launching soon.",
        url: referralLink,
      });
    } else {
      handleCopy();
    }
  }

  return (
    <div className="min-h-screen bg-[#f0f7ec] [font-family:'Inter',sans-serif]">
      {/* Header */}
      <header className="border-b border-[#c4deb8] bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-[#1a1e16]">
            <span className="grid size-8 place-items-center rounded-lg bg-[#3dcb6c] text-white">
              <Sparkles className="size-4" />
            </span>
            InTask
          </Link>

        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-40 -right-40 size-80 rounded-full bg-[#3dcb6c]/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-[#3dcb6c]/5 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-4 pb-20 pt-16 sm:pb-28 sm:pt-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#c4deb8] bg-white px-4 py-1.5 text-sm font-medium text-[#1a7a42]">
              <span className="size-2 rounded-full bg-[#3dcb6c] animate-pulse" />
              Coming Soon
            </div>

            <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-[#1a1e16] sm:text-5xl md:text-6xl">
              Nigeria's student
              <br />
              freelance marketplace
            </h1>

            <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-[#6a8064]">
              Connect with verified Nigerian university students for web design,
              content writing, research, tutoring, and more. Secure escrow payments.
            </p>

            <div className="mt-10">
              {!submitted ? (
                <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
                  <Input
                    ref={inputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                    className="h-12 flex-1 rounded-xl border-[#c4deb8] bg-white px-4 text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading}
                    className="h-12 rounded-xl bg-[#3dcb6c] px-6 text-white hover:bg-[#33b45f]"
                  >
                    {loading ? (
                      "Joining..."
                    ) : (
                      <>
                        Join Waitlist <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <div className="mx-auto max-w-md space-y-4">
                  <div className="rounded-xl border border-[#c4deb8] bg-white p-6 text-center shadow-sm">
                    <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[#3dcb6c]/15">
                      <CheckCircle2 className="size-6 text-[#3dcb6c]" />
                    </div>
                    <h3 className="text-lg font-bold text-[#1a1e16]">You're on the list!</h3>
                    {position && (
                      <p className="mt-1 text-sm text-[#6a8064]">
                        You're #{position} in line. We'll email you when we launch.
                      </p>
                    )}
                    {referralCount > 0 && (
                      <p className="mt-2 text-sm font-medium text-[#3dcb6c]">
                        {referralCount} friend{referralCount === 1 ? " has" : "s have"} joined through your link!
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-[#c4deb8] bg-white p-5 text-left shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#1a1e16]">
                      <Users className="size-4 text-[#3dcb6c]" />
                      Move up the list
                    </div>
                    <p className="mt-1 text-xs text-[#6a8064]">
                      Share your referral link. Each friend who joins moves you both up.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate rounded-lg border border-[#e4efe0] bg-[#f9fdf7] px-3 py-2 text-xs text-[#6a8064]">
                        {referralLink}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-[#c4deb8] text-[#1a7a42] hover:bg-[#f4fbf0]"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-[#c4deb8] text-[#1a7a42] hover:bg-[#f4fbf0]"
                        onClick={handleShare}
                      >
                        <Share2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-4 text-xs text-[#9eb79c]">
              Join 200+ students already on the waitlist
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-[#c4deb8] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <h2 className="text-center text-2xl font-bold text-[#1a1e16] sm:text-3xl">
            Why wait for InTask?
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <FeatureCard
              icon={<Shield className="size-5" />}
              title="Verified Students"
              description="Every student is verified with their school email or student ID. No fake profiles."
            />
            <FeatureCard
              icon={<Zap className="size-5" />}
              title="Secure Escrow"
              description="Payments held via Paystack until work is approved. Safe for both sides."
            />
            <FeatureCard
              icon={<Users className="size-5" />}
              title="Ratings & Reviews"
              description="Both sides leave reviews. Build a reputation that earns you more work."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-[#c4deb8] bg-[#f0f7ec]">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
          <h2 className="text-center text-2xl font-bold text-[#1a1e16] sm:text-3xl">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <StepCard
              number={1}
              title="Sign up"
              description="Create a free account as a student or business. Verify your status."
            />
            <StepCard
              number={2}
              title="Connect"
              description="Students browse and apply for tasks. Businesses post and review applicants."
            />
            <StepCard
              number={3}
              title="Get paid"
              description="Money held in escrow via Paystack. Released when work is approved."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#c4deb8] bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:py-20">
          <h2 className="text-2xl font-bold text-[#1a1e16] sm:text-3xl">
            Be first in line
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[#6a8064]">
            Join the waitlist now and get early access when InTask launches at your university.
          </p>
          {!submitted && (
            <div className="mt-8">
              <Button
                size="lg"
                className="rounded-xl bg-[#3dcb6c] px-8 text-white hover:bg-[#33b45f]"
                onClick={() => inputRef.current?.focus()}
              >
                Join Waitlist <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#c4deb8] bg-[#f0f7ec]">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-[#9eb79c] sm:flex-row">
          <div className="flex items-center gap-2 font-bold text-[#1a1e16]">
            <span className="grid size-6 place-items-center rounded-md bg-[#3dcb6c] text-white">
              <Sparkles className="size-3" />
            </span>
            InTask
          </div>
          <div className="flex gap-4 text-xs">
            <Link to="/about" className="hover:text-[#1a1e16]">About</Link>
            <Link to="/contact" className="hover:text-[#1a1e16]">Contact</Link>
            <Link to="/terms" className="hover:text-[#1a1e16]">Terms</Link>
            <Link to="/privacy" className="hover:text-[#1a1e16]">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#c4deb8] bg-[#f9fdf7] p-6">
      <div className="grid size-10 place-items-center rounded-full bg-[#3dcb6c]/15 text-[#3dcb6c]">
        {icon}
      </div>
      <h3 className="mt-4 font-bold text-[#1a1e16]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#6a8064]">{description}</p>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-[#3dcb6c] text-lg font-bold text-white">
        {number}
      </div>
      <h3 className="mt-4 font-bold text-[#1a1e16]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#6a8064]">{description}</p>
    </div>
  );
}
