import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/format";
import { ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getPaystackPublicKey, initEscrow, verifyEscrow } from "@/lib/paystack.functions";

function getPaystack() {
  const ps = (window as any).PaystackPop ?? (window as any).Paystack;
  if (!ps || typeof ps.setup !== "function") {
    throw new Error("Paystack is not loaded. Please refresh the page and try again.");
  }
  return ps;
}

declare global {
  interface Window { PaystackPop?: any }
}

export const Route = createFileRoute("/app/payment/$taskId")({
  head: () => ({ meta: [{ title: "Fund escrow — InTask" }] }),
  component: PaymentPage,
});

function PaymentPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const init = useServerFn(initEscrow);
  const verify = useServerFn(verifyEscrow);
  const getKey = useServerFn(getPaystackPublicKey);
  const [busy, setBusy] = useState(false);

  // Handle Paystack redirect back with ?reference=... (redirect flow)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
    if (!ref) return;
    setBusy(true);
    verify({ data: { reference: ref } })
      .then(() => {
        toast.success("Payment confirmed — escrow funded");
        nav({ to: "/app/tasks/$taskId", params: { taskId } });
      })
      .catch((e: any) => {
        toast.error(e?.message ?? "Payment could not be confirmed. Please contact support.");
        setBusy(false);
      });
  }, []);

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () =>
      (await supabase.from("tasks").select("id,title,budget,poster_id,matched_student_id,status").eq("id", taskId).single()).data,
  });

  const { data: keyData } = useQuery({
    queryKey: ["paystack-key"],
    queryFn: () => getKey(),
  });

  const { user } = useAuth();
  const [paystackReady, setPaystackReady] = useState(false);
  const isAccepted = task?.status === "matched" && !!task?.matched_student_id;
  const payReady = !!keyData?.publicKey && paystackReady;
  const disabled = busy || !user || !isAccepted || !payReady;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ((window as any).PaystackPop || (window as any).Paystack) {
      setPaystackReady(true);
      return;
    }

    const existingScript = document.getElementById("paystack-inline") as HTMLScriptElement | null;
    if (existingScript) {
      if (existingScript.getAttribute("data-loaded") === "true") {
        setPaystackReady(true);
      } else {
        existingScript.addEventListener("load", () => {
          existingScript.setAttribute("data-loaded", "true");
          setPaystackReady(true);
        });
      }
      return;
    }

    const s = document.createElement("script");
    s.id = "paystack-inline";
    s.src = "https://js.paystack.co/v2/inline.js";
    s.async = true;
    s.onload = () => {
      s.setAttribute("data-loaded", "true");
      setPaystackReady(true);
    };
    document.body.appendChild(s);
  }, []);

  const fee = task ? Number(task.budget) * 0.08 : 0;
  const total = task ? Number(task.budget) : 0;

  async function pay() {
    if (!task || !keyData?.publicKey) return;
    setBusy(true);
    try {
      const { reference } = await init({ data: { taskId } });
      const paystack = getPaystack();
      const popup = paystack.setup({
        key: keyData.publicKey,
        email: user?.email ?? (await supabase.auth.getUser()).data.user?.email ?? "",
        amount: Math.round(total * 100),
        currency: "NGN",
        reference,
        onSuccess: async (trx: any) => {
          try {
            await verify({ data: { reference: trx?.reference ?? reference } });
            toast.success("Payment confirmed — escrow funded");
            nav({ to: "/app/tasks/$taskId", params: { taskId } });
          } catch (e: any) {
            toast.error(e?.message ?? "Payment could not be confirmed. Please contact support.");
            setBusy(false);
          }
        },
        onCancel: () => {
          toast.message("Payment cancelled — you can try again");
          setBusy(false);
        },
      });
      popup.openIframe();
    } catch (e: any) {
      toast.error(e.message ?? "Could not start payment");
      setBusy(false);
    }
  }

  if (!task) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  }

  return (
    <div className="mx-auto max-w-md pb-32">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => nav({ to: "/app/tasks/$taskId", params: { taskId } })} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm">
          <ArrowLeft className="size-4" />
        </button>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Fund escrow</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pay safely to lock in this student. Money is only released after you approve the work.</p>

        <div className="mt-6 rounded-3xl border border-border/80 bg-card/90 p-5 shadow-[0_18px_50px_-24px_rgba(37,99,235,0.32)]">
          <p className="text-xs font-medium text-muted-foreground">Task</p>
          <p className="mt-0.5 font-medium">{task.title}</p>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <Row label="Task amount" value={naira(total)} />
            <Row label="Platform fee (8%)" value={`-${naira(fee)}`} sub="Deducted from student payout" />
            <div className="my-2 h-px bg-border" />
            <Row label="You pay today" value={naira(total)} bold />
            <Row label="Student receives on approval" value={naira(total - fee)} sub="After your approval, paid to their Paystack-linked account" />
          </div>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
          Funds are held by InTask via Paystack escrow. You stay in control — if the work isn't delivered, request a revision or open a dispute.
        </p>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button size="lg" className="w-full" disabled={disabled} onClick={pay}>
            {busy ? "Opening Paystack…" : `Pay ${naira(total)} into escrow`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, sub, bold }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <span className={bold ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
