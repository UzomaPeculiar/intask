import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { naira } from "@/lib/format";
import { ShieldCheck, ArrowLeft, Loader2, Wallet, CreditCard } from "lucide-react";
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
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "paystack">("wallet");

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

  const { data: wallet } = useQuery({
    queryKey: ["wallet-balance", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

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

  const total = task ? Number(task.budget) : 0;
  const walletBalance = Number(wallet?.balance ?? 0);
  const walletContribution = Math.min(walletBalance, total);
  const shortfall = Math.max(0, total - walletContribution);

  const canSubmit = !busy && !!user && !!isAccepted;

  const cta = (() => {
    if (paymentMethod === "wallet") {
      if (shortfall <= 0) {
        return {
          label: "Fund Escrow Instantly",
          disabled: !canSubmit,
          onClick: () => pay("wallet_only"),
        };
      }

      return {
        label: payReady ? `Use Wallet + Pay ${naira(shortfall)}` : "Loading Paystack...",
        disabled: !canSubmit || !payReady,
        onClick: () => pay("wallet_plus_paystack"),
      };
    }

    return {
      label: payReady ? `Pay ${naira(total)} with Paystack` : "Loading Paystack...",
      disabled: !canSubmit || !payReady,
      onClick: () => pay("paystack_only"),
    };
  })();

  async function pay(mode: "paystack_only" | "wallet_only" | "wallet_plus_paystack") {
    if (!task) return;
    setBusy(true);
    try {
      const result = await init({ data: { taskId, mode } });

      if (result?.fundedInstantly) {
        toast.success("Escrow funded instantly");
        nav({ to: "/app/tasks/$taskId", params: { taskId } });
        return;
      }

      if (!keyData?.publicKey) {
        throw new Error("Paystack is not configured");
      }

      const reference = result.reference;
      const paystackAmount = Number(result?.paystackAmount ?? total);
      const paystack = getPaystack();
      const popup = paystack.setup({
        key: keyData.publicKey,
        email: user?.email ?? (await supabase.auth.getUser()).data.user?.email ?? "",
        amount: Math.round(paystackAmount * 100),
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
    <div className="min-h-screen bg-[#eff8ea] text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="mx-auto w-full max-w-[640px] px-6 pb-40 pt-7 sm:px-12">
        <button
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else nav({ to: "/app/tasks/$taskId", params: { taskId } });
          }}
          aria-label="Back"
          className="mb-4 inline-flex size-9 items-center justify-center rounded-full border border-[#c4deb8] bg-white"
        >
          <ArrowLeft className="size-4 text-[#1a1e16]" />
        </button>

        <h1 className="font-['Space_Grotesk',sans-serif] text-[1.5rem] font-bold text-[#1a1e16]">Fund escrow</h1>
        <p className="mt-1 text-[0.85rem] leading-[1.5] text-[#6a8064]">Pay safely to lock in this student. Money is only released after you approve the work.</p>

        <div className="mt-6 rounded-[18px] border border-[#c4deb8] bg-white p-7 shadow-[0_18px_50px_-24px_rgba(37,99,235,0.32)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Task amount</p>
          <p className="mt-1.5 font-['Space_Grotesk',sans-serif] text-[2rem] font-bold text-[#1a1e16]">{naira(total)}</p>

          <div className="my-5 h-px bg-[#e4efe0]" />

          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Wallet</p>
          <p className="mt-1 text-[0.85rem] text-[#1a1e16]">
            Balance: <span className="font-semibold">{naira(walletBalance)}</span>
          </p>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("wallet")}
              className={`flex w-full items-center gap-3 rounded-[12px] border p-[14px] text-left transition-all ${paymentMethod === "wallet" ? "border-[#3dcb6c] bg-[rgba(61,203,108,0.04)]" : "border-[#e4efe0] hover:border-[#c4deb8] hover:bg-[#f9fdf7]"}`}
            >
              <span className={`flex size-[18px] items-center justify-center rounded-full border-2 ${paymentMethod === "wallet" ? "border-[#3dcb6c]" : "border-[#c4deb8]"}`}>
                {paymentMethod === "wallet" ? <span className="size-2 rounded-full bg-[#3dcb6c]" /> : null}
              </span>
              <span className="flex-1">
                <span className="block text-[0.85rem] font-semibold text-[#1a1e16]">Use Wallet</span>
                <span className="mt-0.5 block text-[0.7rem] text-[#6a8064]">
                  {shortfall <= 0 ? "Pay instantly from your wallet balance" : `Use ${naira(walletContribution)} from wallet`}
                </span>
              </span>
              <Wallet className="size-5 text-[#1a7a42]" />
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("paystack")}
              className={`flex w-full items-center gap-3 rounded-[12px] border p-[14px] text-left transition-all ${paymentMethod === "paystack" ? "border-[#3dcb6c] bg-[rgba(61,203,108,0.04)]" : "border-[#e4efe0] hover:border-[#c4deb8] hover:bg-[#f9fdf7]"}`}
            >
              <span className={`flex size-[18px] items-center justify-center rounded-full border-2 ${paymentMethod === "paystack" ? "border-[#3dcb6c]" : "border-[#c4deb8]"}`}>
                {paymentMethod === "paystack" ? <span className="size-2 rounded-full bg-[#3dcb6c]" /> : null}
              </span>
              <span className="flex-1">
                <span className="block text-[0.85rem] font-semibold text-[#1a1e16]">Pay with Card/Bank</span>
                <span className="mt-0.5 block text-[0.7rem] text-[#6a8064]">Powered by Paystack — secure card or bank transfer</span>
              </span>
              <CreditCard className="size-5 text-[#1a7a42]" />
            </button>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-[10px] border border-[#c4deb8] bg-[#f4fbf0] p-[14px] text-[0.75rem] leading-[1.5] text-[#6a8064]">
            <ShieldCheck className="mt-[1px] size-4 shrink-0 text-[#1a7a42]" />
            <span>Funds are held by InTask via Paystack escrow. You stay in control — if the work isn't delivered, request a revision or open a dispute.</span>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-[#e4efe0] bg-white px-6 py-4 lg:bottom-0 lg:px-12">
        <div className="mx-auto w-full max-w-[640px]">
          <Button
            onClick={cta.onClick}
            disabled={cta.disabled}
            className="h-12 w-full rounded-[10px] bg-[#3dcb6c] text-[0.9rem] font-semibold text-white hover:bg-[#35b860]"
          >
            {busy ? "Processing..." : cta.label}
          </Button>

          {paymentMethod === "wallet" && shortfall > 0 ? (
            <Button
              variant="ghost"
              className="mt-2 h-9 w-full text-[0.78rem] font-medium text-[#1a7a42] hover:bg-[#f4fbf0]"
              onClick={() => nav({ to: "/app/wallet" as any })}
              disabled={busy || !user || !isAccepted}
            >
              Top Up Wallet Instead
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
