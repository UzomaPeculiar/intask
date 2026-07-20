import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Star, Briefcase, GraduationCap, Search, Award, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/alumni-pro")({
  head: () => ({ meta: [{ title: "InTask Alumni Pro — InTask" }] }),
  component: AlumniProPage,
});

const ALUMNI_PRO_PRICE = 2500;

const PRO_FEATURES = [
  { icon: Briefcase, title: "Unlimited task applications", body: "Apply for as many tasks as you want with no restrictions." },
  { icon: Star, title: "Priority profile visibility", body: "Your profile appears higher in search results and task recommendations." },
  { icon: Search, title: "Talent search access", body: "Search and connect with students directly for collaboration." },
  { icon: GraduationCap, title: "Mentorship tools", body: "Full access to offer and manage paid mentorship sessions." },
  { icon: Award, title: "Pro badge on profile", body: "Stand out with a verified Alumni Pro badge visible to all employers." },
  { icon: Users, title: "Team task leadership", body: "Lead team tasks and earn more by coordinating other students." },
];

function AlumniProPage() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: currentSub } = useQuery({
    queryKey: ["alumni-pro-sub", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("alumni_pro_subscriptions")
        .select("*")
        .eq("alumni_id", me!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const subscribe = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      if (!(window as any).PaystackPop) throw new Error("Paystack not loaded. Please refresh.");

      return new Promise<any>((resolve, reject) => {
        const ref = `alumni_pro_${me.id}_${Date.now()}`;
        const handler = (window as any).PaystackPop.setup({
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: me.email ?? "",
          amount: ALUMNI_PRO_PRICE * 100,
          currency: "NGN",
          ref,
          callback: function(response: any) {
            (supabase as any)
              .from("alumni_pro_subscriptions")
              .upsert({
                alumni_id: me.id,
                status: "active",
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                paystack_reference: response.reference,
              }, { onConflict: "alumni_id" })
              .then(({ error }: any) => {
                if (error) reject(error);
                else resolve(response);
              });
          },
          onClose: function() {
            toast.error("Payment cancelled");
          },
        });
        handler.openIframe();
      });
    },
    onSuccess: async () => {
      toast.success("Welcome to Alumni Pro!");
      await new Promise((r) => setTimeout(r, 1000));
      qc.invalidateQueries({ queryKey: ["alumni-pro-sub"] });
      qc.refetchQueries({ queryKey: ["alumni-pro-sub", me?.id] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not process subscription"),
  });

  const cancel = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("alumni_pro_subscriptions")
        .update({ status: "cancelled" })
        .eq("alumni_id", me.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subscription cancelled. You will retain access until expiry.");
      qc.invalidateQueries({ queryKey: ["alumni-pro-sub"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not cancel subscription"),
  });

  const isActive = !!currentSub;
  const expiresAt = currentSub?.expires_at ? new Date(currentSub.expires_at) : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">Alumni Pro</h1>
      </header>

      <div className="px-4 pt-4 space-y-5">
        {isActive ? (
          <div className="rounded-xl border-2 border-warning/50 bg-gradient-to-br from-warning/10 to-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-6 text-warning" />
              <p className="font-semibold text-foreground">Alumni Pro — Active</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Your subscription is active with <span className="font-medium text-foreground">{daysLeft} days</span> remaining.
            </p>
            {expiresAt && (
              <p className="text-xs text-muted-foreground mt-1">
                Renews on {expiresAt.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => nav({ to: "/app/talent" as any })}
              >
                Search talent
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30"
                disabled={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                Cancel plan
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-warning/50 bg-gradient-to-br from-warning/10 to-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Award className="size-5 text-warning" />
                  <p className="font-semibold text-foreground">InTask Alumni Pro</p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Everything you need to keep growing after graduation</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-foreground">₦{ALUMNI_PRO_PRICE.toLocaleString("en-NG")}</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
            </div>
            <Button
              className="w-full mt-4 bg-warning text-warning-foreground hover:bg-warning/90"
              size="lg"
              disabled={subscribe.isPending}
              onClick={() => subscribe.mutate()}
            >
              {subscribe.isPending ? "Processing..." : "Upgrade to Alumni Pro"}
            </Button>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">What you get with Alumni Pro</h2>
          <div className="space-y-3">
            {PRO_FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                <div className="grid size-8 place-items-center rounded-lg bg-warning/15 shrink-0">
                  <Icon className="size-4 text-warning" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
                </div>
                <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Free vs Pro</h2>
          <div className="space-y-2">
            {[
              { feature: "Apply for tasks", free: true, pro: true },
              { feature: "Post tasks", free: true, pro: true },
              { feature: "Offer mentorship", free: true, pro: true },
              { feature: "Priority profile visibility", free: false, pro: true },
              { feature: "Talent search", free: false, pro: true },
              { feature: "Alumni Pro badge", free: false, pro: true },
              { feature: "Team task leadership", free: false, pro: true },
            ].map(({ feature, free, pro }) => (
              <div key={feature} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                <p className="text-xs text-muted-foreground">{feature}</p>
                <div className="flex gap-6">
                  <span className="text-xs w-8 text-center">{free ? "✅" : "❌"}</span>
                  <span className="text-xs w-8 text-center">{pro ? "✅" : "❌"}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-6 pt-1">
              <span className="text-xs font-medium text-muted-foreground w-8 text-center">Free</span>
              <span className="text-xs font-medium text-warning w-8 text-center">Pro</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Cancel anytime. No hidden fees. Payments secured by Paystack.
        </p>
      </div>
    </div>
  );
}