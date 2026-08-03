import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { adminManualRefund } from "@/lib/admin.functions";

export function FinancialTab() {
  const refundServer = useServerFn(adminManualRefund);
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [withdrawalStatus, setWithdrawalStatus] = useState<"all" | "pending" | "completed" | "failed" | "reversed" | "rejected">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "7d" | "30d" | "90d">("all");
  const [refundUserId, setRefundUserId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"wallet" | "paystack">("wallet");
  const [refundReference, setRefundReference] = useState("");

  function money(value: number) {
    return `₦${Math.round(value).toLocaleString("en-NG")}`;
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-financial-management"],
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const [withdrawalsRes, txRes, fundingRes, profilesRes, walletsRes] = await Promise.all([
        (supabase as any)
          .from("withdrawal_requests")
          .select("*, user:profiles!withdrawal_requests_user_id_fkey(id, full_name, email)")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("transactions")
          .select("id, task_id, poster_id, student_id, amount, platform_fee, status, created_at, updated_at, task:tasks(title), poster:profiles!transactions_poster_id_fkey(full_name, email), student:profiles!transactions_student_id_fkey(full_name, email)")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("wallet_funding")
          .select("id, user_id, amount, paystack_reference, status, webhook_processed, created_at, updated_at, user:profiles!wallet_funding_user_id_fkey(full_name, email)")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("profiles")
          .select("id, full_name, email")
          .order("created_at", { ascending: false })
          .limit(300),
        (supabase as any)
          .from("wallets")
          .select("user_id, balance"),
      ]);

      if (withdrawalsRes.error) throw withdrawalsRes.error;
      if (txRes.error) throw txRes.error;
      if (fundingRes.error) throw fundingRes.error;
      if (profilesRes.error) throw profilesRes.error;
      if (walletsRes.error) throw walletsRes.error;

      return {
        withdrawals: withdrawalsRes.data ?? [],
        transactions: txRes.data ?? [],
        funding: fundingRes.data ?? [],
        profiles: profilesRes.data ?? [],
        wallets: walletsRes.data ?? [],
      };
    },
  });

  const refundMutation = useMutation({
    mutationFn: async () => {
      if (!refundUserId.trim()) throw new Error("User ID is required");
      const amount = Number(refundAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid refund amount");
      if (!refundReason.trim() || refundReason.trim().length < 8) throw new Error("Provide a reason with at least 8 characters");

      await refundServer({
        data: {
          userId: refundUserId.trim(),
          amount,
          reason: refundReason.trim(),
          method: refundMethod,
          paystackReference: refundMethod === "paystack" ? refundReference.trim() : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Refund action completed");
      setRefundAmount("");
      setRefundReason("");
      setRefundReference("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not process refund"),
  });

  const withdrawals = data?.withdrawals ?? [];
  const transactions = data?.transactions ?? [];
  const funding = data?.funding ?? [];
  const profiles = data?.profiles ?? [];
  const wallets = data?.wallets ?? [];

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w: any) => {
      const amount = Number(w.amount ?? 0);
      if (minAmount && amount < Number(minAmount)) return false;
      if (maxAmount && amount > Number(maxAmount)) return false;
      if (withdrawalStatus !== "all" && w.status !== withdrawalStatus) return false;

      if (dateFilter !== "all") {
        const days = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : 90;
        const diff = Date.now() - new Date(w.created_at).getTime();
        if (diff > days * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [withdrawals, minAmount, maxAmount, withdrawalStatus, dateFilter]);

  const escrowLedger = useMemo(
    () => transactions.filter((t: any) => ["in_escrow", "released", "refunded", "disputed"].includes(t.status)),
    [transactions]
  );

  const feeLedger = useMemo(
    () => transactions.filter((t: any) => t.status === "released" && Number(t.platform_fee ?? 0) > 0),
    [transactions]
  );

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }, []);

  const monthlySummary = useMemo(() => {
    const grossTaskValueProcessed = transactions
      .filter((t: any) => new Date(t.created_at) >= monthStart && ["in_escrow", "released", "refunded", "disputed"].includes(t.status))
      .reduce((sum: number, t: any) => sum + Number(t.amount ?? 0), 0);

    const totalFeesEarned = transactions
      .filter((t: any) => new Date(t.created_at) >= monthStart && t.status === "released")
      .reduce((sum: number, t: any) => sum + Number(t.platform_fee ?? 0), 0);

    const totalWithdrawnByStudents = withdrawals
      .filter((w: any) => new Date(w.created_at) >= monthStart && w.status === "completed")
      .reduce((sum: number, w: any) => sum + Number(w.net_amount ?? 0), 0);

    const escrowHeld = transactions
      .filter((t: any) => ["in_escrow", "disputed"].includes(t.status))
      .reduce((sum: number, t: any) => sum + Number(t.amount ?? 0), 0);

    const feesAllTime = transactions
      .filter((t: any) => t.status === "released")
      .reduce((sum: number, t: any) => sum + Number(t.platform_fee ?? 0), 0);

    const totalWalletBalances = wallets
      .reduce((sum: number, w: any) => sum + Number(w.balance ?? 0), 0);

    return {
      grossTaskValueProcessed,
      totalFeesEarned,
      totalWithdrawnByStudents,
      escrowHeld,
      platformWalletBalanceEstimate: totalWalletBalances,
      platformFeesAllTime: feesAllTime,
    };
  }, [transactions, withdrawals, wallets, monthStart]);

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading financial data...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Financial Management</h2>
            <p className="text-xs text-muted-foreground">Withdrawals, escrow ledger, fees, top-ups, refund controls, and monthly summary in one place.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Gross task value (month)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{money(monthlySummary.grossTaskValueProcessed)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Fees earned (month)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{money(monthlySummary.totalFeesEarned)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Student withdrawals (month)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{money(monthlySummary.totalWithdrawnByStudents)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Current escrow held</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{money(monthlySummary.escrowHeld)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Platform wallet balance (est.)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{money(monthlySummary.platformWalletBalanceEstimate)}</p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Withdrawals</h3>
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-5">
          <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Min amount" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="Max amount" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <select value={withdrawalStatus} onChange={(e) => setWithdrawalStatus(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="all">All status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
            <option value="rejected">Rejected</option>
          </select>
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="all">Any date</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex items-center">Showing {filteredWithdrawals.length} / {withdrawals.length}</div>
        </div>

        <div className="space-y-2 max-h-[380px] overflow-auto pr-1">
          {filteredWithdrawals.length === 0 && <p className="text-sm text-muted-foreground">No withdrawals found for current filters.</p>}
          {filteredWithdrawals.map((w: any) => (
            <div key={w.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{w.user?.full_name ?? "Unknown user"}</p>
                  <p className="text-xs text-muted-foreground">{w.user?.email ?? "-"}</p>
                  <p className="text-xs text-muted-foreground mt-1">{w.bank_name} · {w.account_number} · {w.account_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{money(Number(w.amount ?? 0))}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${w.status === "completed" ? "bg-success/15 text-success" : w.status === "pending" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
                    {w.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Escrow ledger</h3>
          <p className="text-xs text-muted-foreground">Every task transaction across in-escrow, released, refunded, and disputed states.</p>
          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {escrowLedger.length === 0 && <p className="text-sm text-muted-foreground">No escrow transactions yet.</p>}
            {escrowLedger.map((t: any) => (
              <div key={t.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{t.task?.title ?? "Task"}</p>
                    <p className="text-xs text-muted-foreground">Poster: {t.poster?.full_name ?? "-"} · Student: {t.student?.full_name ?? "-"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{money(Number(t.amount ?? 0))}</p>
                    <p className="text-xs text-muted-foreground">{t.status}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Platform fees ledger</h3>
          <p className="text-xs text-muted-foreground">Each fee captured from released tasks, with running totals.</p>
          <p className="text-xs text-muted-foreground">Total fees earned: <span className="font-semibold text-foreground">{money(feeLedger.reduce((sum: number, t: any) => sum + Number(t.platform_fee ?? 0), 0))}</span></p>
          <div className="space-y-2 max-h-[360px] overflow-auto pr-1">
            {feeLedger.length === 0 && <p className="text-sm text-muted-foreground">No fee records yet.</p>}
            {feeLedger.map((t: any) => (
              <div key={t.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.task?.title ?? "Task"}</p>
                  <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <p className="text-sm font-semibold text-foreground">{money(Number(t.platform_fee ?? 0))}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Wallet top-ups</h3>
        <p className="text-xs text-muted-foreground">All funding attempts: successful, failed, and pending webhook confirmations.</p>
        <div className="space-y-2 max-h-[340px] overflow-auto pr-1">
          {funding.length === 0 && <p className="text-sm text-muted-foreground">No wallet funding records yet.</p>}
          {funding.map((f: any) => (
            <div key={f.id} className="rounded-lg border border-border p-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{f.user?.full_name ?? "Unknown user"}</p>
                <p className="text-xs text-muted-foreground">{f.user?.email ?? "-"}</p>
                <p className="text-xs text-muted-foreground mt-1">Ref: {f.paystack_reference}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-foreground">{money(Number(f.amount ?? 0))}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${f.status === "completed" ? "bg-success/15 text-success" : f.status === "pending" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>
                  {f.status}
                </span>
                {!f.webhook_processed && <p className="text-[10px] text-warning mt-1">Webhook pending</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Refund controls</h3>
        <p className="text-xs text-muted-foreground">Manual wallet or Paystack refunds for edge cases and goodwill adjustments.</p>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          <input list="admin-refund-users" value={refundUserId} onChange={(e) => setRefundUserId(e.target.value)} placeholder="User ID (choose from list)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <datalist id="admin-refund-users">
            {profiles.map((p: any) => (
              <option key={p.id} value={p.id}>{`${p.full_name ?? "Unknown"} - ${p.email ?? ""}`}</option>
            ))}
          </datalist>

          <input type="number" min="1" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Amount (NGN)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />

          <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value as any)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="wallet">Refund to wallet</option>
            <option value="paystack">Refund via Paystack</option>
          </select>

          <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} rows={2} placeholder="Reason for refund (required)" className="rounded-lg border border-border bg-background px-3 py-2 text-sm lg:col-span-2" />

          {refundMethod === "paystack" && (
            <input value={refundReference} onChange={(e) => setRefundReference(e.target.value)} placeholder="Paystack transaction reference" className="rounded-lg border border-border bg-background px-3 py-2 text-sm lg:col-span-2" />
          )}
        </div>

        <div>
          <Button onClick={() => refundMutation.mutate()} disabled={refundMutation.isPending}>
            {refundMutation.isPending ? "Processing..." : "Run refund"}
          </Button>
        </div>
      </section>
    </div>
  );
}
