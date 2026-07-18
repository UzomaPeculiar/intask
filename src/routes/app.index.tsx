import { DisputeButton } from "@/components/intask/DisputeButton";
import { BarChart2 } from "lucide-react";
import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth.tsx";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge, StatusPill } from "@/components/intask/Badges";
import { EmptyState } from "@/components/intask/EmptyState";
import { Button } from "@/components/ui/button";
import { naira, timeAgo } from "@/lib/format";
import { FEED_FILTERS } from "@/lib/constants";
import { Briefcase, Plus, Inbox, ShieldCheck, Star, GraduationCap, AlertTriangle } from "lucide-react";
import { useApplicantCount, applicantLabel } from "@/hooks/useApplicantCount";
import { MessagePartyLink } from "@/components/intask/MessagePartyLink";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — InTask" }] }),
  component: Dashboard,
});

type Mode = "find" | "post";

function Dashboard() {
  const [mode, setMode] = useState<Mode>("find");
  const [filter, setFilter] = useState("All");
  const { user, profile, role } = useAuth();
  const { data: accountDetails } = useQuery({
    queryKey: ["profile-details", user?.id],
    enabled: !!user && !!role,
    queryFn: async () => {
      if (!user || !role) return { student: null, company: null };
      if (role === "student" || role === "alumni") {
        const { data, error } = await supabase.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        return { student: data as any, company: null };
      }
      if (role === "company") {
        const { data, error } = await supabase.from("company_profiles").select("*").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        return { student: null, company: data as any };
      }
      return { student: null, company: null };
    },
  });

  useEffect(() => {
    if (role === "company" || role === "individual") {
      setMode("post");
    } else if (role === "student" || role === "alumni") {
      setMode("find");
    }
  }, [role]);

  const canFindWork = role === "student" || role === "alumni";
  const greetingName = profile?.full_name?.split(" ")[0];
  const greetingText = greetingName ? `${greeting()}, ${greetingName}` : greeting();
  const verified = accountDetails?.student?.verified ?? false;
  const companyPending = role === "company" && !!accountDetails?.company && !accountDetails.company.verified;
  const alumniPending = role === "alumni" && !verified;

  return (
    <div className="mx-auto max-w-md">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-5">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{greetingText}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            {(role === "student" || role === "alumni") && accountDetails?.student?.university && (
              <span className="truncate text-xs text-muted-foreground">
                {accountDetails.student.university}
                {accountDetails.student.year_of_study ? ` · ${accountDetails.student.year_of_study}` : ""}
              </span>
            )}
            {role === "student" && <VerifiedBadge role="student" verified={verified} />}
            {role === "alumni" && <VerifiedBadge role="alumni" />}
            {(role === "company" || role === "individual") && <VerifiedBadge role={role} />}
          </div>
        </div>
        <Link to="/app/profile/$userId" params={{ userId: "me" }}><InitialsAvatar name={profile?.full_name ?? undefined} size={40} /></Link>
      </header>

      {(companyPending || alumniPending) && (
        <div className="px-4 pb-3">
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-xs text-warning">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              {alumniPending
                ? "Alumni status unverified — we'll confirm this shortly."
                : "Business verification pending — your account is under review."}
            </p>
          </div>
        </div>
      )}

      {canFindWork && (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1 text-sm font-medium">
            <button onClick={() => setMode("find")}
              className={`rounded-md py-2 transition-colors ${mode === "find" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>
              Find work
            </button>
            <button onClick={() => setMode("post")}
              className={`rounded-md py-2 transition-colors ${mode === "post" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>
              Post work
            </button>
          </div>
        </div>
      )}

      {role === "alumni" && mode === "find" && <MentorshipSection />}

      {mode === "find" && canFindWork ? (
        <FindWorkView userId={user?.id} filter={filter} onFilter={setFilter} onSwitchToPost={() => setMode("post")} />
      ) : (
        <PostWorkView userId={user?.id} />
      )}
    </div>
  );
}

function MentorshipSection() {
  const nav = useNavigate();
  return (
    <div className="px-4 pt-4">
      <div className="rounded-xl border border-warning/30 bg-gradient-to-br from-warning/10 to-card p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-warning/20 text-warning">
              <GraduationCap className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Mentorship</h2>
              <p className="text-xs text-muted-foreground">Share your expertise and earn</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => nav({ to: "/app/mentorship/manage" as any })}>
            Manage
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" className="w-full" onClick={() => nav({ to: "/app/mentorship" as any})}>
            Browse mentors
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={() => nav({ to: "/app/mentorship/bookings" as any })}>
            My bookings
          </Button>
        </div>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function FindWorkView({ userId, filter, onFilter, onSwitchToPost }: { userId?: string; filter: string; onFilter: (f: string) => void; onSwitchToPost: () => void }) {
  const nav = useNavigate();
  const { data: stats } = useQuery({
    queryKey: ["student-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const [apps, active, studentProfile] = await Promise.all([
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("student_id", userId),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("matched_student_id", userId).in("status", ["matched", "in_progress", "in_review"]),
        supabase.from("student_profiles").select("rating_average, rating_count, tasks_completed").eq("user_id", userId).maybeSingle(),
      ]);
      const avg = (studentProfile.data?.rating_count ?? 0) > 0 ? studentProfile.data?.rating_average : null;
      return { applied: apps.count ?? 0, active: active.count ?? 0, rating: avg };
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["feed", filter],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role)").eq("status", "open").order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(40);
      if (filter !== "All") q = q.ilike("category", `%${filter}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-5 px-4 pt-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Tasks applied" value={stats?.applied ?? 0} />
        <StatCard label="Active" value={stats?.active ?? 0} />
        <StatCard label="Rating" value={stats?.rating ? Number(stats.rating).toFixed(1) : "—"} icon={<Star className="size-3.5 fill-warning text-warning" />} />
      </div>

      <div
        onClick={() => nav({ to: "/app/mentorship" as any })}
        className="cursor-pointer rounded-xl border border-warning/30 bg-gradient-to-br from-warning/10 to-card p-4 shadow-card"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-warning/20 text-warning">
              <GraduationCap className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Mentorship</p>
              <p className="text-xs text-muted-foreground">Book 1-on-1 sessions with alumni</p>
            </div>
          </div>
        <span className="text-xs font-medium text-warning">Browse →</span>
      </div>
    </div>

      <div className="relative -mx-4">
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FEED_FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button key={f} onClick={() => onFilter(f)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                }`}>{f}</button>
            );
          })}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
      </div>

      <section className="space-y-3">
        <ActiveTasksSection userId={userId} />
        {isLoading && <SkeletonList />}
        {!isLoading && (tasks?.length ?? 0) === 0 && (
          <EmptyState
            icon={Inbox}
            title="No open tasks yet"
            description="Check back soon, or be the first to post one."
            action={<Button onClick={onSwitchToPost} className="gap-1"><Plus className="size-4" /> Post a task</Button>}
          />
        )}
        {tasks?.map((t) => <TaskCard key={t.id} task={t} currentUserId={userId} />)}
      </section>
    </div>
  );
}

function ActiveTasksSection({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const { data: active } = useQuery({
    queryKey: ["student-active", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role)")
        .eq("matched_student_id", userId)
        .in("status", ["matched", "in_progress", "in_review"])
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  if (!active || active.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active tasks</h2>
      <div className="space-y-3">
        {active.map((t: any) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 font-medium text-foreground">{t.title}</h3>
              <span className="shrink-0 text-sm font-semibold text-success">{naira(t.budget)}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <InitialsAvatar name={t.poster?.full_name} size={24} />
              <span className="truncate text-xs text-foreground">{t.poster?.full_name ?? "Poster"}</span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                {t.status === "in_review" ? "In review" : t.status === "matched" ? "Awaiting payment" : "In progress"}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <MessagePartyLink taskId={t.id} studentId={t.matched_student_id} posterId={t.poster_id} label="Message poster" />
                <Button
                  onClick={() => nav({ to: "/app/tasks/$taskId/deliver", params: { taskId: t.id } })}
                  disabled={t.status !== "in_progress"}
                >
                  Submit my work
                </Button>
              </div>
              {t.status === "in_progress" && (
                <DisputeButton taskId={t.id} taskTitle={t.title} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostWorkView({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: mine, isLoading } = useQuery({
    queryKey: ["my-tasks", userId],
    enabled: !!userId,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    queryFn: async () => {
      if (!userId) return [];
      const { data: tasks, error } = await supabase
        .from("tasks").select("*").eq("poster_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (tasks ?? []).map((t) => t.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: apps } = await supabase
          .from("applications").select("task_id").in("task_id", ids).eq("status", "pending");
        for (const a of apps ?? []) counts[a.task_id] = (counts[a.task_id] ?? 0) + 1;
      }
      return (tasks ?? []).map((t) => ({ ...t, applicants_count: counts[t.id] ?? 0 }));
    },
  });

  const taskIdsKey = (mine ?? []).map((t) => t.id).sort().join(",");
  useEffect(() => {
    if (!userId || !taskIdsKey) return;
    const taskIds = taskIdsKey.split(",");
    const titleById = new Map((mine ?? []).map((t) => [t.id, t.title]));
    const channel = supabase
      .channel(`poster-apps-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "applications" }, (payload) => {
        const row: any = payload.new;
        if (!row?.task_id || !taskIds.includes(row.task_id)) return;
        const title = titleById.get(row.task_id) ?? "your task";
        toast.success(`New applicant for ${title}`);
        qc.invalidateQueries({ queryKey: ["my-tasks", userId] });
        qc.invalidateQueries({ queryKey: ["applicants", row.task_id] });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "applications" }, (payload) => {
        const row: any = payload.old;
        if (!row?.task_id || !taskIds.includes(row.task_id)) return;
        qc.invalidateQueries({ queryKey: ["my-tasks", userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, taskIdsKey, qc]);

  const groups = {
    open: mine?.filter((t) => t.status === "open") ?? [],
    in_progress: mine?.filter((t) => ["matched", "in_progress"].includes(t.status)) ?? [],
    in_review: mine?.filter((t) => t.status === "in_review") ?? [],
    completed: mine?.filter((t) => t.status === "completed") ?? [],
    expired: mine?.filter((t) => (t.status as string) === "expired") ?? [],
  };

  return (
    <div className="space-y-5 px-4 pt-4">
      <Button size="lg" className="w-full gap-2" onClick={() => nav({ to: "/app/tasks/create" })}>
        <Plus className="size-4" /> Post a new task
      </Button>

      {isLoading && <SkeletonList />}

      {!isLoading && (mine?.length ?? 0) === 0 && (
        <EmptyState icon={Briefcase} title="No tasks yet" description="Post your first task and verified students will start applying."
          action={<Button onClick={() => nav({ to: "/app/tasks/create" })}>Post a task</Button>} />
      )}

      {(["open", "in_progress", "in_review", "completed", "expired"] as const).map((k) => groups[k].length > 0 && (
        <section key={k} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {k === "open" ? "Open" : k === "in_progress" ? "In progress" : k === "in_review" ? "Review needed" : k === "expired" ? "Expired" : "Completed"}
          </h2>
          <div className="space-y-3">
            {groups[k].map((t) => (
              <PosterTaskRow key={t.id} task={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number | string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-center gap-1 text-lg font-semibold text-foreground">{icon}{value}</div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function PosterTaskRow({ task }: { task: any }) {
  const nav = useNavigate();
  const count = useApplicantCount(task.id, task.applicants_count ?? 0);
  const taskStatus = task.status as string;
  const isMatched = taskStatus === "matched" || taskStatus === "in_progress";
  const isReview = taskStatus === "in_review";
  return (
    <div
      onClick={() => nav({ to: isReview ? "/app/tasks/$taskId/review" : "/app/tasks/$taskId/applicants", params: { taskId: task.id } })}
      className="block cursor-pointer rounded-xl border border-border bg-card p-4 shadow-card"
    >
      <div className="flex items-start gap-2">
        <h3 className="line-clamp-2 font-medium text-foreground flex-1">{task.title}</h3>
        {task.featured && (
        <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
          ⭐ Featured
        </span>
        )}
      </div>
      {isReview && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
          <AlertTriangle className="size-4" /> Work submitted — review needed
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <StatusPill status={task.status} />
        <span className="text-xs text-muted-foreground">{applicantLabel(count)}</span>
      </div>
      <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2">
          {isMatched && task.matched_student_id && (
            <MessagePartyLink
              taskId={task.id}
              studentId={task.matched_student_id}
              posterId={task.poster_id}
              label="Message student"
              className="flex-1"
            />
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1 shrink-0"
            onClick={() => nav({ to: "/app/tasks/$taskId/analytics", params: { taskId: task.id } })}
          >
            <BarChart2 className="size-3.5" /> Stats
          </Button>
        </div>
        {taskStatus === "in_progress" && (
          <DisputeButton taskId={task.id} taskTitle={task.title} />
        )}
      </div>
    </div>
  );
}

const CATEGORY_AVERAGES: Record<string, number> = {
  "Web Design": 25000,
  "Mobile App Dev": 60000,
  "UI/UX Design": 25000,
  "Graphic Design": 15000,
  "Content Writing": 8000,
  "Copywriting": 8000,
  "Video Editing": 20000,
  "Photography": 15000,
  "Data Analysis": 20000,
  "Research": 12000,
  "Python": 25000,
  "JavaScript": 25000,
  "Social Media": 12000,
  "Math Tutoring": 8000,
  "Science Tutoring": 8000,
  "English Tutoring": 8000,
  "Business Analysis": 20000,
  "Product Management": 25000,
  "Virtual Assistant": 12000,
  "Excel/Spreadsheets": 12000,
};

function getAboveAverageThreshold(category: string): number {
  return CATEGORY_AVERAGES[category] ?? 15000;
}

export function TaskCard({ task, currentUserId }: { task: any; currentUserId?: string }) {
  const count = useApplicantCount(task.id, task.applicants_count ?? 0);
  return (
    <Link to="/app/tasks/$taskId" params={{ taskId: task.id }} className="block">
      <article className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors active:bg-accent/50">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-medium text-foreground">{task.title}</h3>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="rounded-md bg-success/15 px-2 py-0.5 text-sm font-semibold text-success">
              {task.budget_negotiable ? "Open" : naira(task.budget)}
            </span>
            {!task.budget_negotiable && task.budget >= getAboveAverageThreshold(task.category) && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                Above average pay
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{task.category}</span>
          {(task as any).is_team_task && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              👥 Team · {(task as any).team_size} students
            </span>
          )}
          {task.deadline && <span>Due {new Date(task.deadline).toLocaleDateString("en-NG", { month: "short", day: "numeric" })}</span>}
          <span>· {timeAgo(task.created_at)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <InitialsAvatar name={task.poster?.full_name} size={24} />
            <span className="truncate text-xs text-foreground">{task.poster?.full_name ?? "Poster"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">{count} applicant{count === 1 ? "" : "s"}</span>
            <SaveTaskButton taskId={task.id} userId={currentUserId} />
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3 text-success" /> Payment held safely until work is approved
        </p>
      </article>
    </Link>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  );
}