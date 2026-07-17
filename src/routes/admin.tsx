import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, Users, Briefcase, DollarSign, CheckCircle2, XCircle, Clock, Building2, Eye } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — InTask" }] }),
  component: AdminPage,
});

function AdminPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"overview" | "students" | "companies" | "reports" | "disputes">("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { nav({ to: "/auth/login", search: { redirect: "/admin" } }); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin, id")
        .eq("id", data.user.id)
        .maybeSingle() as any;
      if (!(profile as any)?.is_admin) {
        nav({ to: "/app" });
        return;
      }
      setIsAdmin(true);
    });
  }, []);

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
          {(["overview", "students", "companies", "reports", "disputes"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground hover:bg-accent"
              }`}
            >
              {t === "overview" ? "Overview" : t === "students" ? "Student Verifications" : t === "companies" ? "Company Verifications" : t === "reports" ? "Reports" : "Disputes"}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab />}
        {tab === "students" && <StudentVerificationsTab />}
        {tab === "companies" && <CompanyVerificationsTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "disputes" && <DisputesTab />}
      </div>
    </div>
  );
}

function OverviewTab() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, tasks, transactions] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("tasks").select("id", { count: "exact", head: true }),
        supabase.from("transactions").select("amount").eq("status", "released"),
      ]);

      const { data: pendingStudentsData } = await supabase
        .from("student_profiles")
        .select("user_id")
        .eq("verified", false)
        .not("id_upload_path", "is", null);

      const { data: pendingCompaniesData } = await supabase
        .from("company_profiles")
        .select("user_id")
        .eq("verified", false);

      const { data: openTasks, error: tasksError } = await supabase
        .from("tasks")
        .select("id, title, featured, featured_until, poster_id")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(20);

      const totalPayout = (transactions.data ?? []).reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

      return {
        users: users.count ?? 0,
        tasks: tasks.count ?? 0,
        totalPayout,
        pendingStudents: (pendingStudentsData ?? []).length,
        pendingCompanies: (pendingCompaniesData ?? []).length,
        openTasks: openTasks ?? [],
      };
    },
  });

  const statCards = [
    { label: "Total users", value: stats?.users ?? 0, icon: Users, color: "text-primary bg-primary/10" },
    { label: "Total tasks", value: stats?.tasks ?? 0, icon: Briefcase, color: "text-success bg-success/15" },
    { label: "Total paid out", value: `₦${Number(stats?.totalPayout ?? 0).toLocaleString("en-NG")}`, icon: DollarSign, color: "text-warning bg-warning/15" },
    { label: "Pending student IDs", value: stats?.pendingStudents ?? 0, icon: Clock, color: "text-destructive bg-destructive/10" },
    { label: "Pending companies", value: stats?.pendingCompanies ?? 0, icon: Building2, color: "text-warning bg-warning/15" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className={`grid size-9 place-items-center rounded-lg ${color} mb-3`}>
              <Icon className="size-5" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

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
              <p className="font-medium text-foreground">{s.profile?.full_name ?? "Unknown"}</p>
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

function CompanyVerificationsTab() {
  const qc = useQueryClient();

  const { data: pending, isLoading } = useQuery({
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
        .update({ verified: true })
        .eq("user_id", userId);
      if (error) throw error;
      await supabase.from("profiles")
        .update({ is_admin: false } as any)
        .eq("id", userId);
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_approved",
        message: "Your business account has been verified. You can now post tasks.",
        link: "/app",
      });
    },
    onSuccess: () => {
      toast.success("Company verified successfully");
      qc.invalidateQueries({ queryKey: ["pending-companies"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not approve"),
  });

  const reject = useMutation({
    mutationFn: async (userId: string) => {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "verification_rejected",
        message: "Your business account could not be verified. Please contact support for assistance.",
        link: "/app",
      });
    },
    onSuccess: () => {
      toast.success("Company notified");
      qc.invalidateQueries({ queryKey: ["pending-companies"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not reject"),
  });

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

      {pending.map((c: any) => (
        <div key={c.user_id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="font-medium text-foreground">{c.company_name ?? c.profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{c.profile?.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {c.industry ? `${c.industry} ·` : ""} {c.location ?? ""} {c.website ? `· ${c.website}` : ""}
              </p>
            </div>
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning flex items-center gap-1">
              <Clock className="size-3" /> Pending
            </span>
          </div>

          <div className="flex gap-2">
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
      await (supabase as any)
        .from("disputes")
        .update({ status: "resolved", resolution, updated_at: new Date().toISOString() })
        .eq("id", disputeId);
      if (releaseToStudent) {
        const dispute = disputes?.find((d: any) => d.id === disputeId);
        if (dispute?.task_id) {
          await supabase.from("transactions")
            .update({ status: "released" } as any)
            .eq("task_id", dispute.task_id);
          await supabase.from("tasks")
            .update({ status: "completed" } as any)
            .eq("id", dispute.task_id);
        }
      } else {
        const dispute = disputes?.find((d: any) => d.id === disputeId);
        if (dispute?.task_id) {
          await supabase.from("transactions")
            .update({ status: "refunded" } as any)
            .eq("task_id", dispute.task_id);
          await supabase.from("tasks")
            .update({ status: "cancelled" } as any)
            .eq("id", dispute.task_id);
        }
      }
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