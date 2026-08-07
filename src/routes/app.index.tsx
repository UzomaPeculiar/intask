import { BookOpen } from "lucide-react";
import { Award } from "lucide-react";
import { Search } from "lucide-react";
import { DisputeButton } from "@/components/intask/DisputeButton";
import { BarChart2 } from "lucide-react";
import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth.tsx";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge, StatusPill } from "@/components/intask/Badges";
import { EmptyState } from "@/components/intask/EmptyState";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { naira, timeAgo } from "@/lib/format";
import { FEED_FILTERS } from "@/lib/constants";
import { Briefcase, Plus, Inbox, ShieldCheck, Star, GraduationCap, AlertTriangle, Users, Wallet, ChevronDown, ChevronUp } from "lucide-react";
import { useApplicantCount, applicantLabel } from "@/hooks/useApplicantCount";
import { MessagePartyLink } from "@/components/intask/MessagePartyLink";
import { MVP_FEATURES } from "@/lib/mvp-features";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";
import { getStudentActiveTasks, getProjectRoomForTask } from "@/lib/task.functions";

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
      if (!user || !role) return { student: null, company: null, individual: null };
      if (role === "student" || role === "alumni") {
        const { data, error } = await supabase.from("student_profiles").select("*").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        return { student: data as any, company: null, individual: null };
      }
      if (role === "company") {
        const { data, error } = await supabase.from("company_profiles").select("*").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        return { student: null, company: data as any, individual: null };
      }
      if (role === "individual") {
        const { data, error } = await supabase.from("individual_profiles").select("*").eq("user_id", user.id).maybeSingle();
        if (!error) return { student: null, company: null, individual: data as any };
      }
      return { student: null, company: null, individual: null };
    },
  });

  const { data: alumniProSub } = useQuery({
    queryKey: ["alumni-pro-sub", user?.id],
    enabled: role === "alumni" && !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("alumni_pro_subscriptions")
        .select("id, status")
        .eq("alumni_id", user!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-5 lg:px-8 lg:pt-6">
      <header className="flex items-start justify-between gap-3 pb-4">
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
            {role === "alumni" && <VerifiedBadge role="alumni" isPro={!!alumniProSub} />}
            {role === "company" && <VerifiedBadge role="company" verified={accountDetails?.company?.verified} />}
            {role === "individual" && <VerifiedBadge role="individual" verified={accountDetails?.individual?.verified} />}
          </div>
        </div>
        <Link to="/app/profile/$userId" params={{ userId: "me" }}>
          <InitialsAvatar name={profile?.full_name ?? undefined} size={40} avatarUrl={(profile as any)?.avatar_url} />
        </Link>
      </header>

      {(companyPending || alumniPending) && (
        <div className="pb-4">
          <div className="it-note-warning flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-xs shadow-sm">
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
        <div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border/80 bg-muted p-1 text-sm font-medium shadow-sm">
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

      {role === "alumni" && mode === "find" && MVP_FEATURES.mentorship && <MentorshipSection />}

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
    <div className="pt-4">
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
          <Button size="sm" variant="outline" className="w-full gap-1" onClick={() => nav({ to: "/app/talent" as any })}>
            <Search className="size-3.5" /> Search talent
          </Button>
          <Button size="sm" variant="outline" className="w-full gap-1 col-span-2 border-warning/30 text-warning hover:bg-warning/10" onClick={() => nav({ to: "/app/alumni-pro" as any })}>
            <Award className="size-3.5" /> Alumni Pro
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
  const loadStudentActiveTasks = useServerFn(getStudentActiveTasks);
  const loadProjectRoomForTask = useServerFn(getProjectRoomForTask);
  const [showQuickLinks, setShowQuickLinks] = useState(false);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const { data: stats } = useQuery({
    queryKey: ["student-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return null;
      const [apps, activeTasks, studentProfile] = await Promise.all([
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("student_id", userId),
        loadStudentActiveTasks(),
        supabase.from("student_profiles").select("rating_average, rating_count, tasks_completed").eq("user_id", userId).maybeSingle(),
      ]);
      const avg = (studentProfile.data?.rating_count ?? 0) > 0 ? studentProfile.data?.rating_average : null;
      return { applied: apps.count ?? 0, active: (activeTasks ?? []).length, rating: avg };
    },
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["feed", filter],
    queryFn: async () => {
      let q = supabase.from("tasks").select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role)").eq("status", "open").order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(40);
      if (userId) q = q.neq("poster_id", userId);
      if (filter !== "All") q = q.ilike("category", `%${filter}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const taskCategories = Array.from(new Set((tasks ?? []).map((t: any) => t.category).filter(Boolean)));
  const { data: categoryBudgetStats = {} } = useCategoryBudgetStats(taskCategories);

  const visibleFilters = showAllFilters ? FEED_FILTERS : FEED_FILTERS.slice(0, 7);

  return (
    <div className="space-y-6 pt-5">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Overview</h2>
          <span className="text-xs text-muted-foreground">What needs your attention</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatCard label="Tasks applied" value={stats?.applied ?? 0} />
          <StatCard label="Active" value={stats?.active ?? 0} />
          <StatCard label="Rating" value={stats?.rating ? Number(stats.rating).toFixed(1) : "—"} icon={<Star className="size-3.5 fill-warning text-warning" />} />
        </div>
        <WalletBalanceCard userId={userId} />
      </section>

      {(MVP_FEATURES.mentorship || MVP_FEATURES.internships || MVP_FEATURES.learn) && (
      <section className="space-y-2">
        <Collapsible open={showQuickLinks} onOpenChange={setShowQuickLinks}>
          <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/90 px-4 py-3 shadow-sm">
            <div>
              <p className="text-sm font-semibold text-foreground">Explore more opportunities</p>
              <p className="text-xs text-muted-foreground">Mentorship, internships, and learning tracks</p>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {showQuickLinks ? "Hide" : "View"}
                {showQuickLinks ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="pt-2">
            <div className="space-y-2">
              <Link
                to="/app/mentorship"
                className="block rounded-2xl border border-warning/30 bg-gradient-to-br from-warning/10 to-card p-4 shadow-sm"
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
              </Link>

              <Link
                to="/app/internships"
                className="block rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:bg-accent/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-foreground">
                      <Briefcase className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Internships</p>
                      <p className="text-xs text-muted-foreground">Longer-term opportunities from companies</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-accent-foreground">Browse →</span>
                </div>
              </Link>

              <div
                onClick={() => nav({ to: "/app/learn" as any })}
                className="cursor-pointer rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md active:bg-accent/50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-warning/10 text-warning">
                      <BookOpen className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">InTask Learn</p>
                      <p className="text-xs text-muted-foreground">Short courses to boost your skills and earnings</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-warning">Browse →</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Task feed</h2>
          <button
            onClick={() => setShowAllFilters((prev) => !prev)}
            className="it-link-accent text-xs font-medium hover:underline"
          >
            {showAllFilters ? "Fewer filters" : "More filters"}
          </button>
        </div>
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-wrap lg:overflow-visible lg:pr-0">
            {visibleFilters.map((f) => {
              const active = f === filter;
              return (
                <button key={f} onClick={() => onFilter(f)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    active ? "it-chip-active" : "border-border bg-card text-foreground"
                  }`}>{f}</button>
              );
            })}
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent" />
        </div>
      </section>

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
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3">
          {tasks?.map((t) => <TaskCard key={t.id} task={t} currentUserId={userId} categoryBudgetStats={categoryBudgetStats} />)}
        </div>
      </section>
    </div>
  );
}

function ActiveTasksSection({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const loadStudentActiveTasks = useServerFn(getStudentActiveTasks);
  const loadProjectRoomForTask = useServerFn(getProjectRoomForTask);
  const { data: active } = useQuery({
    queryKey: ["student-active", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      return await loadStudentActiveTasks();
    },
  });
  if (!active || active.length === 0) return null;
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active tasks</h2>
      <div className="space-y-3">
        {active.map((t: any) => (
          <div key={t.id} className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
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
              <div className={`grid gap-2 ${t.is_team_task ? "grid-cols-1" : "grid-cols-2"}`}>
                <MessagePartyLink taskId={t.id} studentId={t.matched_student_id} posterId={t.poster_id} label="Message poster" />
                {!t.is_team_task && (
                  <Button
                    onClick={() => nav({ to: "/app/tasks/$taskId/deliver", params: { taskId: t.id } })}
                    disabled={t.status !== "in_progress"}
                  >
                    Submit my work
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                className="w-full gap-1"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const room = t.room_id
                    ? { roomId: t.room_id }
                    : await loadProjectRoomForTask({ data: { taskId: t.id } }).catch(() => null);
                  const roomId = (room as any)?.roomId ?? (room as any)?.room_id;
                  if (roomId) nav({ to: "/app/rooms/$roomId", params: { roomId } });
                  else toast.error("Project room not found");
                }}
              >
                <Users className="size-3.5" /> Open project room
              </Button>
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
  const loadProjectRoomForTask = useServerFn(getProjectRoomForTask);
  const [togglingFeaturedTaskId, setTogglingFeaturedTaskId] = useState<string | null>(null);

  async function fetchFeaturedQuota(companyId: string) {
    const { data: subData } = await (supabase as any)
      .from("company_subscriptions")
      .select("plan:subscription_plans(name, featured_posts)")
      .eq("company_id", companyId)
      .eq("status", "active")
      .maybeSingle();

    const plan = subData?.plan;
    const planName = plan?.name ?? null;
    const planNameLower = String(planName ?? "").toLowerCase();
    const mappedCap = planNameLower.includes("pro") ? 5 : planNameLower.includes("growth") ? 2 : 0;
    const explicitPlanCap = Number(plan?.featured_posts ?? 0);
    const cap = explicitPlanCap > 0 ? explicitPlanCap : mappedCap;

    if (!cap || cap <= 0) {
      return { planName, cap: 0, used: 0, remaining: 0 };
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const monthlyCount = await (supabase as any)
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("poster_id", companyId)
      .gte("featured_set_at", monthStart)
      .lt("featured_set_at", nextMonthStart);

    let used = monthlyCount.count ?? 0;

    if (monthlyCount.error) {
      const { count: fallbackCount } = await (supabase as any)
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("poster_id", companyId)
        .eq("featured", true);
      used = fallbackCount ?? 0;
    }

    return { planName, cap, used, remaining: Math.max(cap - used, 0) };
  }

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

  const { data: featuredQuota, isLoading: featuredQuotaLoading } = useQuery({
    queryKey: ["featured-quota", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { planName: null as string | null, cap: 0, used: 0, remaining: 0 };
      return fetchFeaturedQuota(userId);
    },
  });

  async function toggleFeaturedTask(task: any) {
    if (!userId) return;

    const isCurrentlyFeatured = !!task.featured;
    if (!isCurrentlyFeatured && task.status !== "open") {
      toast.error("Only open tasks can be featured.");
      return;
    }

    if (!isCurrentlyFeatured) {
      const liveQuota = featuredQuota ?? (await fetchFeaturedQuota(userId));
      const cap = liveQuota.cap ?? 0;
      const remaining = liveQuota.remaining ?? 0;
      if (cap <= 0) {
        toast.error("Your current plan has no featured listings. Upgrade to unlock this feature.");
        return;
      }
      if (remaining <= 0) {
        toast.error(`You've reached your monthly featured limit (${cap}). Try again next month or upgrade your plan.`);
        return;
      }
    }

    setTogglingFeaturedTaskId(task.id);
    try {
      const nowIso = new Date().toISOString();
      const featuredUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const payload = isCurrentlyFeatured
        ? { featured: false, featured_until: null }
        : { featured: true, featured_until: featuredUntil, featured_set_at: nowIso };

      let { error } = await (supabase as any)
        .from("tasks")
        .update(payload)
        .eq("id", task.id)
        .eq("poster_id", userId);

      // Backward-compatible fallback for databases that have not run the featured_set_at migration yet.
      if (
        error &&
        !isCurrentlyFeatured &&
        String(error.message ?? "").toLowerCase().includes("featured_set_at")
      ) {
        const retry = await (supabase as any)
          .from("tasks")
          .update({ featured: true, featured_until: featuredUntil })
          .eq("id", task.id)
          .eq("poster_id", userId);
        error = retry.error;
      }

      if (error) throw error;

      toast.success(isCurrentlyFeatured ? "Task removed from featured listings." : "Task is now featured.");

      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-tasks", userId] }),
        qc.invalidateQueries({ queryKey: ["feed"] }),
        qc.invalidateQueries({ queryKey: ["featured-quota", userId] }),
      ]);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update featured status");
    } finally {
      setTogglingFeaturedTaskId(null);
    }
  }

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

  const firstReviewTask = groups.in_review[0];
  const pipeline = {
    open: groups.open.length,
    inProgress: groups.in_progress.length,
    review: groups.in_review.length,
    completed: groups.completed.length,
  };

  return (
    <div className="space-y-5 pt-5">
      <Button size="lg" className="w-full gap-2" onClick={() => nav({ to: "/app/tasks/create" })}>
        <Plus className="size-4" /> Post a new task
      </Button>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Overview</h2>
          <span className="text-xs text-muted-foreground">Live status for your work pipeline</span>
        </div>
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <StatCard label="Open" value={pipeline.open} />
          <StatCard label="In progress" value={pipeline.inProgress} />
          <StatCard label="Review needed" value={pipeline.review} icon={pipeline.review > 0 ? <AlertTriangle className="size-3.5 text-warning" /> : undefined} />
          <StatCard label="Completed" value={pipeline.completed} />
        </div>
        <WalletBalanceCard userId={userId} />
      </section>

      {pipeline.review > 0 && firstReviewTask && (
        <Button
          variant="outline"
          className="w-full justify-between"
          onClick={() => nav({ to: "/app/tasks/$taskId/review", params: { taskId: firstReviewTask.id } })}
        >
          <span className="inline-flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            Review submissions
          </span>
          <span className="text-xs text-muted-foreground">{pipeline.review} pending</span>
        </Button>
      )}

      {MVP_FEATURES.featuredTasks && <SubscriptionBanner userId={userId} />}

      {MVP_FEATURES.featuredTasks && <div className="rounded-xl border border-border bg-card p-3 shadow-card">
        <p className="text-sm font-medium text-foreground">Featured listings this month</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {featuredQuotaLoading
            ? "Loading your featured slots..."
            : (featuredQuota?.cap ?? 0) > 0
              ? `${featuredQuota?.used ?? 0} of ${featuredQuota?.cap ?? 0} used · ${featuredQuota?.remaining ?? 0} remaining`
              : "No featured slots on your current plan"}
        </p>
      </div>}

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
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {groups[k].map((t) => (
              <PosterTaskRow
                key={t.id}
                task={t}
                onToggleFeatured={toggleFeaturedTask}
                togglingFeatured={togglingFeaturedTaskId === t.id}
              />
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

function PosterTaskRow({
  task,
  onToggleFeatured,
  togglingFeatured,
}: {
  task: any;
  onToggleFeatured?: (task: any) => void;
  togglingFeatured?: boolean;
}) {
  const nav = useNavigate();
  const loadProjectRoomForTask = useServerFn(getProjectRoomForTask);
  const count = useApplicantCount(task.id, task.applicants_count ?? 0);
  const taskStatus = task.status as string;
  const isTeamTask = Boolean(task.is_team_task);
  const isMatched = taskStatus === "matched" || taskStatus === "in_progress";
  const isReview = taskStatus === "in_review";
  const isOpen = taskStatus === "open";
  const canOpenTask = isMatched || isReview || taskStatus === "completed";
  const canOpenRoom = canOpenTask && !!(task.is_team_task || task.matched_student_id);
  const featureButtonDisabled = togglingFeatured || (!task.featured && !isOpen);
  return (
    <div
      onClick={() => nav({ to: canOpenTask ? "/app/tasks/$taskId" : "/app/tasks/$taskId/applicants", params: { taskId: task.id } })}
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
        <div className="it-note-warning mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium">
          <AlertTriangle className="size-4" /> Work submitted — review needed
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <StatusPill status={task.status} />
        <span className="text-xs text-muted-foreground">{applicantLabel(count)}</span>
      </div>
      <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex gap-2">
          {!isTeamTask && isMatched && task.matched_student_id && (
            <MessagePartyLink
              taskId={task.id}
              studentId={task.matched_student_id}
              posterId={task.poster_id}
              label="Message student"
              className="flex-1"
            />
          )}
          {canOpenRoom && (
            <Button
              variant="outline"
              size="sm"
              className={isTeamTask ? "w-full gap-1" : "gap-1 shrink-0"}
              onClick={async () => {
                const room = await loadProjectRoomForTask({ data: { taskId: task.id } }).catch(() => null);
                const roomId = (room as any)?.roomId ?? (room as any)?.room_id;
                if (roomId) nav({ to: "/app/rooms/$roomId", params: { roomId } });
                else toast.error("Project room not found");
              }}
            >
              <Users className="size-3.5" /> Room
            </Button>
          )}
          {!isTeamTask && MVP_FEATURES.featuredTasks && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 shrink-0"
              disabled={featureButtonDisabled}
              onClick={() => onToggleFeatured?.(task)}
            >
              <Star className="size-3.5" />
              {togglingFeatured ? "Saving..." : task.featured ? "Unfeature" : "Feature"}
            </Button>
          )}
          {!isTeamTask && MVP_FEATURES.advancedAnalytics && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1 shrink-0"
              onClick={() => nav({ to: "/app/tasks/$taskId/analytics", params: { taskId: task.id } })}
            >
              <BarChart2 className="size-3.5" /> Stats
            </Button>
          )}
        </div>
        {taskStatus === "in_progress" && (
          <DisputeButton taskId={task.id} taskTitle={task.title} />
        )}
      </div>
    </div>
  );
}

function useCategoryBudgetStats(categories: string[]) {
  const key = [...categories].sort().join("|");
  return useQuery({
    queryKey: ["category-budget-stats", key],
    enabled: categories.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, category, budget, budget_negotiable")
        .in("category", categories)
        .eq("budget_negotiable", false)
        .gt("budget", 0);

      if (error) throw error;

      const sums: Record<string, number> = {};
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        if (!row.category || !row.budget) continue;
        sums[row.category] = (sums[row.category] ?? 0) + Number(row.budget);
        counts[row.category] = (counts[row.category] ?? 0) + 1;
      }

      const stats: Record<string, { sum: number; count: number }> = {};
      for (const category of Object.keys(sums)) {
        stats[category] = { sum: sums[category], count: counts[category] ?? 0 };
      }
      return stats;
    },
    staleTime: 60_000,
  });
}

export function TaskCard({ task, currentUserId, categoryBudgetStats = {} }: { task: any; currentUserId?: string; categoryBudgetStats?: Record<string, { sum: number; count: number }> }) {
  const nav = useNavigate();
  const loadRuntimePlatformSettings = useServerFn(getRuntimePlatformSettings);
  const { data: platformFeePercentSetting } = useQuery({
    queryKey: ["runtime-platform-settings"],
    queryFn: async () => await loadRuntimePlatformSettings(),
    staleTime: 30_000,
  });
  const platformFeePercent = Math.min(
    100,
    Math.max(0, Number(platformFeePercentSetting?.platform_fee_percent ?? PLATFORM_SETTING_DEFAULTS.platform_fee_percent)),
  );
  const payoutRate = 1 - platformFeePercent / 100;
  const count = useApplicantCount(task.id, task.applicants_count ?? 0);
  const stats = categoryBudgetStats[task.category];
  const budgetValue = Number(task.budget ?? 0);
  const hasBenchmark = !task.budget_negotiable && budgetValue > 0 && !!stats && stats.count > 0;
  const benchmark = hasBenchmark
    ? stats!.count > 1
      ? (stats!.sum - budgetValue) / Math.max(1, stats!.count - 1)
      : stats!.sum / stats!.count
    : null;
  const isAboveAveragePay = hasBenchmark && typeof benchmark === "number" && budgetValue > benchmark;
  return (
    <Link to="/app/tasks/$taskId" params={{ taskId: task.id }} className="block">
      <article className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors active:bg-accent/50">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 font-medium text-foreground">{task.title}</h3>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="rounded-md bg-success/15 px-2 py-0.5 text-sm font-semibold text-success">
              {task.budget_negotiable ? "Open" : naira(task.budget)}
            </span>
            {isAboveAveragePay && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
                Above average pay
              </span>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">{task.category}</span>
          {(task as any).is_team_task && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              👥 Team · {(task as any).team_size} students · ₦{task.budget ? Math.floor((task.budget * payoutRate) / (task as any).team_size).toLocaleString("en-NG") : "0"} each
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

function SubscriptionBanner({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const { data: sub } = useQuery({
    queryKey: ["my-subscription", userId],
    enabled: !!userId,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_subscriptions")
        .select("*, plan:subscription_plans(name, max_active_posts, featured_posts, can_search_talent)")
        .eq("company_id", userId!)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  if (sub) {
    return (
      <div className="space-y-2">
      <div className="it-note-success rounded-xl border p-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-success">{sub.plan?.name} plan</p>
          <p className="text-xs text-muted-foreground">
            {sub.plan?.max_active_posts === 999 ? "Unlimited posts" : `${sub.plan?.max_active_posts} active posts`}
          </p>
          <p className="text-xs text-muted-foreground">
            {sub.plan?.featured_posts ? `${sub.plan.featured_posts} featured listing${sub.plan.featured_posts === 1 ? "" : "s"} / month` : "No featured listings"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => nav({ to: "/app/subscription" as any })}>
          Manage
        </Button>
      </div>
      {sub.plan?.can_search_talent && (
        <Button 
          variant="outline"
          className="w-full gap-2"
          onClick={() => nav({ to: "/app/talent" as any })}
        >
          <Search className="size-4" /> Search talent pool
        </Button>
      )}
    </div>
  );
}

  return (
    <div
      className="it-note-accent cursor-pointer rounded-xl border p-3 flex items-center justify-between"
      onClick={() => nav({ to: "/app/subscription" as any })}
    >
      <div>
        <p className="text-sm font-medium text-foreground">Upgrade your plan</p>
        <p className="text-xs text-muted-foreground">Post more tasks and search talent directly</p>
      </div>
      <span className="it-link-accent text-xs font-medium">View plans →</span>
    </div>
  );
}

function WalletBalanceCard({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const { data: wallet } = useQuery({
    queryKey: ["wallet", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("wallets")
        .select("balance")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const balance = Number(wallet?.balance ?? 0);

  return (
    <div
      className="it-note-success cursor-pointer rounded-xl border p-3 flex items-center justify-between"
      onClick={() => nav({ to: "/app/wallet" as any })}
    >
      <div className="flex items-center gap-2">
        <Wallet className="size-4 text-success" />
        <div>
          <p className="text-xs text-muted-foreground">Wallet balance</p>
          <p className="text-sm font-semibold text-success">₦{balance.toLocaleString("en-NG")}</p>
        </div>
      </div>
      <span className="text-xs text-success font-medium">View →</span>
    </div>
  );
}

