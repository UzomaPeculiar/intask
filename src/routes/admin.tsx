import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Users, Briefcase, DollarSign, CheckCircle2, XCircle, Clock, Building2, Eye, Mail, Phone, MapPin, Globe, GraduationCap, ExternalLink, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { adminResolveDispute } from "@/lib/admin.functions";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — InTask" }] }),
  component: AdminPage,
});

function AdminPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"overview" | "students" | "companies" | "individuals" | "reports" | "disputes" | "partnerships" | "withdrawals">("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
          .from("profiles")
          .select("id, is_admin")
          .eq("id", authData.user.id)
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
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
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

      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="flex gap-2 mb-6">
          {(["overview", "students", "companies", "individuals", "reports", "disputes", "partnerships", "withdrawals"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground hover:bg-accent"
              }`}
            >
              {t === "overview" ? "Overview" : t === "students" ? "Student Verifications" : t === "companies" ? "Company Verifications" : t === "individuals" ? "Individual Verifications" : t === "reports" ? "Reports" : t === "disputes" ? "Disputes" : t === "partnerships" ? "Partnerships" : "Withdrawals"}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "students" && <StudentVerificationsTab />}
        {tab === "companies" && <CompanyVerificationsTab />}
        {tab === "individuals" && <IndividualVerificationsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "disputes" && <DisputesTab />}
        {tab === "partnerships" && <PartnershipsTab />}
        {tab === "withdrawals" && <WithdrawalsTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showPayoutBreakdown, setShowPayoutBreakdown] = useState(false);
  const [viewingTask, setViewingTask] = useState<string | null>(null);
  const [searchUsers, setSearchUsers] = useState("");
  const [searchTasks, setSearchTasks] = useState("");

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, tasks, transactions] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("amount").eq("status", "released"),
      ]);
      const totalPayout = (transactions.data ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);
      const { data: openTasks } = await supabase
        .from("tasks")
        .select("id, title, featured, featured_until, poster_id")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);

      return { users: users.count ?? 0, tasks: tasks.count ?? 0, totalPayout, openTasks: openTasks ?? [] };
    },
  });

  const { data: allUsers, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-all-users"],
    enabled: showAllUsers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, is_admin, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["admin-all-tasks"],
    enabled: showAllTasks,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, budget, status, created_at, featured, poster_id, category")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payoutBreakdown, isLoading: payoutLoading } = useQuery({
    queryKey: ["admin-payout-breakdown"],
    enabled: showPayoutBreakdown,
    queryFn: async () => {
      const { data: released, error } = await (supabase as any)
        .from("transactions")
        .select("id, amount, task_id, recipient_id, created_at, task:tasks(title), recipient:profiles(full_name, email)")
        .eq("status", "released")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const txns = released ?? [];
      const byUser: Record<string, { name: string; email: string; total: number; count: number }> = {};
      for (const tx of txns) {
        const rid = tx.recipient_id;
        if (!rid) continue;
        if (!byUser[rid]) byUser[rid] = { name: tx.recipient?.full_name ?? "Unknown", email: tx.recipient?.email ?? "", total: 0, count: 0 };
        byUser[rid].total += Number(tx.amount ?? 0);
        byUser[rid].count += 1;
      }
      const sorted = Object.entries(byUser)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total);
      return { transactions: txns, byUser: sorted, total: txns.reduce((s: number, t: any) => s + Number(t.amount ?? 0), 0) };
    },
  });

  const statCards = [
    { label: "Total users", value: stats?.users ?? 0, icon: Users, color: "text-primary bg-primary/10", clickable: true, active: showAllUsers, toggle: () => { setShowAllUsers(!showAllUsers); setShowAllTasks(false); setShowPayoutBreakdown(false); } },
    { label: "Total tasks", value: stats?.tasks ?? 0, icon: Briefcase, color: "text-success bg-success/15", clickable: true, active: showAllTasks, toggle: () => { setShowAllTasks(!showAllTasks); setShowAllUsers(false); setShowPayoutBreakdown(false); } },
    { label: "Total paid out", value: `₦${Number(stats?.totalPayout ?? 0).toLocaleString("en-NG")}`, icon: DollarSign, color: "text-warning bg-warning/15", clickable: true, active: showPayoutBreakdown, toggle: () => { setShowPayoutBreakdown(!showPayoutBreakdown); setShowAllUsers(false); setShowAllTasks(false); } },
  ];

  return (
    <div className="space-y-6">
      <AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />
      <AdminTaskDetailSheet taskId={viewingTask} open={!!viewingTask} onOpenChange={(open) => { if (!open) setViewingTask(null); }} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, color, clickable, active, toggle }) => (
          <div
            key={label}
            className={`rounded-xl border border-border bg-card p-4 shadow-sm transition-all ${clickable ? "cursor-pointer hover:bg-accent/50 hover:shadow-md" : ""} ${active ? "ring-2 ring-primary/30 bg-accent/30" : ""}`}
            onClick={clickable ? toggle : undefined}
          >
            <div className={`grid size-9 place-items-center rounded-lg ${color} mb-3`}>
              <Icon className="size-5" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* All Users Panel */}
      {showAllUsers && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">All Users</h2>
            <button onClick={() => { setShowAllUsers(false); setSearchUsers(""); }} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          {usersLoading && <div className="text-center text-muted-foreground py-4">Loading users...</div>}
          {!usersLoading && allUsers && allUsers.length === 0 && (
            <p className="text-sm text-muted-foreground">No users found</p>
          )}
          {!usersLoading && allUsers && allUsers.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchUsers}
                onChange={(e) => setSearchUsers(e.target.value)}
                className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          {!usersLoading && allUsers && (
            <p className="text-xs text-muted-foreground">Showing {(() => {
              const q = searchUsers.toLowerCase();
              if (!q) return allUsers.length;
              return allUsers.filter((u: any) => (u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))).length;
            })()} of {allUsers.length} most recent users</p>
          )}
          {!usersLoading && allUsers && allUsers.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {allUsers
                .filter((u: any) => {
                  const q = searchUsers.toLowerCase();
                  if (!q) return true;
                  return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                })
                .map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setViewingProfile(u.id)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-accent/50 hover:shadow-sm transition-all"
                >
                  <InitialsAvatar name={u.full_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground hover:text-primary">{u.full_name}</p>
                      {u.is_admin && (
                        <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground capitalize">
                    {u.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Tasks Panel */}
      {showAllTasks && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">All Tasks</h2>
            <button onClick={() => { setShowAllTasks(false); setSearchTasks(""); }} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          {tasksLoading && <div className="text-center text-muted-foreground py-4">Loading tasks...</div>}
          {!tasksLoading && allTasks && allTasks.length === 0 && (
            <p className="text-sm text-muted-foreground">No tasks found</p>
          )}
          {!tasksLoading && allTasks && allTasks.length > 0 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by title or category..."
                value={searchTasks}
                onChange={(e) => setSearchTasks(e.target.value)}
                className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          {!tasksLoading && allTasks && (
            <p className="text-xs text-muted-foreground">Showing {(() => {
              const q = searchTasks.toLowerCase();
              if (!q) return allTasks.length;
              return allTasks.filter((t: any) => t.title?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q) || t.status?.toLowerCase().includes(q)).length;
            })()} of {allTasks.length} most recent tasks</p>
          )}
          {!tasksLoading && allTasks && allTasks.length > 0 && (
            <div className="space-y-2">
              {allTasks
                .filter((t: any) => {
                  const q = searchTasks.toLowerCase();
                  if (!q) return true;
                  return t.title?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q) || t.status?.replace(/_/g, " ").toLowerCase().includes(q);
                })
                .map((t: any) => (
                <button
                  key={t.id}
                  onClick={() => setViewingTask(t.id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-accent/50 hover:shadow-sm transition-all w-full"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">₦{Number(t.budget).toLocaleString("en-NG")}</span>
                      {t.category && <span className="text-xs text-muted-foreground">· {t.category}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.featured && (
                      <span className="text-[10px] font-medium text-warning">⭐</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      t.status === "open" ? "bg-success/15 text-success" :
                      t.status === "in_progress" ? "bg-primary/15 text-primary" :
                      t.status === "completed" ? "bg-muted text-muted-foreground" :
                      t.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                      "bg-warning/15 text-warning"
                    }`}>
                      {t.status.replace(/_/g, " ")}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payout Breakdown Panel */}
      {showPayoutBreakdown && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Payout Breakdown by User</h2>
            <button onClick={() => setShowPayoutBreakdown(false)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
          </div>
          {payoutLoading && <div className="text-center text-muted-foreground py-4">Loading payout data...</div>}
          {!payoutLoading && payoutBreakdown && payoutBreakdown.byUser.length === 0 && (
            <p className="text-sm text-muted-foreground">No payouts yet</p>
          )}
          {!payoutLoading && payoutBreakdown && payoutBreakdown.byUser.length > 0 && (
            <div className="space-y-2">
              {payoutBreakdown.byUser.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setViewingProfile(u.id)}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-accent/50 hover:shadow-sm transition-all w-full"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <InitialsAvatar name={u.name} size={28} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-success">₦{u.total.toLocaleString("en-NG")}</p>
                    <p className="text-[10px] text-muted-foreground">{u.count} payment{u.count === 1 ? "" : "s"}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {stats?.openTasks && stats.openTasks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Manage featured tasks</h2>
          <div className="space-y-3">
            {stats.openTasks.map((t: any) => (
              <FeaturedTaskRow key={t.id} task={t} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentVerificationsTab() {
  const qc = useQueryClient();
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  const { data: pending, isLoading, refetch } = useQuery({
    queryKey: ["pending-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_profiles")
        .select("*, profile:profiles!student_profiles_user_id_fkey(id, full_name, email)")
        .eq("verified", false)
        .eq("verification_method", "id_upload")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("student_profiles")
        .update({ verified: true, verification_status: "approved" } as any)
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_approved",
        message: "Your student ID has been verified. Your Verified Student badge is now active.",
        link: "/app/profile/me",
      });
    },
    onSuccess: () => {
     toast.success("Student verified successfully");
     refetch();
     qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve"),
  });

  const reject = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("student_profiles")
        .update({ verification_status: "rejected" } as any)
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_rejected",
        message: "Your student ID could not be verified. Please upload a clearer photo of your valid student ID card.",
        link: "/app",
      });
    },
    onSuccess: () => {
     toast.success("Student rejected and notified");
     refetch();
     qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not reject"),
  });

  async function viewID(path: string) {
    const { data } = await supabase.storage
      .from("student-ids")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) setViewingImage(data.signedUrl);
    else toast.error("Could not load ID image");
  }

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;

  if (!pending || pending.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-3" />
        <p className="font-medium text-foreground">All caught up</p>
        <p className="text-sm text-muted-foreground mt-1">No pending student ID verifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{pending.length} pending verification{pending.length === 1 ? "" : "s"}</p>

      <AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />

      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={viewingImage} alt="Student ID" className="w-full rounded-xl" />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-3 -right-3 grid size-8 place-items-center rounded-full bg-card border border-border text-foreground"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {pending.map((s: any) => (
        <div key={s.user_id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <button onClick={() => setViewingProfile(s.user_id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{s.profile?.full_name ?? "Unknown"}</button>
              <p className="text-xs text-muted-foreground">{s.profile?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.university} {s.year_of_study ? `· ${s.year_of_study}` : ""} {s.department ? `· ${s.department}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning flex items-center gap-1">
              <Clock className="size-3" /> Pending
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {s.id_upload_path ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => viewID(s.id_upload_path)}
              >
                <Eye className="size-3.5" /> View ID
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">No ID uploaded — manual verification needed</span>
            )}
            <Button
              size="sm"
              className="gap-1 bg-success text-success-foreground hover:bg-success/90"
              disabled={approve.isPending}
              onClick={() => approve.mutate(s.user_id)}
            >
              <CheckCircle2 className="size-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={reject.isPending}
              onClick={() => reject.mutate(s.user_id)}
            >
              <XCircle className="size-3.5" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function IndividualVerificationsTab() {
  const qc = useQueryClient();
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  const { data: pending, isLoading } = useQuery({
    queryKey: ["pending-individuals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("individual_profiles")
        .select("*, profile:profiles!individual_profiles_user_id_fkey(id, full_name, email)")
        .eq("verification_status", "pending_review")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from("individual_profiles")
        .update({ verified: true, verification_status: "approved", verified_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_approved",
        message: "Your government ID has been verified. Your Verified Individual badge is now active.",
        link: "/app/profile/me",
      });
    },
    onSuccess: () => {
      toast.success("Individual verified successfully");
      qc.invalidateQueries({ queryKey: ["pending-individuals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["profile-details"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve"),
  });

  const reject = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any)
        .from("individual_profiles")
        .update({ verification_status: "rejected" })
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_rejected",
        message: "Your government ID could not be verified. Please upload a clearer photo of a valid ID.",
        link: "/app",
      });
    },
    onSuccess: () => {
      toast.success("Individual rejected and notified");
      qc.invalidateQueries({ queryKey: ["pending-individuals"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["profile-details"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not reject"),
  });

  async function viewID(path: string) {
    const { data } = await supabase.storage
      .from("individual-docs")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) setViewingImage(data.signedUrl);
    else toast.error("Could not load ID image");
  }

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;

  if (!pending || pending.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-3" />
        <p className="font-medium text-foreground">All caught up</p>
        <p className="text-sm text-muted-foreground mt-1">No pending individual ID verifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{pending.length} pending verification{pending.length === 1 ? "" : "s"}</p>

      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={viewingImage} alt="Government ID" className="w-full rounded-xl" />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-3 -right-3 grid size-8 place-items-center rounded-full bg-card border border-border text-foreground"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />

      {pending.map((ind: any) => (
        <div key={ind.user_id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <button onClick={() => setViewingProfile(ind.user_id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{ind.profile?.full_name ?? "Unknown"}</button>
              <p className="text-xs text-muted-foreground">{ind.profile?.email}</p>
              {ind.id_type && (
                <p className="text-xs text-muted-foreground mt-1">
                  ID type: {ind.id_type === "NIN" ? "National ID (NIN)" : ind.id_type === "voter_card" ? "Voter's card" : ind.id_type === "drivers_license" ? "Driver's license" : "International passport"}
                </p>
              )}
            </div>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning flex items-center gap-1">
              <Clock className="size-3" /> Pending
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {ind.id_upload_path ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => viewID(ind.id_upload_path)}
              >
                <Eye className="size-3.5" /> View ID
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground italic">No ID uploaded</span>
            )}
            <Button
              size="sm"
              className="gap-1 bg-success text-success-foreground hover:bg-success/90"
              disabled={approve.isPending}
              onClick={() => approve.mutate(ind.user_id)}
            >
              <CheckCircle2 className="size-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={reject.isPending}
              onClick={() => reject.mutate(ind.user_id)}
            >
              <XCircle className="size-3.5" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompanyVerificationsTab() {
  const qc = useQueryClient();
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  const { data: pending, isLoading, refetch } = useQuery({
    queryKey: ["pending-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_profiles")
        .select("*, profile:profiles!company_profiles_user_id_fkey(id, full_name, email)")
        .eq("verified", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const approve = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("company_profiles")
        .update({ verified: true, verification_status: "approved", verified_at: new Date().toISOString() } as any)
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_approved",
        message: "Your business account has been verified. Your Verified Business badge is now active.",
        link: "/app/profile/me",
      });
    },
    onSuccess: () => {
      toast.success("Company verified successfully");
      refetch();
      qc.invalidateQueries({ queryKey: ["pending-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["profile-details"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve"),
  });

  const reject = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("company_profiles")
        .update({ verification_status: "rejected" } as any)
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_rejected",
        message: "Your business account could not be verified. Please contact support for assistance.",
        link: "/app",
      });
    },
    onSuccess: () => {
      toast.success("Company rejected and notified");
      refetch();
      qc.invalidateQueries({ queryKey: ["pending-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["profile-details"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not reject"),
  });

  async function viewDoc(path: string) {
    const { data } = await supabase.storage
      .from("company-docs")
      .createSignedUrl(path, 60);
    if (data?.signedUrl) setViewingImage(data.signedUrl);
    else toast.error("Could not load document image");
  }

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;

  if (!pending || pending.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-3" />
        <p className="font-medium text-foreground">All caught up</p>
        <p className="text-sm text-muted-foreground mt-1">No pending company verifications</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{pending.length} pending verification{pending.length === 1 ? "" : "s"}</p>

      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={viewingImage} alt="Company document" className="w-full rounded-xl" />
            <button
              onClick={() => setViewingImage(null)}
              className="absolute -top-3 -right-3 grid size-8 place-items-center rounded-full bg-card border border-border text-foreground"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />

      {pending.map((c: any) => (
        <div key={c.user_id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <button onClick={() => setViewingProfile(c.user_id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{c.company_name ?? c.profile?.full_name}</button>
              <p className="text-xs text-muted-foreground">{c.profile?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.industry ? `${c.industry} ·` : ""} {c.location ?? ""} {c.website ? `· ${c.website}` : ""}
              </p>
              {c.verification_method && (
                <p className="text-xs text-muted-foreground mt-1">
                  Method: {c.verification_method === "email" ? "Company email" : "CAC certificate"}
                  {c.company_email ? ` (${c.company_email})` : ""}
                  {c.cac_number ? ` · CAC: ${c.cac_number}` : ""}
                </p>
              )}
            </div>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning flex items-center gap-1">
              <Clock className="size-3" /> Pending
            </span>
          </div>

          <div className="flex gap-2 flex-wrap">
            {c.verification_doc_url ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => viewDoc(c.verification_doc_url)}
              >
                <Eye className="size-3.5" /> View document
              </Button>
            ) : c.verification_method === "email" ? (
              <span className="text-xs text-muted-foreground italic">Awaiting email verification</span>
            ) : (
              <span className="text-xs text-muted-foreground italic">No document uploaded</span>
            )}
            <Button
              size="sm"
              className="gap-1 bg-success text-success-foreground hover:bg-success/90"
              disabled={approve.isPending}
              onClick={() => approve.mutate(c.user_id)}
            >
              <CheckCircle2 className="size-3.5" /> Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={reject.isPending}
              onClick={() => reject.mutate(c.user_id)}
            >
              <XCircle className="size-3.5" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminUserProfileSheet({ userId, open, onOpenChange }: { userId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();

  const { data, isLoading } = useQuery<
    { profile: any; student: any; company: any; individual: any; tasks: any[] } | null
  >({
    queryKey: ["admin-user-profile", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) return null;
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!profile) return null;

      let student = null;
      let company = null;
      let individual = null;

      if (profile.role === "student" || profile.role === "alumni") {
        const { data } = await supabase
          .from("student_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        student = data;
      }
      if (profile.role === "company") {
        const { data } = await (supabase as any)
          .from("company_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        company = data;
      }
      if (profile.role === "individual") {
        const { data } = await (supabase as any)
          .from("individual_profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();
        individual = data;
      }

      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, budget, status")
        .eq("poster_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);

      return { profile, student, company, individual, tasks: tasks ?? [] };
    },
  });

  const profile = data?.profile;
  const student = data?.student;
  const company = data?.company;
  const individual = data?.individual;
  const tasks = data?.tasks ?? [];

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

            {/* Recent Tasks */}
            {tasks.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Tasks</h3>
                {tasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between text-sm">
                    <span className="truncate text-foreground max-w-[200px]">{t.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">₦{Number(t.budget).toLocaleString("en-NG")}</span>
                  </div>
                ))}
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
        .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, email, role)")
        .eq("id", taskId)
        .maybeSingle();
      if (!task) return null;

      const { data: applicants } = await supabase
        .from("applications")
        .select("id, status, created_at, applicant:profiles!applications_applicant_id_fkey(id, full_name, email)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      const { data: assignee } = (task as any).assignee_id
        ? await supabase.from("profiles").select("id, full_name, email").eq("id", (task as any).assignee_id).maybeSingle()
        : { data: null };

      return { task, applicants: applicants ?? [], assignee };
    },
  });

  const task = data?.task;
  const applicants = data?.applicants ?? [];
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

function ReportsTab() {
  const qc = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("reports")
        .select("*, reporter:profiles!reports_reporter_id_fkey(id, full_name, email), reported:profiles!reports_reported_id_fkey(id, full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await (supabase as any)
        .from("reports")
        .update({ status: "resolved" })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report marked as resolved");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not resolve"),
  });

  const dismiss = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await (supabase as any)
        .from("reports")
        .update({ status: "dismissed" })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report dismissed");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not dismiss"),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;

  if (!reports || reports.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-3" />
        <p className="font-medium text-foreground">No reports yet</p>
        <p className="text-sm text-muted-foreground mt-1">Reports from users will appear here</p>
      </div>
    );
  }

  const pending = reports.filter((r: any) => r.status === "pending");
  const resolved = reports.filter((r: any) => r.status !== "pending");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{pending.length} pending report{pending.length === 1 ? "" : "s"}</p>
          {pending.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{r.reporter?.full_name ?? "Unknown"}</span>
                    {" reported "}
                    <span className="font-medium text-destructive">{r.reported?.full_name ?? "Unknown"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.reporter?.email} → {r.reported?.email}</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{r.reason}</p>
                  {r.details && <p className="mt-1 text-sm text-muted-foreground">{r.details}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
                </div>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning shrink-0">Pending</span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-1 bg-success text-success-foreground hover:bg-success/90"
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate(r.id)}
                >
                  <CheckCircle2 className="size-3.5" /> Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-muted-foreground"
                  disabled={dismiss.isPending}
                  onClick={() => dismiss.mutate(r.id)}
                >
                  <XCircle className="size-3.5" /> Dismiss
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{resolved.length} resolved report{resolved.length === 1 ? "" : "s"}</p>
          {resolved.map((r: any) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 opacity-60">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{r.reporter?.full_name ?? "Unknown"}</span>
                {" reported "}
                <span className="font-medium text-foreground">{r.reported?.full_name ?? "Unknown"}</span>
              </p>
              <p className="mt-1 text-sm text-foreground">{r.reason}</p>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status === "resolved" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
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
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
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

function DisputesTab() {
  const qc = useQueryClient();
  const resolveDisputeServer = useServerFn(adminResolveDispute);

  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("disputes")
        .select("*, task:tasks(id, title, budget), raiser:profiles!disputes_raised_by_fkey(id, full_name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async ({ disputeId, resolution, releaseToStudent }: { disputeId: string; resolution: string; releaseToStudent: boolean }) => {
      await resolveDisputeServer({ data: { disputeId, resolution, releaseToStudent } });
    },
    onSuccess: () => {
      toast.success("Dispute resolved");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not resolve dispute"),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;

  if (!disputes || disputes.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-3" />
        <p className="font-medium text-foreground">No disputes</p>
        <p className="text-sm text-muted-foreground mt-1">All transactions are running smoothly</p>
      </div>
    );
  }

  const open = disputes.filter((d: any) => d.status === "open");
  const resolved = disputes.filter((d: any) => d.status === "resolved");

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">{open.length} open dispute{open.length === 1 ? "" : "s"}</p>
          {open.map((d: any) => (
            <DisputeCard key={d.id} dispute={d} onResolve={resolve.mutate} pending={resolve.isPending} />
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{resolved.length} resolved dispute{resolved.length === 1 ? "" : "s"}</p>
          {resolved.map((d: any) => (
            <div key={d.id} className="rounded-xl border border-border bg-card p-4 opacity-60">
              <p className="text-sm font-medium text-foreground">{d.task?.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Raised by {d.raiser?.full_name} · {d.reason}</p>
              <p className="text-xs text-success mt-1">Resolved: {d.resolution}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DisputeCard({ dispute, onResolve, pending }: { dispute: any; onResolve: (args: any) => void; pending: boolean }) {
  const [resolution, setResolution] = useState("");
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-xl border border-destructive/30 bg-card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-medium text-foreground">{dispute.task?.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Raised by <span className="font-medium">{dispute.raiser?.full_name}</span> · {dispute.raiser?.email}
          </p>
          <p className="mt-2 text-sm text-foreground">{dispute.reason}</p>
          {dispute.details && <p className="mt-1 text-sm text-muted-foreground">{dispute.details}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(dispute.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}
          </p>
          {dispute.task?.budget && (
            <p className="mt-1 text-sm font-medium text-success">
              Escrow: ₦{Number(dispute.task.budget).toLocaleString("en-NG")}
            </p>
          )}
        </div>
        <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive shrink-0">
          Open
        </span>
      </div>

      {!showForm ? (
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="w-full">
          Resolve this dispute
        </Button>
      ) : (
        <div className="space-y-3 mt-3 border-t border-border pt-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resolution note</label>
            <textarea
              rows={2}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="Describe how this was resolved..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <p className="text-xs font-medium text-foreground">Where should the escrow funds go?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              className="bg-success text-success-foreground hover:bg-success/90"
              disabled={!resolution || pending}
              onClick={() => onResolve({ disputeId: dispute.id, resolution, releaseToStudent: true })}
            >
              Release to student
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/30"
              disabled={!resolution || pending}
              onClick={() => onResolve({ disputeId: dispute.id, resolution, releaseToStudent: false })}
            >
              Refund to poster
            </Button>
          </div>
          <button className="text-xs text-muted-foreground" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}
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

function WithdrawalsTab() {
  const { data: withdrawals, isLoading, refetch } = useQuery({
    queryKey: ["admin-withdrawals"],
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("withdrawal_requests")
        .select("*, user:profiles!withdrawal_requests_user_id_fkey(full_name, email)")
        .order("created_at", { ascending: false });

      if (!error) return data ?? [];

      const { data: baseRows, error: baseError } = await (supabase as any)
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (baseError) throw baseError;

      const userIds = Array.from(new Set((baseRows ?? []).map((row: any) => row.user_id).filter(Boolean)));
      let profilesById: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await (supabase as any)
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        if (profilesError) throw profilesError;
        profilesById = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      }

      return (baseRows ?? []).map((row: any) => ({
        ...row,
        user: profilesById[row.user_id] ?? null,
      }));
    },
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;

  if (!withdrawals || withdrawals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <CheckCircle2 className="size-8 text-success mx-auto mb-3" />
        <p className="font-medium">No withdrawal requests</p>
        <p className="text-sm text-muted-foreground mt-1">Withdrawal requests will appear here</p>
      </div>
    );
  }

  const pending = withdrawals.filter((w: any) => w.status === "pending");
  const processed = withdrawals.filter((w: any) => w.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        Withdrawals are processed automatically via Paystack. This tab is for monitoring only.
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">{pending.length} pending withdrawal{pending.length === 1 ? "" : "s"}</p>
          {pending.map((w: any) => (
            <div key={w.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-medium text-foreground">{w.user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{w.user?.email}</p>
                  <p className="text-lg font-bold text-success mt-1">₦{Number(w.amount).toLocaleString("en-NG")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{w.bank_name} · {w.account_number}</p>
                  <p className="text-xs font-medium text-foreground">{w.account_name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning shrink-0">Pending</span>
              </div>
              <p className="text-xs text-muted-foreground">Awaiting Paystack transfer webhook update.</p>
            </div>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Processed requests</p>
          {processed.map((w: any) => (
            <div key={w.id} className="rounded-xl border border-border bg-card p-3 opacity-70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{w.user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">₦{Number(w.amount).toLocaleString("en-NG")} · {w.bank_name}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${w.status === "completed" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {w.status.charAt(0).toUpperCase() + w.status.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}