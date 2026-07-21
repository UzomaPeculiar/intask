import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/intask/EmptyState";
import { ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

export const Route = createFileRoute("/app/wallet")({
  head: () => ({ meta: [{ title: "Wallet — InTask" }] }),
  component: WalletPage,
});

const NIGERIAN_BANKS = [
  "Access Bank", "Citibank", "Ecobank", "Fidelity Bank", "First Bank",
  "First City Monument Bank", "Guaranty Trust Bank", "Heritage Bank",
  "Keystone Bank", "Polaris Bank", "Providus Bank", "Stanbic IBTC Bank",
  "Standard Chartered Bank", "Sterling Bank", "Suntrust Bank", "Union Bank",
  "United Bank for Africa", "Unity Bank", "Wema Bank", "Zenith Bank",
  "Kuda Bank", "Opay", "PalmPay", "Moniepoint", "Carbon",
];

function WalletPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: wallet } = useQuery({
    queryKey: ["wallet", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("wallets")
        .select("*")
        .eq("user_id", me!.id)
        .maybeSingle();
      if (!data) {
        await (supabase as any).from("wallets").insert({ user_id: me!.id, balance: 0, total_earned: 0, total_withdrawn: 0 });
        return { balance: 0, total_earned: 0, total_withdrawn: 0 };
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
        .limit(20);
      return data ?? [];
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

  const withdraw = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      const amount = Number(withdrawAmount);
      if (amount < 500) throw new Error("Minimum withdrawal is ₦500");
      if (amount > (wallet?.balance ?? 0)) throw new Error("Insufficient wallet balance");
      if (!bankName || !accountNumber || !accountName) throw new Error("Please fill in all bank details");
      if (accountNumber.length !== 10) throw new Error("Account number must be 10 digits");

      const { error } = await (supabase as any)
        .from("withdrawal_requests")
        .insert({
          user_id: me.id,
          wallet_id: wallet?.id,
          amount,
          bank_name: bankName,
          account_number: accountNumber,
          account_name: accountName,
          status: "pending",
        });
      if (error) throw error;

      await (supabase as any)
        .from("wallets")
        .update({
          balance: (wallet?.balance ?? 0) - amount,
          total_withdrawn: (wallet?.total_withdrawn ?? 0) + amount,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", me.id);

      await (supabase as any)
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet?.id,
          user_id: me.id,
          type: "withdrawal",
          amount: -amount,
          description: `Withdrawal to ${bankName} - ${accountNumber}`,
          status: "pending",
        });
    },
    onSuccess: () => {
      toast.success("Withdrawal request submitted. You will receive your funds within 24 hours.");
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setBankName("");
      setAccountNumber("");
      setAccountName("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-transactions"] });
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not process withdrawal"),
  });

  const pendingWithdrawals = withdrawals?.filter((w: any) => w.status === "pending") ?? [];

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">My Wallet</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="size-5 opacity-80" />
            <p className="text-sm opacity-80">Available balance</p>
          </div>
          <p className="text-4xl font-bold">₦{Number(wallet?.balance ?? 0).toLocaleString("en-NG")}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/15 p-3">
              <p className="text-xs opacity-70">Total earned</p>
              <p className="text-sm font-semibold mt-0.5">₦{Number(wallet?.total_earned ?? 0).toLocaleString("en-NG")}</p>
            </div>
            <div className="rounded-xl bg-white/15 p-3">
              <p className="text-xs opacity-70">Total withdrawn</p>
              <p className="text-sm font-semibold mt-0.5">₦{Number(wallet?.total_withdrawn ?? 0).toLocaleString("en-NG")}</p>
            </div>
          </div>
        </div>

        <Sheet open={withdrawOpen} onOpenChange={setWithdrawOpen}>
          <SheetTrigger asChild>
            <Button className="w-full gap-2" size="lg" disabled={(wallet?.balance ?? 0) <= 0}>
              <ArrowUpRight className="size-4" /> Withdraw funds
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <SheetHeader className="text-left">
              <SheetTitle>Withdraw funds</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 px-4 pb-6 pt-2">
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                Available balance: <span className="font-semibold text-foreground">₦{Number(wallet?.balance ?? 0).toLocaleString("en-NG")}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount (₦)</label>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Minimum ₦500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bank</label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select your bank</option>
                  {NIGERIAN_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Account number</label>
                <Input
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit account number"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Account name</label>
                <Input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="As it appears on your bank account"
                />
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <p>Please double-check your account details. InTask is not responsible for funds sent to incorrect accounts.</p>
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={!withdrawAmount || !bankName || !accountNumber || !accountName || withdraw.isPending}
                onClick={() => withdraw.mutate()}
              >
                {withdraw.isPending ? "Processing..." : `Withdraw ₦${withdrawAmount ? Number(withdrawAmount).toLocaleString("en-NG") : "0"}`}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {pendingWithdrawals.length > 0 && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3">
            <p className="text-sm font-medium text-warning flex items-center gap-1">
              <Clock className="size-4" /> {pendingWithdrawals.length} pending withdrawal{pendingWithdrawals.length === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              ₦{pendingWithdrawals.reduce((sum: number, w: any) => sum + Number(w.amount), 0).toLocaleString("en-NG")} being processed — usually within 24 hours
            </p>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Transaction history</h2>
          {(!transactions || transactions.length === 0) && (
            <EmptyState
              icon={Wallet}
              title="No transactions yet"
              description="Complete tasks to start earning. Your payments will appear here."
            />
          )}
          <div className="space-y-2">
            {transactions?.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className={`grid size-9 place-items-center rounded-full ${t.type === "credit" ? "bg-success/15" : "bg-muted"}`}>
                    {t.type === "credit" ? (
                      <ArrowDownLeft className="size-4 text-success" />
                    ) : (
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${t.type === "credit" ? "text-success" : "text-foreground"}`}>
                    {t.type === "credit" ? "+" : ""}₦{Math.abs(Number(t.amount)).toLocaleString("en-NG")}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{t.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}