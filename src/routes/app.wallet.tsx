import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/intask/EmptyState";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, Clock,
  CheckCircle2, AlertTriangle, Plus, Trash2, Building2, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/wallet")({
  head: () => ({ meta: [{ title: "Wallet — InTask" }] }),
  component: WalletPage,
});

const SUPABASE_BASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ??
  ((import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined)
    ? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
    : "");
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_BASE_URL.replace(/\/$/, "")}/functions/v1`;
const WITHDRAWAL_FEE = 50;

function WalletPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [fundAmount, setFundAmount] = useState("");
  const [fundOpen, setFundOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [addBankOpen, setAddBankOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [pendingFundingRef, setPendingFundingRef] = useState<string | null>(null);
  const [walletTab, setWalletTab] = useState<"overview" | "activity">("overview");

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: wallet, refetch: refetchWallet } = useQuery({
    queryKey: ["wallet", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("wallets")
        .select("*")
        .eq("user_id", me!.id)
        .maybeSingle();
      if (!data) {
        const { data: newWallet } = await (supabase as any)
          .from("wallets")
          .insert({ user_id: me!.id, balance: 0, total_earned: 0, total_withdrawn: 0 })
          .select("*")
          .single();
        return newWallet;
      }
      return data;
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["wallet-transactions", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const { data: bankAccounts, refetch: refetchBanks } = useQuery({
    queryKey: ["bank-accounts", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bank_accounts")
        .select("*")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: banks } = useQuery({
    queryKey: ["paystack-banks"],
    queryFn: async () => {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/list-banks`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error ?? "Could not load banks");
      return data.banks ?? [];
    },
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["withdrawals", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("withdrawal_requests")
        .select("*")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  async function verifyAccountNumber() {
    if (!accountNumber || accountNumber.length !== 10 || !bankCode) {
      toast.error("Enter a 10-digit account number and select a bank");
      return;
    }
    setVerifyingAccount(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/verify-account`, { 
        method: "POST", 
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ account_number: accountNumber, bank_code: bankCode }),
      });

      const data = await res.json();

      if ((data.success || data.status) && data.account_name) {
        setAccountName(data.account_name);
        toast.success(`Account verified: ${data.account_name}`);
      } else {
        toast.error(data.error ?? data.message ?? "Could not verify account. Please check the details.");
        setAccountName("");
      }
    } catch {
      toast.error("Verification failed. Please try again.");
    }
    setVerifyingAccount(false);
  }

  const addBank = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      if (!accountName) throw new Error("Please verify your account number first");

      const { data: bankAccount, error } = await (supabase as any)
        .from("bank_accounts")
        .insert({
          user_id: me.id,
          bank_name: bankName,
          bank_code: bankCode,
          account_number: accountNumber,
          account_name: accountName,
          is_default: (bankAccounts?.length ?? 0) === 0,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") throw new Error("This account is already saved");
        throw error;
      }

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const recipientRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-recipient`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bank_account_id: bankAccount.id,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          bank_code: bankCode,
        }),
      });

      const recipientData = await recipientRes.json();
      if (!recipientData.success) throw new Error(recipientData.error ?? "Could not register bank with Paystack");

      const { error: updateError } = await (supabase as any)
        .from("bank_accounts")
        .update({ paystack_recipient_code: recipientData.recipient_code, verified: true })
        .eq("id", bankAccount.id)
        .eq("user_id", me.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Bank account added successfully");
      setAddBankOpen(false);
      setBankCode(""); setBankName(""); setAccountNumber(""); setAccountName("");
      refetchBanks();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeBank = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("bank_accounts").delete().eq("id", id).eq("user_id", me!.id);
    },
    onSuccess: () => { toast.success("Bank account removed"); refetchBanks(); },
  });

  const setDefaultBank = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("bank_accounts").update({ is_default: false }).eq("user_id", me!.id);
      await (supabase as any).from("bank_accounts").update({ is_default: true }).eq("id", id);
    },
    onSuccess: () => { toast.success("Default bank updated"); refetchBanks(); },
  });

  const fundWallet = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      const amount = Number(fundAmount);
      if (amount < 100) throw new Error("Minimum funding amount is ₦100");
      if (!SUPABASE_BASE_URL) throw new Error("Supabase URL is not configured");

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/fund-wallet`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Could not initiate funding");
      return data;
    },
    onSuccess: (data) => {
      setFundOpen(false);
      window.open(data.authorization_url, "_blank");
      localStorage.setItem("pendingWalletFundingRef", data.reference);
      setPendingFundingRef(data.reference);
      toast.success("Complete your payment in the new tab. We'll verify and credit your wallet automatically.");
      setTimeout(() => { refetchWallet(); qc.invalidateQueries({ queryKey: ["wallet-transactions"] }); }, 3000);
    },
    onError: (e: any) => toast.error(e.message),
  });

  useEffect(() => {
    if (pendingFundingRef) return;
    const storedRef = localStorage.getItem("pendingWalletFundingRef");
    if (storedRef) setPendingFundingRef(storedRef);
  }, [pendingFundingRef]);

  useEffect(() => {
    if (!pendingFundingRef || !me?.id) return;

    let attempts = 0;
    let stopped = false;
    let hadVerifyError = false;
    let notifiedLongWait = false;

    const timer = window.setInterval(async () => {
      if (stopped) return;
      attempts += 1;
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) throw new Error("Session expired. Please sign in again.");

        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/verify-wallet-funding`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ reference: pendingFundingRef }),
        });

        const result = await res.json();

        if (!res.ok || result?.success === false) {
          if (result?.pending) {
            if (!notifiedLongWait && attempts >= 25) {
              notifiedLongWait = true;
              toast.message(result?.message ?? "Payment received. Verification is still in progress and can take a few minutes.");
            }
          } else {
            hadVerifyError = true;
            stopped = true;
            window.clearInterval(timer);
            toast.error(result?.error ?? result?.message ?? "Wallet funding verification failed");
            return;
          }
        }

        if (result?.credited || result?.alreadyProcessed) {
          stopped = true;
          window.clearInterval(timer);
          localStorage.removeItem("pendingWalletFundingRef");
          setPendingFundingRef(null);
          refetchWallet();
          qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
          toast.success(`Wallet funded successfully: ₦${Number(result.amount ?? 0).toLocaleString("en-NG")}`);
          return;
        }

        if (result && result.pending === false && result.message) {
          hadVerifyError = true;
          stopped = true;
          window.clearInterval(timer);
          toast.error(result.message);
          return;
        }

        // Keep waiting for pending verifications; some settlements are delayed.
        if (!notifiedLongWait && attempts >= 25) {
          notifiedLongWait = true;
          toast.message("Payment received. Verification is still in progress and can take a few minutes.");
        }
      } catch (error: any) {
        hadVerifyError = true;
        if (attempts >= 3) {
          stopped = true;
          window.clearInterval(timer);
          toast.error(error?.message ?? "Could not verify wallet funding yet. Please refresh in a moment.");
        }
      }

      if (attempts >= 75) {
        stopped = true;
        window.clearInterval(timer);
        if (!hadVerifyError) {
          toast.message("Still verifying your wallet top-up. You can keep using the app and this page will retry when reopened.");
        }
      }
    }, 4000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [pendingFundingRef, me?.id, qc, refetchWallet]);

  const withdraw = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      const amount = Number(withdrawAmount);
      if (amount < 550) throw new Error("Minimum withdrawal is ₦550");
      if (!selectedBankAccountId) throw new Error("Please select a bank account");
      if (amount > (wallet?.balance ?? 0)) throw new Error("Insufficient wallet balance");

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/initiate-withdrawal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, bank_account_id: selectedBankAccountId }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Withdrawal failed");
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Withdrawal initiated. ₦${Number(data.net_amount).toLocaleString()} will arrive shortly.`);
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setSelectedBankAccountId("");
      refetchWallet();
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const withdrawAmountNum = Number(withdrawAmount);
  const netAmount = withdrawAmountNum > 0 ? withdrawAmountNum - WITHDRAWAL_FEE : 0;
  const pendingWithdrawals = withdrawals?.filter((w: any) => w.status === "pending") ?? [];
  const defaultBank = bankAccounts?.find((b: any) => b.is_default) ?? bankAccounts?.[0];

  useEffect(() => {
    if (!selectedBankAccountId && defaultBank?.id) {
      setSelectedBankAccountId(defaultBank.id);
    }
  }, [defaultBank?.id, selectedBankAccountId]);

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-lg font-semibold">My Wallet</h1>
        </div>
        <button onClick={() => { refetchWallet(); qc.invalidateQueries({ queryKey: ["wallet-transactions"] }); }} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <RefreshCw className="size-4 text-muted-foreground" />
        </button>
      </header>

      <div className="px-4 pt-4">
        <Tabs value={walletTab} onValueChange={(value) => setWalletTab(value as "overview" | "activity")}>
          <TabsList className="grid h-auto w-full grid-cols-2">
            <TabsTrigger value="overview" className="py-2.5">Overview</TabsTrigger>
            <TabsTrigger value="activity" className="py-2.5">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-3">
            <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
              <div className="mb-1 flex items-center gap-2">
                <Wallet className="size-5 opacity-80" />
                <p className="text-sm opacity-80">Available balance</p>
              </div>
              <p className="text-4xl font-bold">₦{Number(wallet?.balance ?? 0).toLocaleString("en-NG")}</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/15 p-3">
                  <p className="text-xs opacity-70">Total earned</p>
                  <p className="mt-0.5 text-sm font-semibold">₦{Number(wallet?.total_earned ?? 0).toLocaleString("en-NG")}</p>
                </div>
                <div className="rounded-xl bg-white/15 p-3">
                  <p className="text-xs opacity-70">Total withdrawn</p>
                  <p className="mt-0.5 text-sm font-semibold">₦{Number(wallet?.total_withdrawn ?? 0).toLocaleString("en-NG")}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
          <Sheet open={fundOpen} onOpenChange={setFundOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="size-4" /> Add money
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader className="text-left">
                <SheetTitle>Add money to wallet</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6 pt-2">
                <p className="text-sm text-muted-foreground">Fund your InTask wallet using your debit card or bank transfer via Paystack.</p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Amount (₦)</label>
                  <Input type="number" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} placeholder="e.g. 5000" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[1000, 5000, 10000].map((amt) => (
                    <button key={amt} onClick={() => setFundAmount(String(amt))} className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${fundAmount === String(amt) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
                <Button className="w-full" size="lg" disabled={!fundAmount || Number(fundAmount) < 100 || fundWallet.isPending} onClick={() => fundWallet.mutate()}>
                  {fundWallet.isPending ? "Processing..." : `Add ₦${fundAmount ? Number(fundAmount).toLocaleString() : "0"}`}
                </Button>
                <p className="text-center text-xs text-muted-foreground">Secured by Paystack. No fees for funding.</p>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={withdrawOpen} onOpenChange={setWithdrawOpen}>
            <SheetTrigger asChild>
              <Button className="gap-2" disabled={(wallet?.balance ?? 0) < 550}>
                <ArrowUpRight className="size-4" /> Withdraw
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle>Withdraw funds</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 px-4 pb-6 pt-2">
                <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                  Available: <span className="font-semibold text-foreground">₦{Number(wallet?.balance ?? 0).toLocaleString("en-NG")}</span>
                </div>

                {(bankAccounts?.length ?? 0) === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center">
                    <Building2 className="size-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">No bank account added</p>
                    <p className="text-xs text-muted-foreground mt-1">Add a bank account to withdraw funds</p>
                    <Button size="sm" className="mt-3" onClick={() => { setWithdrawOpen(false); setAddBankOpen(true); }}>
                      Add bank account
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Select bank account</label>
                      <div className="space-y-2">
                        {bankAccounts?.map((b: any) => (
                          <button
                            key={b.id}
                            onClick={() => setSelectedBankAccountId(b.id)}
                            className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${selectedBankAccountId === b.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}
                          >
                            <div className="grid size-9 place-items-center rounded-lg bg-muted shrink-0">
                              <Building2 className="size-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{b.account_name}</p>
                              <p className="text-xs text-muted-foreground">{b.bank_name} · {b.account_number}</p>
                            </div>
                            {b.verified && <CheckCircle2 className="size-4 text-success shrink-0" />}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => { setWithdrawOpen(false); setAddBankOpen(true); }} className="text-xs text-primary hover:underline">
                        + Add another bank account
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Amount (₦)</label>
                      <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Minimum ₦550" />
                    </div>

                    {withdrawAmountNum >= 550 && (
                      <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Withdrawal amount</span>
                          <span className="font-medium">₦{withdrawAmountNum.toLocaleString("en-NG")}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Processing fee</span>
                          <span className="font-medium text-destructive">-₦{WITHDRAWAL_FEE.toLocaleString("en-NG")}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                          <span className="font-semibold text-foreground">You receive</span>
                          <span className="font-semibold text-success">₦{netAmount.toLocaleString("en-NG")}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">New balance: ₦{Math.max(0, (wallet?.balance ?? 0) - withdrawAmountNum).toLocaleString("en-NG")}</p>
                      </div>
                    )}

                    <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                      <p>Double-check your account details. Funds sent to wrong accounts cannot be reversed.</p>
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      disabled={!withdrawAmountNum || withdrawAmountNum < 550 || !selectedBankAccountId || withdrawAmountNum > (wallet?.balance ?? 0) || withdraw.isPending}
                      onClick={() => withdraw.mutate()}
                    >
                      {withdraw.isPending ? "Processing..." : `Withdraw ₦${netAmount > 0 ? netAmount.toLocaleString("en-NG") : "0"}`}
                    </Button>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
            </div>

            {pendingWithdrawals.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
                <p className="flex items-center gap-1 text-sm font-medium text-warning">
                  <Clock className="size-4" /> {pendingWithdrawals.length} pending withdrawal{pendingWithdrawals.length === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ₦{pendingWithdrawals.reduce((s: number, w: any) => s + Number(w.net_amount ?? w.amount), 0).toLocaleString("en-NG")} being processed
                </p>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Bank accounts</h2>
                <button onClick={() => setAddBankOpen(true)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Plus className="size-3" /> Add
                </button>
              </div>

              {(!bankAccounts || bankAccounts.length === 0) && (
                <div className="rounded-xl border border-dashed border-border p-4 text-center">
                  <Building2 className="mx-auto mb-2 size-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No bank accounts yet</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => setAddBankOpen(true)}>Add bank account</Button>
                </div>
              )}

              <div className="space-y-2">
                {bankAccounts?.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="grid size-9 place-items-center rounded-lg bg-muted shrink-0">
                      <Building2 className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{b.account_name}</p>
                      <p className="text-xs text-muted-foreground">{b.bank_name} · {b.account_number}</p>
                      {b.is_default && <span className="text-[10px] font-medium text-primary">Default</span>}
                    </div>
                    <div className="flex gap-1">
                      {!b.is_default && (
                        <button onClick={() => setDefaultBank.mutate(b.id)} className="px-2 py-1 text-xs text-muted-foreground hover:text-primary">Set default</button>
                      )}
                      <button onClick={() => removeBank.mutate(b.id)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4 pt-3">
            {withdrawals && withdrawals.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-semibold text-foreground">Withdrawal history</h2>
                <div className="space-y-2">
                  {withdrawals.map((w: any) => (
                    <div key={w.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid size-9 place-items-center rounded-full shrink-0 ${w.status === "completed" ? "bg-success/15" : w.status === "pending" ? "bg-warning/15" : "bg-destructive/15"}`}>
                          {w.status === "completed" ? <CheckCircle2 className="size-4 text-success" /> : w.status === "pending" ? <Clock className="size-4 text-warning" /> : <AlertTriangle className="size-4 text-destructive" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{w.bank_name}</p>
                          <p className="text-xs text-muted-foreground">{w.account_number} · {new Date(w.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</p>
                          {w.failure_reason && <p className="text-xs text-destructive">{w.failure_reason}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">₦{Number(w.net_amount ?? w.amount).toLocaleString("en-NG")}</p>
                        <p className={`text-xs capitalize font-medium ${w.status === "completed" ? "text-success" : w.status === "pending" ? "text-warning" : "text-destructive"}`}>{w.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="mb-3 text-sm font-semibold text-foreground">Transaction history</h2>
              {(!transactions || transactions.length === 0) && (
                <EmptyState icon={Wallet} title="No transactions yet" description="Complete tasks or add money to get started." />
              )}
              <div className="space-y-2">
                {transactions?.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                    <div className="flex items-center gap-3">
                      <div className={`grid size-9 place-items-center rounded-full ${t.type === "credit" || t.type === "reversal" ? "bg-success/15" : "bg-muted"}`}>
                        {t.type === "credit" || t.type === "reversal" ? <ArrowDownLeft className="size-4 text-success" /> : <ArrowUpRight className="size-4 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="line-clamp-1 text-sm font-medium text-foreground">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${t.amount > 0 ? "text-success" : "text-foreground"}`}>
                        {t.amount > 0 ? "+" : ""}₦{Math.abs(Number(t.amount)).toLocaleString("en-NG")}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">{t.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add bank account sheet */}
      <Sheet open={addBankOpen} onOpenChange={setAddBankOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Add bank account</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Bank</label>
              <select
                value={bankCode}
                onChange={(e) => {
                  const bank = banks?.find((b: any) => b.code === e.target.value);
                  setBankCode(e.target.value);
                  setBankName(bank?.name ?? "");
                  setAccountName("");
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select your bank</option>
                {banks?.map((b: any) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Account number</label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); setAccountName(""); }}
                  placeholder="10-digit account number"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={accountNumber.length !== 10 || !bankCode || verifyingAccount}
                  onClick={verifyAccountNumber}
                >
                  {verifyingAccount ? "..." : "Verify"}
                </Button>
              </div>
            </div>

            {accountName && (
              <div className="rounded-lg border border-success/30 bg-success/10 p-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success shrink-0" />
                <div>
                  <p className="text-sm font-medium text-success">Account verified</p>
                  <p className="text-sm text-foreground">{accountName}</p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>Make sure this is your account. InTask is not responsible for transfers to wrong accounts.</p>
            </div>

            <Button
              className="w-full"
              size="lg"
              disabled={!accountName || !bankCode || !accountNumber || addBank.isPending}
              onClick={() => addBank.mutate()}
            >
              {addBank.isPending ? "Adding..." : "Add bank account"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}