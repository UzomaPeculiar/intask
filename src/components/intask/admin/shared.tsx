import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, CheckCircle2, Clock, ExternalLink, Eye, Globe, GraduationCap, Mail, MapPin, Phone, XCircle } from "lucide-react";
import { getAdminUserWalletData } from "@/lib/admin.functions";

export function AdminUserProfileSheet({ userId, open, onOpenChange }: { userId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const loadAdminUserWalletData = useServerFn(getAdminUserWalletData);

  const { data, isLoading } = useQuery<any | null>({
    queryKey: ["admin-user-profile", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) return null;
      const { data: profile } = await (supabase as any).from("profiles").select("*").eq("id", userId).maybeSingle();
      if (!profile) return null;

      let student = null;
      let company = null;
      let individual = null;

      if (profile.role === "student" || profile.role === "alumni") {
        const { data } = await supabase.from("student_profiles").select("*").eq("user_id", userId).maybeSingle();
        student = data;
      }
      if (profile.role === "company") {
        const { data } = await (supabase as any).from("company_profiles").select("*").eq("user_id", userId).maybeSingle();
        company = data;
      }
      if (profile.role === "individual") {
        const { data } = await (supabase as any).from("individual_profiles").select("*").eq("user_id", userId).maybeSingle();
        individual = data;
      }

      const { data: postedTasks } = await supabase.from("tasks").select("id, title, budget, status, created_at").eq("poster_id", userId).order("created_at", { ascending: false }).limit(10);
      const { data: appliedTasks } = await (supabase as any).from("applications").select("id, status, created_at, task:tasks(id, title, budget, status)").eq("student_id", userId).order("created_at", { ascending: false }).limit(10);
      const { data: reviewsReceived } = await (supabase as any).from("reviews").select("id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name, email)").eq("reviewee_id", userId).order("created_at", { ascending: false }).limit(10);
      const { data: reportsAgainst } = await (supabase as any).from("reports").select("id, reason, details, status, created_at, reporter:profiles!reports_reporter_id_fkey(full_name, email)").eq("reported_id", userId).order("created_at", { ascending: false }).limit(10);
      const { data: reportsBy } = await (supabase as any).from("reports").select("id, reason, details, status, created_at, reported:profiles!reports_reported_id_fkey(full_name, email)").eq("reporter_id", userId).order("created_at", { ascending: false }).limit(10);

      return { profile, student, company, individual, postedTasks: postedTasks ?? [], appliedTasks: appliedTasks ?? [], reviewsReceived: reviewsReceived ?? [], reportsAgainst: reportsAgainst ?? [], reportsBy: reportsBy ?? [] };
    },
  });

  const { data: adminWalletData } = useQuery<{ wallet: any; walletTransactions: any[] } | null>({
    queryKey: ["admin-user-wallet", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) return null;
      return await loadAdminUserWalletData({ data: { userId } });
    },
  });

  const setAccountStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: "active" | "suspended" | "banned"; reason?: string }) => {
      if (!userId) throw new Error("No user selected");
      const { data: auth } = await supabase.auth.getUser();
      const meId = auth.user?.id;
      if (!meId) throw new Error("Could not identify current admin");
      if (meId === userId) throw new Error("You cannot change your own status here");
      const patch = status === "active" ? { account_status: "active", account_status_reason: null, suspended_at: null } : { account_status: status, account_status_reason: reason ?? null, suspended_at: new Date().toISOString() };
      const { error } = await (supabase as any).from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
      await (supabase as any).from("audit_log").insert({ admin_user_id: meId, action: status === "active" ? "user.reactivate" : status === "banned" ? "user.ban" : "user.suspend", target_type: "user", target_id: userId, details: { reason: reason ?? null, status } });
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
  const wallet = adminWalletData?.wallet ?? null;
  const walletTransactions = adminWalletData?.walletTransactions ?? [];
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

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[85vh] overflow-y-auto rounded-t-2xl" : "w-[400px] sm:w-[540px] overflow-y-auto"}><SheetHeader className="space-y-1"><SheetTitle>User Profile</SheetTitle><SheetDescription>Full details for verification review</SheetDescription></SheetHeader>{isLoading && <div className="flex items-center justify-center py-10"><div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}{!isLoading && !profile && <p className="text-sm text-muted-foreground py-10 text-center">User not found</p>}{profile && <div className="space-y-5 mt-4"><div className="flex items-center gap-3"><InitialsAvatar name={profile.full_name} size={56} avatarUrl={profile.avatar_url} /><div className="min-w-0"><p className="font-semibold text-foreground truncate">{profile.full_name}</p><p className="text-xs text-muted-foreground truncate">{profile.email}</p><div className="mt-1"><VerifiedBadge role={profile.role} verified={profile.role === "company" ? company?.verified : profile.role === "individual" ? individual?.verified : student?.verified} /></div></div></div><div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h3>{profile.phone && <div className="flex items-center gap-2 text-sm"><Phone className="size-3.5 text-muted-foreground" /> {profile.phone}</div>}{profile.email && <div className="flex items-center gap-2 text-sm"><Mail className="size-3.5 text-muted-foreground" /> {profile.email}</div>}<div className="text-sm text-muted-foreground">Role: <span className="font-medium text-foreground capitalize">{profile.role}</span></div>{profile.created_at && <div className="text-sm text-muted-foreground">Joined: <span className="font-medium text-foreground">{new Date(profile.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span></div>}{profile.last_active_at && <div className="text-sm text-muted-foreground">Last active: <span className="font-medium text-foreground">{new Date(profile.last_active_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</span></div>}<div className="text-sm text-muted-foreground">Status:<span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${(profile.account_status ?? "active") === "active" ? "bg-success/15 text-success" : (profile.account_status ?? "active") === "suspended" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"}`}>{profile.account_status ?? "active"}</span></div>{profile.account_status_reason && <p className="text-xs text-muted-foreground">Reason: {profile.account_status_reason}</p>}<div className="flex flex-wrap gap-2 pt-1">{(profile.account_status ?? "active") === "active" ? <><Button size="sm" variant="outline" onClick={() => statusAction("suspended")} disabled={setAccountStatus.isPending}>Suspend user</Button><Button size="sm" variant="outline" className="border-destructive/40 text-destructive" onClick={() => statusAction("banned")} disabled={setAccountStatus.isPending}>Ban user</Button></> : <Button size="sm" variant="outline" onClick={() => statusAction("active")} disabled={setAccountStatus.isPending}>Reactivate user</Button>}</div></div>{(profile.role === "student" || profile.role === "alumni") && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{profile.role === "alumni" ? "Alumni" : "Student"} Details</h3>{student?.university && <div className="flex items-center gap-2 text-sm"><GraduationCap className="size-3.5 text-muted-foreground" /> {student.university}</div>}{student?.department && <div className="text-sm text-muted-foreground">Dept: <span className="font-medium text-foreground">{student.department}</span></div>}{student?.year_of_study && <div className="text-sm text-muted-foreground">Year: <span className="font-medium text-foreground">{student.year_of_study}</span></div>}{student?.university_email && <div className="flex items-center gap-2 text-sm"><Mail className="size-3.5 text-muted-foreground" /> {student.university_email}</div>}{student?.skills?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{student.skills.map((sk: string) => <span key={sk} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">{sk}</span>)}</div>}<div className="text-sm text-muted-foreground mt-1">Verified: <span className={`font-medium ${student?.verified ? "text-success" : "text-warning"}`}>{student?.verified ? "Yes" : "No"}</span></div></div>}{profile.role === "company" && company && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Details</h3>{company.company_name && <div className="flex items-center gap-2 text-sm"><Building2 className="size-3.5 text-muted-foreground" /> {company.company_name}</div>}{company.industry && <div className="text-sm text-muted-foreground">Industry: <span className="font-medium text-foreground">{company.industry}</span></div>}{company.location && <div className="flex items-center gap-2 text-sm"><MapPin className="size-3.5 text-muted-foreground" /> {company.location}</div>}{company.website && <div className="flex items-center gap-2 text-sm"><Globe className="size-3.5 text-muted-foreground" /><a href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 truncate max-w-[200px]">{company.website}</a></div>}{company.company_email && <div className="flex items-center gap-2 text-sm"><Mail className="size-3.5 text-muted-foreground" /> {company.company_email}</div>}{company.cac_number && <div className="text-sm text-muted-foreground">CAC: <span className="font-medium text-foreground">{company.cac_number}</span></div>}<div className="text-sm text-muted-foreground mt-1">Verified: <span className={`font-medium ${company.verified ? "text-success" : "text-warning"}`}>{company.verified ? "Yes" : "No"}</span></div></div>}{profile.role === "individual" && individual && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Individual Details</h3><div className="text-sm text-muted-foreground">Verified: <span className={`font-medium ${individual.verified ? "text-success" : "text-warning"}`}>{individual.verified ? "Yes" : "No"}</span></div></div>}{postedTasks.length > 0 && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posted Tasks</h3>{postedTasks.map((t: any) => <div key={t.id} className="flex items-center justify-between text-sm"><span className="truncate text-foreground max-w-[200px]">{t.title}</span><span className="text-xs text-muted-foreground shrink-0 ml-2">₦{Number(t.budget).toLocaleString("en-NG")}</span></div>)}</div>}{appliedTasks.length > 0 && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applied Tasks</h3>{appliedTasks.map((a: any) => <div key={a.id} className="text-sm"><p className="font-medium text-foreground truncate">{a.task?.title ?? "Unknown task"}</p><p className="text-xs text-muted-foreground">Application: {a.status} · Task: {a.task?.status ?? "-"}</p></div>)}</div>}<div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Summary</h3>{wallet ? <div className="grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Balance</p><p className="font-semibold text-foreground">₦{Number(wallet.balance ?? 0).toLocaleString("en-NG")}</p></div><div><p className="text-xs text-muted-foreground">Earned</p><p className="font-semibold text-foreground">₦{Number(wallet.total_earned ?? 0).toLocaleString("en-NG")}</p></div><div><p className="text-xs text-muted-foreground">Withdrawn</p><p className="font-semibold text-foreground">₦{Number(wallet.total_withdrawn ?? 0).toLocaleString("en-NG")}</p></div></div> : <p className="text-sm text-muted-foreground">No wallet record found.</p>}</div>{walletTransactions.length > 0 && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Transactions</h3>{walletTransactions.map((tx: any) => <div key={tx.id} className="flex items-center justify-between gap-2 text-sm"><div className="min-w-0"><p className="truncate text-foreground">{tx.description || (tx.transaction_type === "credit" ? "Credit" : "Debit")}</p><p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })} · {tx.status}</p></div><span className={`font-medium ${tx.transaction_type === "credit" ? "text-success" : "text-foreground"}`}>{tx.transaction_type === "credit" ? "+" : "-"}₦{Number(tx.amount).toLocaleString("en-NG")}</span></div>)}</div>}{reviewsReceived.length > 0 && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviews Received</h3>{reviewsReceived.map((r: any) => <div key={r.id} className="text-sm"><p className="text-foreground">{r.rating}/5 from {r.reviewer?.full_name ?? "Unknown"}</p>{r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}</div>)}</div>}{(reportsAgainst.length > 0 || reportsBy.length > 0) && <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reports</h3></div>}<a href={`/app/profile/${userId}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline"><ExternalLink className="size-3.5" /> View full profile in app</a><a href={`/app/profile/${userId}?admin_view=1`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline"><ExternalLink className="size-3.5" /> View as user surface</a></div>}</SheetContent></Sheet>;
}

export function AdminTaskDetailSheet({ taskId, open, onOpenChange }: { taskId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const isMobile = useIsMobile();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-task-detail", taskId],
    enabled: !!taskId && open,
    queryFn: async () => {
      if (!taskId) return null;
      const { data: task } = await supabase.from("tasks").select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, email, role)").eq("id", taskId).maybeSingle();
      if (!task) return null;
      const { data: applicants } = await supabase.from("applications").select("id, status, created_at, applicant:profiles!applications_applicant_id_fkey(id, full_name, email)").eq("task_id", taskId).order("created_at", { ascending: false });
      const { data: transactions } = await (supabase as any).from("transactions").select("id, amount, platform_fee, status, paystack_reference, created_at, updated_at").eq("task_id", taskId).order("created_at", { ascending: false });
      const { data: disputes } = await (supabase as any).from("disputes").select("id, reason, details, resolution, status, created_at, updated_at, raiser:profiles!disputes_raised_by_fkey(full_name, email)").eq("task_id", taskId).order("created_at", { ascending: false });
      const { data: conversation } = await (supabase as any).from("conversations").select("id").eq("task_id", taskId).maybeSingle();
      let messages: any[] = [];
      if (conversation?.id) {
        const { data: msg } = await (supabase as any).from("messages").select("id, content, created_at, sender:profiles!messages_sender_id_fkey(full_name, email)").eq("conversation_id", conversation.id).order("created_at", { ascending: false }).limit(20);
        messages = msg ?? [];
      }
      const { data: assignee } = (task as any).assignee_id ? await supabase.from("profiles").select("id, full_name, email").eq("id", (task as any).assignee_id).maybeSingle() : { data: null };
      return { task, applicants: applicants ?? [], transactions: transactions ?? [], disputes: disputes ?? [], messages, assignee };
    },
  });
  const task = data?.task; const applicants = data?.applicants ?? []; const transactions = data?.transactions ?? []; const disputes = data?.disputes ?? []; const messages = data?.messages ?? []; const assignee = data?.assignee;
  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[85vh] overflow-y-auto rounded-t-2xl" : "w-[400px] sm:w-[540px] overflow-y-auto"}><SheetHeader className="space-y-1"><SheetTitle>Task Details</SheetTitle><SheetDescription>Full task information</SheetDescription></SheetHeader>{isLoading && <div className="flex items-center justify-center py-10"><div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}{!isLoading && !task && <p className="text-sm text-muted-foreground py-10 text-center">Task not found</p>}{task && <div className="space-y-5 mt-4"><div><div className="flex items-start justify-between gap-2"><p className="font-semibold text-foreground leading-tight">{task.title}</p><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${task.status === "open" ? "bg-success/15 text-success" : task.status === "in_progress" ? "bg-primary/15 text-primary" : task.status === "completed" ? "bg-muted text-muted-foreground" : task.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{task.status.replace(/_/g, " ")}</span></div>{task.description && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{task.description}</p>}</div><div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Details</h3><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Budget</p><p className="text-lg font-semibold text-success">₦{Number(task.budget).toLocaleString("en-NG")}</p></div>{task.category && <div><p className="text-xs text-muted-foreground">Category</p><p className="text-sm font-medium text-foreground capitalize">{task.category}</p></div>}</div></div>{applicants.length > 0 && <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Applicants ({applicants.length})</h3><div className="space-y-2">{applicants.map((a: any) => <div key={a.id} className="flex items-center justify-between"><div className="flex items-center gap-2 min-w-0"><InitialsAvatar name={a.applicant?.full_name} size={24} /><div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{a.applicant?.full_name}</p><p className="text-xs text-muted-foreground truncate">{a.applicant?.email}</p></div></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${a.status === "accepted" ? "bg-success/15 text-success" : a.status === "rejected" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{a.status}</span></div>)}</div></div>}<div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transaction Record</h3>{transactions.length === 0 ? <p className="text-sm text-muted-foreground">No transaction created yet.</p> : transactions.map((tx: any) => <div key={tx.id} className="text-sm"><p className="text-foreground">₦{Number(tx.amount).toLocaleString("en-NG")} · fee ₦{Number(tx.platform_fee ?? 0).toLocaleString("en-NG")}</p><p className="text-xs text-muted-foreground">Status: {tx.status} · Ref: {tx.paystack_reference ?? "-"}</p></div>)}</div><div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversation Thread</h3>{messages.length === 0 ? <p className="text-sm text-muted-foreground">No messages for this task yet.</p> : <div className="space-y-2">{messages.map((m: any) => <div key={m.id} className="rounded-lg border border-border bg-background px-3 py-2"><p className="text-xs text-muted-foreground">{m.sender?.full_name ?? "Unknown"} · {new Date(m.created_at).toLocaleString("en-NG")}</p><p className="mt-1 text-sm text-foreground">{m.content || "(attachment or empty message)"}</p></div>)}</div>}</div><div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3"><h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dispute History</h3>{disputes.length === 0 ? <p className="text-sm text-muted-foreground">No disputes recorded for this task.</p> : disputes.map((d: any) => <div key={d.id} className="text-sm"><p className="text-foreground">{d.reason} · {d.status}</p>{d.details && <p className="text-xs text-muted-foreground">{d.details}</p>}{d.resolution && <p className="text-xs text-success">Resolution: {d.resolution}</p>}</div>)}</div><a href={`/app/tasks/${taskId}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline"><ExternalLink className="size-3.5" /> View task in app</a></div>}</SheetContent></Sheet>;
}

export function FeaturedTaskRow({ task }: { task: any }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  async function toggleFeatured() {
    setLoading(true);
    const nowFeatured = !task.featured;
    await (supabase as any).from("tasks").update({ featured: nowFeatured, featured_until: nowFeatured ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null }).eq("id", task.id);
    setLoading(false);
    qc.invalidateQueries({ queryKey: ["admin-command-center"] });
    qc.invalidateQueries({ queryKey: ["admin-task-management"] });
    toast.success(nowFeatured ? "Task featured for 7 days" : "Task unfeatured");
  }
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{task.title}</p><p className="text-xs text-muted-foreground">{task.poster?.full_name}</p>{task.featured && task.featured_until && <p className="text-xs text-warning">Featured until {new Date(task.featured_until).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</p>}</div><Button size="sm" variant={task.featured ? "outline" : "default"} disabled={loading} onClick={toggleFeatured} className={task.featured ? "text-muted-foreground" : ""}>{loading ? "..." : task.featured ? "Unfeature" : "⭐ Feature"}</Button></div>;
}
