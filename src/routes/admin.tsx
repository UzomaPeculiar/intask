import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Users, Briefcase, DollarSign, CheckCircle2, XCircle, Clock, Building2, Eye, Mail, Phone, MapPin, Globe, GraduationCap, ExternalLink, Activity, AlertTriangle, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { adminForceCancelTask, adminManualRefund, getAdminCommandCenterStats } from "@/lib/admin.functions";
import { useIsMobile } from "@/hooks/use-mobile";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";

const loadCommunicationsTab = () => import("@/components/intask/admin/CommunicationsTab");
const loadSettingsTab = () => import("@/components/intask/admin/SettingsTab");
const loadModerationTab = () => import("@/components/intask/admin/ModerationTab");
const loadWithdrawalsTab = () => import("@/components/intask/admin/FinancialTab");
const loadUserManagementTab = () => import("@/components/intask/admin/UserManagementTab");
const loadTaskManagementTab = () => import("@/components/intask/admin/TaskManagementTab");
const loadVerificationsHubTab = () => import("@/components/intask/admin/VerificationsHubTab");

const CommunicationsTab = lazy(async () => loadCommunicationsTab().then((mod) => ({ default: mod.CommunicationsTab })));
const SettingsTab = lazy(async () => loadSettingsTab().then((mod) => ({ default: mod.SettingsTab })));
const ModerationTab = lazy(async () => loadModerationTab().then((mod) => ({ default: mod.ModerationTab })));
const WithdrawalsTab = lazy(async () => loadWithdrawalsTab().then((mod) => ({ default: mod.FinancialTab })));
const UserManagementTab = lazy(async () => loadUserManagementTab().then((mod) => ({ default: mod.UserManagementTab })));
const TaskManagementTab = lazy(async () => loadTaskManagementTab().then((mod) => ({ default: mod.TaskManagementTab })));
const VerificationsHubTab = lazy(async () => loadVerificationsHubTab().then((mod) => ({ default: mod.VerificationsHubTab })));

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — InTask" }] }),
  component: AdminPage,
});

function AdminPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"overview" | "users" | "tasks" | "verifications" | "communications" | "settings" | "moderation" | "withdrawals">("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  function prefetchTab(targetTab: "overview" | "users" | "tasks" | "verifications" | "communications" | "settings" | "moderation" | "withdrawals") {
    if (targetTab === "users") void loadUserManagementTab();
    if (targetTab === "tasks") void loadTaskManagementTab();
    if (targetTab === "verifications") void loadVerificationsHubTab();
    if (targetTab === "communications") void loadCommunicationsTab();
    if (targetTab === "settings") void loadSettingsTab();
    if (targetTab === "moderation") void loadModerationTab();
    if (targetTab === "withdrawals") void loadWithdrawalsTab();
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) {
          nav({ to: "/auth/login", search: { redirect: "/admin" } });
          return;
        }

        const { data: profile, error } = await (supabase as any)
          .from("my_profile")
          .select("id, is_admin")
          .maybeSingle();

        if (error || !profile?.is_admin) {
          nav({ to: "/app" });
          return;
        }

        if (mounted) setIsAdmin(true);
      } catch {
        if (!mounted) return;
        const { data } = await supabase.auth.getUser();
        if (!data.user) nav({ to: "/auth/login", search: { redirect: "/admin" } });
        else nav({ to: "/app" });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [nav]);

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h1 className="text-lg font-semibold">InTask Admin</h1>
          </div>
          <button
            onClick={() => nav({ to: "/app" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to app
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 -mx-1 overflow-x-auto px-1">
          <div className="flex min-w-max gap-2">
          {(["overview", "users", "tasks", "verifications", "communications", "settings", "moderation", "withdrawals"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              onMouseEnter={() => prefetchTab(t)}
              onFocus={() => prefetchTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground hover:bg-accent"
              }`}
            >
              {t === "overview" ? "Overview" : t === "users" ? "Users" : t === "tasks" ? "Tasks" : t === "verifications" ? "Verifications" : t === "communications" ? "Communications" : t === "settings" ? "Settings" : t === "moderation" ? "Moderation" : "Financial"}
            </button>
          ))}
          </div>
        </div>

        <Suspense fallback={<AdminTabSkeleton />}> 
          {tab === "overview" && <OverviewTab />}
          {tab === "users" && <UserManagementTab />}
          {tab === "tasks" && <TaskManagementTab />}
          {tab === "verifications" && <VerificationsHubTab />}
          {tab === "communications" && <CommunicationsTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "moderation" && <ModerationTab />}
          {tab === "withdrawals" && <WithdrawalsTab />}
        </Suspense>
      </div>
    </div>
  );
}

function AdminTabSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-8">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-full animate-pulse rounded bg-muted/80" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted/80" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted/80" />
      </div>
    </div>
  );
}

function OverviewTab() {
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [viewingTask, setViewingTask] = useState<string | null>(null);
  const [revenueMode, setRevenueMode] = useState<"weekly" | "monthly">("weekly");
  const getAdminCommandCenter = useServerFn(getAdminCommandCenterStats);

  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function hoursAgo(hours: number) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
  }

  function formatCurrency(value: number) {
    return `₦${Math.round(value).toLocaleString("en-NG")}`;
  }

  function weekKey(dateStr: string) {
    const date = new Date(dateStr);
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = d.getUTCDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diffToMonday);
    return d.toISOString().slice(0, 10);
  }

  function monthKey(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  function formatWeekLabel(key: string) {
    const d = new Date(`${key}T00:00:00Z`);
    return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  }

  function formatMonthLabel(key: string) {
    const [year, month] = key.split("-");
    const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
    return d.toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-command-center"],
    refetchInterval: 30000,
    staleTime: 120000,
    gcTime: 600000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
    queryFn: async () => await getAdminCommandCenter(),
  });

  const trendData = useMemo(() => {
    if (!data) return [] as Array<{ key: string; label: string; amount: number }>;
    return revenueMode === "weekly" ? data.revenueTrend.weekly : data.revenueTrend.monthly;
  }, [data, revenueMode]);

  const topLiveCards = [
    {
      label: "Total users",
      value: data?.liveStats.totalUsers ?? 0,
      icon: Users,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "Total tasks",
      value: data?.liveStats.totalTasks ?? 0,
      icon: Briefcase,
      tone: "text-success bg-success/15",
    },
    {
      label: "Escrow volume",
      value: formatCurrency(data?.liveStats.escrowVolume ?? 0),
      icon: Activity,
      tone: "text-warning bg-warning/15",
    },
    {
      label: "Platform fees earned (total)",
      value: formatCurrency(data?.liveStats.platformFeesEarned ?? 0),
      icon: DollarSign,
      tone: "text-foreground bg-muted",
    },
  ];

  if (isLoading && !data) {
    return <div className="text-center text-muted-foreground py-10">Loading command center...</div>;
  }

  if (isError && !data) {
    const message = (error as any)?.message ?? "Could not load command center data";
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {message}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted-foreground py-10">Preparing command center data...</div>;
  }

  return (
    <div className="space-y-6">
      <AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />
      <AdminTaskDetailSheet taskId={viewingTask} open={!!viewingTask} onOpenChange={(open) => { if (!open) setViewingTask(null); }} />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Command Center</h2>
          <p className="text-xs text-muted-foreground">Live operations view across users, tasks, money flow, and risk signals.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Live platform stats</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {topLiveCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className={`mb-3 grid size-9 place-items-center rounded-lg ${card.tone}`}>
                  <Icon className="size-5" />
                </div>
                <p className="text-2xl font-semibold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Task fees earned (released)</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(data?.liveStats.taskFeesEarned ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Withdrawal processing fees earned</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(data?.liveStats.withdrawalFeesEarned ?? 0)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Users by role</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-foreground">Students: <span className="font-semibold">{data?.liveStats.roleCounts.student ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-foreground">Alumni: <span className="font-semibold">{data?.liveStats.roleCounts.alumni ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-foreground">Individuals: <span className="font-semibold">{data?.liveStats.roleCounts.individual ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-foreground">Companies: <span className="font-semibold">{data?.liveStats.roleCounts.company ?? 0}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tasks by status</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-muted/40 px-3 py-2">Open: <span className="font-semibold">{data?.liveStats.taskStatusCounts.open ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">In progress: <span className="font-semibold">{data?.liveStats.taskStatusCounts.inProgress ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">Completed: <span className="font-semibold">{data?.liveStats.taskStatusCounts.completed ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">Disputed: <span className="font-semibold">{data?.liveStats.taskStatusCounts.disputed ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">Cancelled: <span className="font-semibold">{data?.liveStats.taskStatusCounts.cancelled ?? 0}</span></div>
              <div className="rounded-lg bg-muted/40 px-3 py-2">Matched: <span className="font-semibold">{data?.liveStats.taskStatusCounts.matched ?? 0}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Today at a glance</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">New signups</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.today.signupsToday ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Tasks posted</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.today.tasksPostedToday ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Tasks completed</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.today.tasksCompletedToday ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Payments processed</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.today.paymentsProcessedToday ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Withdrawal fees (today)</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatCurrency(data?.today.withdrawalFeesToday ?? 0)}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Pending action queue</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-xs font-medium text-warning">Pending verifications</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.queue.pendingVerifications ?? 0}</p>
          </div>
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-xs font-medium text-destructive">Open disputes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.queue.openDisputes ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Pending withdrawals</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.queue.pendingWithdrawals ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Unresolved reports</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.queue.unresolvedReports ?? 0}</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Platform health</h3>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="size-4" />
              <p className="text-xs font-medium">Failed payment events</p>
            </div>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.health.failedPayments ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Withdrawals/top-ups with failed or reversed payment outcome.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertTriangle className="size-4" />
              <p className="text-xs font-medium">Webhook backlog</p>
            </div>
            <p className="mt-1 text-2xl font-semibold text-foreground">{data?.health.webhookBacklog ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">Pending funding/withdrawal rows waiting on webhook completion.</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Stuck flow indicators</p>
            <p className="mt-2 text-sm text-foreground">
              Matched over 48h without escrow: <span className="font-semibold">{data?.health.matchedStuck.length ?? 0}</span>
            </p>
            <p className="text-sm text-foreground">
              In review too long: <span className="font-semibold">{data?.health.inReviewStuck.length ?? 0}</span>
            </p>
          </div>
        </div>
      </section>

      {((data?.health.matchedStuck.length ?? 0) > 0 || (data?.health.inReviewStuck.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matched for 48+ hours without payment</p>
            <div className="mt-3 space-y-2">
              {data?.health.matchedStuck.map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => setViewingTask(task.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-accent/40"
                >
                  <span className="truncate text-sm text-foreground">{task.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">Since {new Date(task.since).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">In review for too long</p>
            <div className="mt-3 space-y-2">
              {data?.health.inReviewStuck.map((task: any) => (
                <button
                  key={task.id}
                  onClick={() => setViewingTask(task.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left hover:bg-accent/40"
                >
                  <span className="truncate text-sm text-foreground">{task.title}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">Since {new Date(task.since).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Revenue chart</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRevenueMode("weekly")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${revenueMode === "weekly" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setRevenueMode("monthly")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${revenueMode === "monthly" ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground"}`}
            >
              Monthly
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          {trendData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No released-fee data yet.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <defs>
                    <linearGradient id="feesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={(value) => `₦${Number(value).toLocaleString("en-NG")}`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <RechartsTooltip formatter={(value: any) => [formatCurrency(Number(value)), "Fees"]} />
                  <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#feesFill)" strokeWidth={2.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

    </div>
  );
}

function AdminUserProfileSheet({ userId, open, onOpenChange }: { userId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<
    {
      profile: any;
      student: any;
      company: any;
      individual: any;
      postedTasks: any[];
      appliedTasks: any[];
      wallet: any;
      walletTransactions: any[];
      reviewsReceived: any[];
      reportsAgainst: any[];
      reportsBy: any[];
    } | null
  >({
    queryKey: ["admin-user-profile", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) return null;
      const { data: profile } = await (supabase as any)
        .from("admin_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!profile) return null;

      let student = null;
      let company = null;
      let individual = null;

      if (profile.role === "student" || profile.role === "alumni") {
        const { data } = await supabase
          .from("admin_student_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        student = data;
      }
      if (profile.role === "company") {
        const { data } = await (supabase as any)
          .from("admin_company_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        company = data;
      }
      if (profile.role === "individual") {
        const { data } = await (supabase as any)
          .from("admin_individual_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        individual = data;
      }

      const { data: postedTasks } = await supabase
        .from("tasks")
        .select("id, title, budget, status, created_at")
        .eq("poster_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: appliedTasks } = await (supabase as any)
        .from("applications")
        .select("id, status, created_at, task:tasks(id, title, budget, status)")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: wallet } = await (supabase as any)
        .from("wallets")
        .select("balance, total_earned, total_withdrawn")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: walletTransactions } = await (supabase as any)
        .from("wallet_transactions")
        .select("id, transaction_type, amount, status, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: reviewsReceived } = await (supabase as any)
        .from("reviews")
        .select("id, rating, comment, created_at, reviewer:admin_profiles!reviews_reviewer_id_fkey(full_name, email)")
        .eq("reviewee_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: reportsAgainst } = await (supabase as any)
        .from("reports")
        .select("id, reason, details, status, created_at, reporter:admin_profiles!reports_reporter_id_fkey(full_name, email)")
        .eq("reported_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      const { data: reportsBy } = await (supabase as any)
        .from("reports")
        .select("id, reason, details, status, created_at, reported:admin_profiles!reports_reported_id_fkey(full_name, email)")
        .eq("reporter_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      return {
        profile,
        student,
        company,
        individual,
        postedTasks: postedTasks ?? [],
        appliedTasks: appliedTasks ?? [],
        wallet,
        walletTransactions: walletTransactions ?? [],
        reviewsReceived: reviewsReceived ?? [],
        reportsAgainst: reportsAgainst ?? [],
        reportsBy: reportsBy ?? [],
      };
    },
  });

  const setAccountStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: "active" | "suspended" | "banned"; reason?: string }) => {
      if (!userId) throw new Error("No user selected");
      const { data: auth } = await supabase.auth.getUser();
      const meId = auth.user?.id;
      if (!meId) throw new Error("Could not identify current admin");
      if (meId === userId) throw new Error("You cannot change your own status here");

      const patch = status === "active"
        ? { account_status: "active", account_status_reason: null, suspended_at: null }
        : { account_status: status, account_status_reason: reason ?? null, suspended_at: new Date().toISOString() };

      const { error } = await (supabase as any).from("profiles").update(patch).eq("id", userId);
      if (error) throw error;

      await (supabase as any).from("audit_log").insert({
        admin_user_id: meId,
        action: status === "active" ? "user.reactivate" : status === "banned" ? "user.ban" : "user.suspend",
        target_type: "user",
        target_id: userId,
        details: { reason: reason ?? null, status },
      });
    },
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["admin-user-profile", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users-management"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update account status"),
  });

  const profile = data?.profile;
  const student = data?.student;
  const company = data?.company;
  const individual = data?.individual;
  const postedTasks = data?.postedTasks ?? [];
  const appliedTasks = data?.appliedTasks ?? [];
  const wallet = data?.wallet;
  const walletTransactions = data?.walletTransactions ?? [];
  const reviewsReceived = data?.reviewsReceived ?? [];
  const reportsAgainst = data?.reportsAgainst ?? [];
  const reportsBy = data?.reportsBy ?? [];

  function statusAction(next: "active" | "suspended" | "banned") {
    if (next === "active") {
      setAccountStatus.mutate({ status: "active" });
      return;
    }
    const reason = window.prompt(`Reason for ${next === "banned" ? "banning" : "suspending"} this user:`) ?? "";
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    setAccountStatus.mutate({ status: next, reason: reason.trim() });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[85vh] overflow-y-auto rounded-t-2xl" : "w-[400px] sm:w-[540px] overflow-y-auto"}>
        <SheetHeader className="space-y-1">
          <SheetTitle>User Profile</SheetTitle>
          <SheetDescription>Full details for verification review</SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && !profile && (
          <p className="text-sm text-muted-foreground py-10 text-center">User not found</p>
        )}

        {profile && (
          <div className="space-y-5 mt-4">
            {/* Header */}
            <div className="flex items-center gap-3">
              <InitialsAvatar name={profile.full_name} size={56} avatarUrl={profile.avatar_url} />
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                <div className="mt-1">
                  <VerifiedBadge role={profile.role} verified={profile.role === "company" ? company?.verified : profile.role === "individual" ? individual?.verified : student?.verified} />
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h3>
              {profile.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="size-3.5 text-muted-foreground" /> {profile.phone}
                </div>
              )}
              {profile.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="size-3.5 text-muted-foreground" /> {profile.email}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Role: <span className="font-medium text-foreground capitalize">{profile.role}</span>
              </div>
              {profile.created_at && (
                <div className="text-sm text-muted-foreground">
                  Joined: <span className="font-medium text-foreground">{new Date(profile.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              {profile.last_active_at && (
                <div className="text-sm text-muted-foreground">
                  Last active: <span className="font-medium text-foreground">{new Date(profile.last_active_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Status:
                <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  (profile.account_status ?? "active") === "active"
                    ? "bg-success/15 text-success"
                    : (profile.account_status ?? "active") === "suspended"
                      ? "bg-warning/15 text-warning"
                      : "bg-destructive/15 text-destructive"
                }`}>
                  {profile.account_status ?? "active"}
                </span>
              </div>
              {profile.account_status_reason && (
                <p className="text-xs text-muted-foreground">Reason: {profile.account_status_reason}</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {(profile.account_status ?? "active") === "active" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => statusAction("suspended")} disabled={setAccountStatus.isPending}>
                      Suspend user
                    </Button>
                    <Button size="sm" variant="outline" className="border-destructive/40 text-destructive" onClick={() => statusAction("banned")} disabled={setAccountStatus.isPending}>
                      Ban user
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => statusAction("active")} disabled={setAccountStatus.isPending}>
                    Reactivate user
                  </Button>
                )}
              </div>
            </div>

            {/* Student Details */}
            {(profile.role === "student" || profile.role === "alumni") && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{profile.role === "alumni" ? "Alumni" : "Student"} Details</h3>
                {student?.university && (
                  <div className="flex items-center gap-2 text-sm">
                    <GraduationCap className="size-3.5 text-muted-foreground" /> {student.university}
                  </div>
                )}
                {student?.department && (
                  <div className="text-sm text-muted-foreground">Dept: <span className="font-medium text-foreground">{student.department}</span></div>
                )}
                {student?.year_of_study && (
                  <div className="text-sm text-muted-foreground">Year: <span className="font-medium text-foreground">{student.year_of_study}</span></div>
                )}
                {student?.university_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-3.5 text-muted-foreground" /> {student.university_email}
                  </div>
                )}
                {student?.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {student.skills.map((sk: string) => (
                      <span key={sk} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{sk}</span>
                    ))}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-1">
                  Verified: <span className={`font-medium ${student?.verified ? "text-success" : "text-warning"}`}>{student?.verified ? "Yes" : "No"}</span>
                </div>
                {student?.verification_method && (
                  <div className="text-sm text-muted-foreground">
                    Method: <span className="font-medium text-foreground capitalize">{student.verification_method === "id_upload" ? "ID Upload" : "Email"}</span>
                  </div>
                )}
                {student?.id_upload_path && (
                  <div className="text-sm text-muted-foreground">
                    ID: <span className="font-medium text-foreground">Uploaded</span>
                  </div>
                )}
                {student?.rating_count > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Rating: <span className="font-medium text-foreground">{Number(student.rating_average).toFixed(1)} ({student.rating_count} reviews)</span>
                  </div>
                )}
              </div>
            )}

            {/* Company Details */}
            {profile.role === "company" && company && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Details</h3>
                {company.company_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="size-3.5 text-muted-foreground" /> {company.company_name}
                  </div>
                )}
                {company.industry && (
                  <div className="text-sm text-muted-foreground">Industry: <span className="font-medium text-foreground">{company.industry}</span></div>
                )}
                {company.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="size-3.5 text-muted-foreground" /> {company.location}
                  </div>
                )}
                {company.website && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="size-3.5 text-muted-foreground" />
                    <a href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 truncate max-w-[200px]">{company.website}</a>
                  </div>
                )}
                {company.company_email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-3.5 text-muted-foreground" /> {company.company_email}
                  </div>
                )}
                {company.cac_number && (
                  <div className="text-sm text-muted-foreground">CAC: <span className="font-medium text-foreground">{company.cac_number}</span></div>
                )}
                <div className="text-sm text-muted-foreground mt-1">
                  Verified: <span className={`font-medium ${company.verified ? "text-success" : "text-warning"}`}>{company.verified ? "Yes" : "No"}</span>
                </div>
                {company.verification_method && (
                  <div className="text-sm text-muted-foreground">
                    Method: <span className="font-medium text-foreground capitalize">{company.verification_method === "email" ? "Company Email" : company.verification_method === "cac_number" ? "CAC Certificate" : company.verification_method}</span>
                  </div>
                )}
              </div>
            )}

            {/* Individual Details */}
            {profile.role === "individual" && individual && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Individual Details</h3>
                <div className="text-sm text-muted-foreground">
                  Verified: <span className={`font-medium ${individual.verified ? "text-success" : "text-warning"}`}>{individual.verified ? "Yes" : "No"}</span>
                </div>
                {individual.id_type && (
                  <div className="text-sm text-muted-foreground">
                    ID Type: <span className="font-medium text-foreground">{individual.id_type === "NIN" ? "National ID (NIN)" : individual.id_type === "voter_card" ? "Voter's Card" : individual.id_type === "drivers_license" ? "Driver's License" : "International Passport"}</span>
                  </div>
                )}
                {individual.verification_status && (
                  <div className="text-sm text-muted-foreground">
                    Status: <span className="font-medium text-foreground capitalize">{individual.verification_status.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>
            )}

            {/* Posted Tasks */}
            {postedTasks.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posted Tasks</h3>
                {postedTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground max-w-[200px]">{t.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">₦{Number(t.budget).toLocaleString("en-NG")}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Applied Tasks */}
            {appliedTasks.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applied Tasks</h3>
                {appliedTasks.map((a: any) => (
                  <div key={a.id} className="text-sm">
                    <p className="font-medium text-foreground truncate">{a.task?.title ?? "Unknown task"}</p>
                    <p className="text-xs text-muted-foreground">Application: {a.status} · Task: {a.task?.status ?? "-"}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Wallet */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Summary</h3>
              {wallet ? (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="font-semibold text-foreground">₦{Number(wallet.balance ?? 0).toLocaleString("en-NG")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Earned</p>
                    <p className="font-semibold text-foreground">₦{Number(wallet.total_earned ?? 0).toLocaleString("en-NG")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Withdrawn</p>
                    <p className="font-semibold text-foreground">₦{Number(wallet.total_withdrawn ?? 0).toLocaleString("en-NG")}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No wallet record found.</p>
              )}
            </div>

            {/* Wallet Transactions */}
            {walletTransactions.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Transactions</h3>
                {walletTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{tx.description || (tx.transaction_type === "credit" ? "Credit" : "Debit")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · {tx.status}</p>
                    </div>
                    <span className={`font-medium ${tx.transaction_type === "credit" ? "text-success" : "text-foreground"}`}>
                      {tx.transaction_type === "credit" ? "+" : "-"}₦{Number(tx.amount).toLocaleString("en-NG")}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews Received */}
            {reviewsReceived.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviews Received</h3>
                {reviewsReceived.map((r: any) => (
                  <div key={r.id} className="text-sm">
                    <p className="text-foreground">{r.rating}/5 from {r.reviewer?.full_name ?? "Unknown"}</p>
                    {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Reports */}
            {(reportsAgainst.length > 0 || reportsBy.length > 0) && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reports</h3>

                {reportsAgainst.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Filed against this user</p>
                    {reportsAgainst.slice(0, 5).map((r: any) => (
                      <p key={r.id} className="text-xs text-muted-foreground">
                        {r.reason} · by {r.reporter?.full_name ?? "Unknown"} · {r.status}
                      </p>
                    ))}
                  </div>
                )}

                {reportsBy.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">Filed by this user</p>
                    {reportsBy.slice(0, 5).map((r: any) => (
                      <p key={r.id} className="text-xs text-muted-foreground">
                        {r.reason} · against {r.reported?.full_name ?? "Unknown"} · {r.status}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Link to full profile */}
            <a
              href={`/app/profile/${userId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> View full profile in app
            </a>

            <a
              href={`/app/profile/${userId}?admin_view=1`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> View as user surface
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AdminTaskDetailSheet({ taskId, open, onOpenChange }: { taskId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-task-detail", taskId],
    enabled: !!taskId && open,
    queryFn: async () => {
      if (!taskId) return null;
      const { data: task } = await supabase
        .from("tasks")
        .select("*, poster:admin_profiles!tasks_poster_id_fkey(id, full_name, email, role)")
        .eq("id", taskId)
        .maybeSingle();
      if (!task) return null;

      const { data: applicants } = await supabase
        .from("applications")
        .select("id, status, created_at, applicant:admin_profiles!applications_applicant_id_fkey(id, full_name, email)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      const { data: transactions } = await (supabase as any)
        .from("transactions")
        .select("id, amount, platform_fee, status, paystack_reference, created_at, updated_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      const { data: disputes } = await (supabase as any)
        .from("disputes")
        .select("id, reason, details, resolution, status, created_at, updated_at, raiser:admin_profiles!disputes_raised_by_fkey(full_name, email)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      const { data: conversation } = await (supabase as any)
        .from("conversations")
        .select("id")
        .eq("task_id", taskId)
        .maybeSingle();

      let messages: any[] = [];
      if (conversation?.id) {
        const { data: msg } = await (supabase as any)
          .from("messages")
          .select("id, content, created_at, sender:admin_profiles!messages_sender_id_fkey(full_name, email)")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(20);
        messages = msg ?? [];
      }

      const { data: assignee } = (task as any).assignee_id
        ? await supabase.from("admin_profiles").select("id, full_name, email").eq("id", (task as any).assignee_id).maybeSingle()
        : { data: null };

      return { task, applicants: applicants ?? [], transactions: transactions ?? [], disputes: disputes ?? [], messages, assignee };
    },
  });

  const task = data?.task;
  const applicants = data?.applicants ?? [];
  const transactions = data?.transactions ?? [];
  const disputes = data?.disputes ?? [];
  const messages = data?.messages ?? [];
  const assignee = data?.assignee;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[85vh] overflow-y-auto rounded-t-2xl" : "w-[400px] sm:w-[540px] overflow-y-auto"}>
        <SheetHeader className="space-y-1">
          <SheetTitle>Task Details</SheetTitle>
          <SheetDescription>Full task information</SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-10">
            <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && !task && (
          <p className="text-sm text-muted-foreground py-10 text-center">Task not found</p>
        )}

        {task && (
          <div className="space-y-5 mt-4">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-foreground leading-tight">{task.title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  task.status === "open" ? "bg-success/15 text-success" :
                  task.status === "in_progress" ? "bg-primary/15 text-primary" :
                  task.status === "completed" ? "bg-muted text-muted-foreground" :
                  task.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                  "bg-warning/15 text-warning"
                }`}>
                  {task.status.replace(/_/g, " ")}
                </span>
              </div>
              {task.description && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{task.description}</p>
              )}
            </div>

            {/* Budget & Category */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="text-lg font-semibold text-success">₦{Number(task.budget).toLocaleString("en-NG")}</p>
                </div>
                {task.category && (
                  <div>
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="text-sm font-medium text-foreground capitalize">{task.category}</p>
                  </div>
                )}
              </div>
              {task.deadline && (
                <div className="text-sm text-muted-foreground">
                  Deadline: <span className="font-medium text-foreground">{new Date(task.deadline).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
              )}
              {task.featured && task.featured_until && (
                <div className="text-sm text-warning">
                  ⭐ Featured until {new Date(task.featured_until).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                Posted: <span className="font-medium text-foreground">{new Date(task.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>
            </div>

            {/* Poster */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posted By</h3>
              <div className="flex items-center gap-2">
                <InitialsAvatar name={task.poster?.full_name} size={32} />
                <div>
                  <p className="text-sm font-medium text-foreground">{task.poster?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{task.poster?.email}</p>
                </div>
              </div>
            </div>

            {/* Assignee */}
            {assignee && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assigned To</h3>
                <div className="flex items-center gap-2">
                  <InitialsAvatar name={assignee.full_name} size={32} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{assignee.full_name}</p>
                    <p className="text-xs text-muted-foreground">{assignee.email}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Applicants */}
            {applicants.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applicants ({applicants.length})</h3>
                <div className="space-y-2">
                  {applicants.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <InitialsAvatar name={a.applicant?.full_name} size={24} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{a.applicant?.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.applicant?.email}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        a.status === "accepted" ? "bg-success/15 text-success" :
                        a.status === "rejected" ? "bg-destructive/15 text-destructive" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction Record */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transaction Record</h3>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No transaction created yet.</p>
              ) : (
                transactions.map((tx: any) => (
                  <div key={tx.id} className="text-sm">
                    <p className="text-foreground">
                      ₦{Number(tx.amount).toLocaleString("en-NG")} · fee ₦{Number(tx.platform_fee ?? 0).toLocaleString("en-NG")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Status: {tx.status} · Ref: {tx.paystack_reference ?? "-"}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Conversation Thread Preview */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversation Thread</h3>
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages for this task yet.</p>
              ) : (
                <div className="space-y-2">
                  {messages.map((m: any) => (
                    <div key={m.id} className="rounded-lg border border-border bg-background px-3 py-2">
                      <p className="text-xs text-muted-foreground">{m.sender?.full_name ?? "Unknown"} · {new Date(m.created_at).toLocaleString("en-NG")}</p>
                      <p className="mt-1 text-sm text-foreground">{m.content || "(attachment or empty message)"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dispute History */}
            <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dispute History</h3>
              {disputes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No disputes recorded for this task.</p>
              ) : (
                disputes.map((d: any) => (
                  <div key={d.id} className="text-sm">
                    <p className="text-foreground">{d.reason} · {d.status}</p>
                    {d.details && <p className="text-xs text-muted-foreground">{d.details}</p>}
                    {d.resolution && <p className="text-xs text-success">Resolution: {d.resolution}</p>}
                  </div>
                ))
              )}
            </div>

            {/* Link to task in app */}
            <a
              href={`/app/tasks/${taskId}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="size-3.5" /> View task in app
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FeaturedTaskRow({ task }: { task: any }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function toggleFeatured() {
    setLoading(true);
    const nowFeatured = !task.featured;
    await (supabase as any)
      .from("tasks")
      .update({
        featured: nowFeatured,
        featured_until: nowFeatured
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      })
      .eq("id", task.id);
    setLoading(false);
    qc.invalidateQueries({ queryKey: ["admin-command-center"] });
    qc.invalidateQueries({ queryKey: ["admin-task-management"] });
    toast.success(nowFeatured ? "Task featured for 7 days" : "Task unfeatured");
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
        <p className="text-xs text-muted-foreground">{task.poster?.full_name}</p>
        {task.featured && task.featured_until && (
          <p className="text-xs text-warning">
            Featured until {new Date(task.featured_until).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
          </p>
        )}
      </div>
      <Button
        size="sm"
        variant={task.featured ? "outline" : "default"}
        disabled={loading}
        onClick={toggleFeatured}
        className={task.featured ? "text-muted-foreground" : ""}
      >
        {loading ? "..." : task.featured ? "Unfeature" : "⭐ Feature"}
      </Button>
    </div>
  );
}

function PartnershipsTab() {
  const qc = useQueryClient();

  const { data: partnerships, isLoading, refetch } = useQuery({
    queryKey: ["admin-partnerships"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("university_partnerships")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any)
        .from("university_partnerships")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => { toast.success("Partnership approved"); refetch(); },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any)
        .from("university_partnerships")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => { toast.success("Partnership rejected"); refetch(); },
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;

  if (!partnerships || partnerships.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-3" />
        <p className="font-medium text-foreground">No partnership requests yet</p>
        <p className="text-sm text-muted-foreground mt-1">Requests from universities will appear here</p>
      </div>
    );
  }

  const pending = partnerships.filter((p: any) => p.status === "pending");
  const others = partnerships.filter((p: any) => p.status !== "pending");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{pending.length} pending request{pending.length === 1 ? "" : "s"}</p>
          {pending.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-medium text-foreground">{p.university_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.contact_name} · {p.contact_email}</p>
                  {p.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{p.notes}"</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(p.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning shrink-0">Pending</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-success text-success-foreground hover:bg-success/90" disabled={approve.isPending} onClick={() => approve.mutate(p.id)}>
                  <CheckCircle2 className="size-3.5 mr-1" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30" disabled={reject.isPending} onClick={() => reject.mutate(p.id)}>
                  <XCircle className="size-3.5 mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Previous requests</p>
          {others.map((p: any) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 opacity-70">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{p.university_name}</p>
                  <p className="text-xs text-muted-foreground">{p.contact_name} · {p.contact_email}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${p.status === "approved" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

