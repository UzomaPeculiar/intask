import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Share2,
  Users,
  Wallet,
  CheckCircle2,
  Gift,
  ExternalLink,
} from "lucide-react";
import { getMyReferralCode, getMyReferralStats } from "@/lib/referral.functions";

export const Route = createFileRoute("/app/referrals")({
  head: () => ({ meta: [{ title: "Referrals — InTask" }] }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const getCode = useServerFn(getMyReferralCode);
  const getStats = useServerFn(getMyReferralStats);

  const { data: codeData, isLoading: codeLoading } = useQuery({
    queryKey: ["my-referral-code"],
    queryFn: () => getCode(),
  });

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["my-referral-stats"],
    queryFn: () => getStats(),
  });

  const [copied, setCopied] = useState(false);

  const referralCode = codeData?.code ?? "";
  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/signup?ref=${referralCode}`;
  const totalReferrals = statsData?.totalReferrals ?? 0;
  const totalEarned = statsData?.totalEarned ?? 0;
  const referrals = statsData?.referrals ?? [];

  function copyCode() {
    navigator.clipboard.writeText(referralCode).then(() => {
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(referralLink).then(() => {
      toast.success("Referral link copied!");
    });
  }

  function shareLink() {
    if (navigator.share) {
      navigator.share({
        title: "Join InTask",
        text: "Sign up on InTask using my referral code and earn a welcome bonus!",
        url: referralLink,
      });
    } else {
      copyLink();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link to="/app">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-sm font-semibold text-foreground">
            Referral Program
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 p-4 pb-24">
        {/* Hero card */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15 text-primary">
            <Gift className="size-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            Invite friends, earn rewards
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share your referral code. When a friend signs up and completes
            their first task, you both earn wallet credit.
          </p>

          {/* Referral code */}
          {codeLoading ? (
            <div className="mx-auto mt-5 h-12 w-48 animate-pulse rounded-xl bg-muted" />
          ) : (
            <div className="mx-auto mt-5 flex max-w-xs items-center gap-2">
              <div className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-foreground">
                {referralCode}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={copyCode}
              >
                {copied ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          )}

          {/* Share buttons */}
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
              <ExternalLink className="size-3.5" />
              Copy link
            </Button>
            <Button size="sm" className="gap-1.5" onClick={shareLink}>
              <Share2 className="size-3.5" />
              Share
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<Users className="size-4" />}
            label="Referrals"
            value={statsLoading ? "..." : String(totalReferrals)}
          />            <StatCard
            icon={<Wallet className="size-4" />}
            label="Earned"
            value={statsLoading ? "..." : `₦${totalEarned.toLocaleString("en-NG")}`}
          />
          <StatCard
            icon={<CheckCircle2 className="size-4" />}
            label="Credited"
            value={statsLoading ? "..." : String(statsData?.creditedCount ?? 0)}
          />
        </div>

        {/* How it works */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">How it works</h3>
          <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                1
              </span>
              <span>
                Share your referral code or link with friends who need student
                talent or want to earn on InTask.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                2
              </span>                <span>
                They sign up using your code during registration.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                3
              </span>
              <span>
                Once they complete their first task, you both receive wallet
                credit automatically.
              </span>
            </li>
          </ol>
        </div>

        {/* Referral list */}
        {totalReferrals > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">
              Your referrals
            </h3>
            <div className="mt-3 space-y-3">
              {referrals.map((r: any) => (
                <div
                  key={r.referred_id}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {r.referred_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("en-NG", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-success">
                      +₦{Number(r.referrer_credit).toLocaleString("en-NG")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.credited ? "Credited" : "Pending — awaiting first task"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="mx-auto grid size-8 place-items-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
