import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Zap, Star, Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/subscription")({
  head: () => ({ meta: [{ title: "Subscription — InTask" }] }),
  component: SubscriptionPage,
});

function SubscriptionPage() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("subscription_plans")
        .select("*")
        .order("price", { ascending: true });
      return data ?? [];
    },
  });

  const { data: currentSub } = useQuery({
    queryKey: ["my-subscription", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("company_id", me!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const subscribe = useMutation({
    mutationFn: async (plan: any) => {
      if (!me) throw new Error("Not signed in");
      if (plan.price === 0) {
        const { error } = await (supabase as any)
          .from("company_subscriptions")
          .upsert({
            company_id: me.id,
            plan_id: plan.id,
            status: "active",
            started_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
        if (error) throw error;
        return;
      }

      const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
      if (!paystackKey) throw new Error("Payment not configured");

      return new Promise((resolve, reject) => {
        const handler = (window as any).PaystackPop.setup({
          key: paystackKey,
          email: me.email ?? "",
          amount: plan.price * 100,
          currency: "NGN",
          ref: `sub_${me.id}_${Date.now()}`,
          callback: async (response: any) => {
            const { error } = await (supabase as any)
              .from("company_subscriptions")
              .upsert({
                company_id: me.id,
                plan_id: plan.id,
                status: "active",
                started_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                paystack_reference: response.reference,
              });
            if (error) reject(error);
            else resolve(response);
          },
          onClose: () => reject(new Error("Payment cancelled")),
        });

        if (!handler) {
          reject(new Error("Paystack not loaded. Please refresh and try again."));
          return;
        }
        handler.openIframe();
      });
    },
    onSuccess: (result: any) => {
      if (result?.free) {
        toast.success("Free plan activated");
      } else {
        toast.success("Subscription activated successfully");
      }
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: (e: any) => {
      if (e.message === "Payment cancelled") return;
      toast.error(e.message ?? "Could not process subscription");
    },
  });  

  const planIcons = [Building2, Zap, Star];
  const planColors = [
    "border-border",
    "border-primary",
    "border-warning",
  ];
  const planBg = [
    "bg-card",
    "bg-primary/5",
    "bg-warning/5",
  ];

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">Subscription Plans</h1>
      </header>

      {currentSub && (
        <div className="mx-4 mt-4 rounded-xl border border-success/30 bg-success/10 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-success" />
            <div>
              <p className="text-sm font-semibold text-success">Current plan: {currentSub.plan?.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Expires {new Date(currentSub.expires_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4">
        <p className="text-sm text-muted-foreground">
          Upgrade your plan to post more tasks, feature listings, and search our verified student talent pool directly.
        </p>

        {plans?.map((plan: any, i: number) => {
          const Icon = planIcons[i] ?? Building2;
          const isCurrentPlan = currentSub?.plan_id === plan.id;
          const isFree = plan.price === 0;

          return (
            <div key={plan.id} className={`rounded-xl border-2 ${planColors[i]} ${planBg[i]} p-5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`grid size-9 place-items-center rounded-lg ${i === 0 ? "bg-muted" : i === 1 ? "bg-primary/15" : "bg-warning/15"}`}>
                    <Icon className={`size-5 ${i === 0 ? "text-muted-foreground" : i === 1 ? "text-primary" : "text-warning"}`} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    {i === 1 && <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Most popular</span>}
                    {i === 2 && <span className="text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">Best value</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-foreground">
                    {isFree ? "Free" : `₦${Number(plan.price).toLocaleString("en-NG")}`}
                  </p>
                  {!isFree && <p className="text-xs text-muted-foreground">per month</p>}
                </div>
              </div>

              <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>

              <ul className="mt-4 space-y-2">
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-success shrink-0" />
                  {plan.max_active_posts === 999 ? "Unlimited active posts" : `${plan.max_active_posts} active task posts`}
                </li>
                {plan.featured_posts > 0 && (
                  <li className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    {plan.featured_posts} featured listing{plan.featured_posts === 1 ? "" : "s"} per month
                  </li>
                )}
                {plan.can_search_talent && (
                  <li className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    Direct talent search
                  </li>
                )}
                {plan.priority_support && (
                  <li className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    Priority support
                  </li>
                )}
                <li className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-success shrink-0" />
                  Secure escrow payments
                </li>
              </ul>

              <Button
                className="mt-5 w-full"
                variant={isCurrentPlan ? "outline" : i === 2 ? "default" : "default"}
                disabled={isCurrentPlan || subscribe.isPending}
                onClick={() => subscribe.mutate(plan)}
              >
                {isCurrentPlan ? "Current plan" : isFree ? "Get started free" : `Subscribe for ₦${Number(plan.price).toLocaleString("en-NG")}/mo`}
              </Button>
            </div>
          );
        })}

        <p className="text-center text-xs text-muted-foreground pt-2">
          All plans include secure Paystack escrow payments and access to verified Nigerian students.
          Cancel anytime.
        </p>
      </div>
    </div>
  );
}