import { BookOpen } from "lucide-react";
import { Award } from "lucide-react";
import { Search } from "lucide-react";
import { DisputeButton } from "@/components/intask/DisputeButton";
import { BarChart2 } from "lucide-react";
import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
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
import { Briefcase, Plus, Inbox, ShieldCheck, Star, GraduationCap, AlertTriangle, Users, Wallet, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Clock, CheckCircle, MessageSquare, Bell } from "lucide-react";
import { OnboardingChecklist } from "@/components/intask/OnboardingChecklist";
import { useApplicantCount, applicantLabel } from "@/hooks/useApplicantCount";
import { MessagePartyLink } from "@/components/intask/MessagePartyLink";
import { MVP_FEATURES } from "@/lib/mvp-features";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";
import { getStudentActiveTasks, getProjectRoomForTask } from "@/lib/task.functions";
import {
  DashboardStatsSkeleton,
  WalletCardSkeleton,
  ActiveTasksSkeleton,
  ApplicationsSkeleton,
  ApplicationRowSkeleton,
  TaskFeedSkeleton,
} from "@/components/intask/Skeletons";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — InTask" }] }),
  component: Dashboard,
});

type Mode = "find" | "post";

function Dashboard() {
  const { user, profile, role } = useAuth();
  const nav = useNavigate();
  const routerLocation = useRouterState({ select: (s) => s.location });
  const modeFromSearch: Mode | null = (() => {
    const m = new URLSearchParams(routerLocation.searchStr).get("mode");
    return m === "post" ? "post" : m === "find" ? "find" : null;
  })();
  const [mode, setMode] = useState<Mode>(() => modeFromSearch ?? "find");
  const [filter, setFilter] = useState("All");
  const { data: accountDetails } = useQuery({
    queryKey: ["profile-details", user?.id],
    enabled: !!user && !!role,
    queryFn: async () => {
      if (!user || !role) return { student: null, company: null, individual: null };
      if (role === "student" || role === "alumni") {
        const { data, error } = await supabase.from("my_student_profile").select("*").maybeSingle();
        if (error) throw error;
        return { student: data as any, company: null, individual: null };
      }
      if (role === "company") {
        const { data, error } = await (supabase as any).from("my_company_profile").select("*").maybeSingle();
        if (error) throw error;
        return { student: null, company: data as any, individual: null };
      }
      if (role === "individual") {
        const { data, error } = await (supabase as any).from("my_individual_profile").select("*").maybeSingle();
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

  // Onboarding: count tasks applied/posted for checklist
  const { data: onboardingCounts } = useQuery({
    queryKey: ["onboarding-counts", user?.id, role],
    enabled: !!user?.id && !!role,
    queryFn: async () => {
      if (!user || !role) return { applied: 0, posted: 0 };
      const isSeeker = role === "student" || role === "alumni";
      const [applied, posted] = await Promise.all([
        isSeeker
          ? supabase
              .from("applications")
              .select("id", { count: "exact", head: true })
              .eq("student_id", user.id)
              .then((r) => r.count ?? 0)
          : Promise.resolve(0),
        !isSeeker
          ? supabase
              .from("tasks")
              .select("id", { count: "exact", head: true })
              .eq("poster_id", user.id)
              .then((r) => r.count ?? 0)
          : Promise.resolve(0),
      ]);
      return { applied, posted };
    },
  });

  useEffect(() => {
    if (modeFromSearch) return; // an explicit ?mode= in the URL wins
    if (role === "company" || role === "individual") {
      setMode("post");
    } else if (role === "student" || role === "alumni") {
      setMode("find");
    }
  }, [role, modeFromSearch]);

  const switchMode = (next: Mode) => {
    setMode(next);
    // Persist the mode in the URL so the sidebar / bottom nav can show the
    // matching label ("Browse Tasks" vs "Talent").
    nav({ to: "/app", search: { mode: next } as any });
  };

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

      {alumniPending && (
        <div className="pb-4">
          <div className="it-note-warning flex items-start gap-2 rounded-2xl border px-3 py-2.5 text-xs shadow-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>Alumni status unverified — we'll confirm this shortly.</p>
          </div>
        </div>
      )}

      <div className="pb-4">
        <OnboardingChecklist
          role={role}
          profileComplete={
            (role === "student" || role === "alumni")
              ? !!(accountDetails?.student?.university && accountDetails?.student?.year_of_study)
              : role === "company"
                ? !!(accountDetails?.company?.company_name)
                : !!accountDetails?.individual
          }
          tasksApplied={onboardingCounts?.applied ?? 0}
          tasksPosted={onboardingCounts?.posted ?? 0}
          verified={
            (role === "student" || role === "alumni")
              ? !!(accountDetails?.student?.verified)
              : role === "company"
                ? !!(accountDetails?.company?.verified)
                : !!(accountDetails?.individual?.verified)
          }
        />
      </div>

      {canFindWork && (
        <div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl border border-border/80 bg-muted p-1 text-sm font-medium shadow-sm">
            <button onClick={() => switchMode("find")}
              className={`rounded-md py-2 transition-colors ${mode === "find" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>
              Find work
            </button>
            <button onClick={() => switchMode("post")}
              className={`rounded-md py-2 transition-colors ${mode === "post" ? "bg-card text-foreground shadow-card" : "text-muted-foreground"}`}>
              Post work
            </button>
          </div>
        </div>
      )}

      {role === "alumni" && mode === "find" && MVP_FEATURES.mentorship && <MentorshipSection />}

      {mode === "find" && canFindWork ? (
        <FindWorkView userId={user?.id} filter={filter} onFilter={setFilter} onSwitchToPost={() => switchMode("post")} />
      ) : (
        <PosterDashboard userId={user?.id} role={role ?? ""} />
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
  const [showQuickLinks, setShowQuickLinks] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scrollFilters = (dir: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

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
      return { applied: apps.count ?? 0, active: (activeTasks ?? []).length, rating: avg, completed: studentProfile.data?.tasks_completed ?? 0 };
    },
  });

  // Fetch recent notifications for sidebar
  const { data: notifications = [] } = useQuery({
    queryKey: ["dashboard-notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("notifications")
        .select("id, message, created_at, read")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Fetch the student's recent applications with task details
  const { data: myApplications, isLoading: appsLoading } = useQuery({
    queryKey: ["my-applications", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("applications")
        .select("id, status, created_at, cover_message, task:tasks!applications_task_id_fkey(id, title, budget, status as task_status, category, deadline, poster:profiles!tasks_poster_id_fkey(id, full_name, avatar_url))")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingApps = (myApplications ?? []).filter((a: any) => a.status === "pending");
  const acceptedApps = (myApplications ?? []).filter((a: any) => a.status === "accepted");
  const rejectedApps = (myApplications ?? []).filter((a: any) => a.status === "rejected");

  // Compute stats for Freeio-style cards
  const applicationsCount = stats?.applied ?? 0;
  const activeTasksCount = stats?.active ?? 0;
  const completedTasksCount = stats?.completed ?? 0;
  const reviewCount = pendingApps.length;

  return (
    <div className="space-y-6 pt-5">
      {/* Dashboard heading */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>

      {/* Freeio-style stat cards */}
      {!stats ? <DashboardStatsSkeleton /> : (
        <section>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {/* stat cards */}
            <FreeioStatCard
              label="Applications"
              value={applicationsCount}
              icon={<Briefcase className="size-5" />}
              iconBg="bg-primary/10 text-primary"
            />
            <FreeioStatCard
              label="Active Tasks"
              value={activeTasksCount}
              icon={<Clock className="size-5" />}
              iconBg="bg-success/10 text-success"
            />
            <FreeioStatCard
              label="Completed"
              value={completedTasksCount}
              icon={<CheckCircle className="size-5" />}
              iconBg="bg-accent text-accent-foreground"
            />
            <FreeioStatCard
              label="Pending Review"
              value={reviewCount}
              icon={<MessageSquare className="size-5" />}
              iconBg="bg-warning/10 text-warning"
            />
          </div>
        </section>
      )}

      {/* Two-column: Profile Views chart + Notifications */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile Views Chart */}
        <div className="lg:col-span-2">
          <ProfileViewsChart userId={userId} />
        </div>

        {/* Notifications sidebar */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
            <Link to="/app/notifications" className="text-xs font-medium text-primary hover:underline">View all</Link>
          </div>
          {notifications.length === 0 ? (
            <p className="mt-4 text-xs text-muted-foreground">No notifications yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {notifications.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Bell className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-foreground line-clamp-2">{n.message}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Recent Service Orders (Freeio-style) */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h2 className="text-sm font-semibold text-foreground">Recent Applications</h2>
        <div className="mt-3 border-t border-border pt-3">
          {appsLoading ? (
            <ApplicationsSkeleton />
          ) : (myApplications?.length ?? 0) === 0 ? (
            <p className="text-xs text-muted-foreground">No applications found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-medium">Task</th>
                    <th className="pb-2 font-medium">Budget</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(myApplications ?? []).slice(0, 5).map((app: any) => (
                    <tr
                      key={app.id}
                      className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/50"
                      onClick={() => app.task?.id && nav({ to: "/app/tasks/$taskId", params: { taskId: app.task.id } })}
                    >
                      <td className="py-2.5 pr-4 font-medium text-foreground line-clamp-1">{app.task?.title ?? "—"}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {app.task?.budget && !app.task?.budget_negotiable ? naira(app.task.budget) : "Open"}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{app.task?.category ?? "—"}</td>
                      <td className="py-2.5 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          app.status === "pending" ? "bg-warning/15 text-warning" :
                          app.status === "accepted" ? "bg-success/15 text-success" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {app.status === "pending" ? "Pending" : app.status === "accepted" ? "Accepted" : "Not selected"}
                        </span>
                      </td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">{timeAgo(app.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Quick links — mentorship, internships, learn */}
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
              {MVP_FEATURES.mentorship && (
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
              )}

              {MVP_FEATURES.internships && (
              <Link
                to="/app/internships"
                className="block rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm active:bg-accent/50"
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
              )}

              {MVP_FEATURES.learn && (
              <div
                onClick={() => nav({ to: "/app/learn" as any })}
                className="cursor-pointer rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm active:bg-accent/50"
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
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
      )}


    </div>
  );
}

function FreeioStatCard({ label, value, icon, iconBg }: { label: string; value: number | string; icon: React.ReactNode; iconBg: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <span className={`grid size-10 place-items-center ${iconBg}`}>
          {icon}
        </span>
      </div>
    </div>
  );
}

function ProfileViewsChart({ userId }: { userId?: string }) {
  const nav = useNavigate();
  // Generate mock data for the last 7 days
  const labels = [];
  const values = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toLocaleDateString("en-NG", { month: "short", day: "numeric" }));
    values.push(Math.floor(Math.random() * 5)); // Placeholder data
  }
  const maxVal = Math.max(...values, 1);
  const chartHeight = 160;
  const barWidth = 100 / labels.length;

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Your Profile Views</h2>
        <span className="text-xs text-muted-foreground">Last 7 days</span>
      </div>
      <div className="mt-4" style={{ height: chartHeight }}>
        <svg viewBox="0 0 100 60" className="h-full w-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 1, 2, 3].map((i) => (
            <line key={i} x1="0" y1={i * 15 + 5} x2="100" y2={i * 15 + 5} stroke="currentColor" className="text-border/60" strokeWidth="0.2" />
          ))}
          {/* Line chart */}
          <polyline
            fill="none"
            stroke="currentColor"
            className="text-primary"
            strokeWidth="0.8"
            points={values.map((v, i) => `${(i * barWidth) + barWidth / 2},${55 - (v / maxVal) * 50}`).join(" ")}
          />
          {/* Data points */}
          {values.map((v, i) => (
            <circle
              key={i}
              cx={(i * barWidth) + barWidth / 2}
              cy={55 - (v / maxVal) * 50}
              r="1.2"
              fill="currentColor"
              className="text-primary"
            />
          ))}
        </svg>
      </div>
      <div className="mt-2 flex justify-between">
        {labels.map((l, i) => (
          <span key={i} className="text-[9px] text-muted-foreground">{l}</span>
        ))}
      </div>
    </div>
  );
}

function ActiveTasksSection({ userId }: { userId?: string }) {
  const nav = useNavigate();
  const loadStudentActiveTasks = useServerFn(getStudentActiveTasks);
  const loadProjectRoomForTask = useServerFn(getProjectRoomForTask);
  const { data: active, isLoading } = useQuery({
    queryKey: ["student-active", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      return await loadStudentActiveTasks();
    },
  });
  if (isLoading) return <ActiveTasksSkeleton />;
  if (!active || active.length === 0) {
    return (
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Active tasks</h2>
        <EmptyState
          icon={Briefcase}
          title="No active tasks yet"
          description="When you apply to a task and get accepted, it will show up here."
        />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">Active tasks</h2>
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

function PosterDashboard({ userId, role }: { userId?: string; role: string }) {
  const nav = useNavigate();
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedDays, setSelectedDays] = useState("15");

  const { data: myTasksList } = useQuery({
    queryKey: ["poster-tasks-list", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase.from("tasks").select("id, title").eq("poster_id", userId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: recentProposals } = useQuery({
    queryKey: ["recent-proposals", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data: tasks } = await supabase.from("tasks").select("id").eq("poster_id", userId);
      if (!tasks || tasks.length === 0) return [];
      const { data } = await supabase
        .from("applications")
        .select("id, task_id, message, price, hours, status, created_at, student:profiles!applications_student_id_fkey(full_name, avatar_url), task:tasks!applications_task_id_fkey(title)")
        .in("task_id", tasks.map((t) => t.id))
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: postedTasks } = useQuery({
    queryKey: ["poster-stats", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return { posted: 0, completed: 0, proposals: 0, reviews: 0 };
      const [posted, completed, proposals, reviews] = await Promise.all([
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("poster_id", userId),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("poster_id", userId).eq("status", "completed"),
        (async () => {
          const { data: tasks } = await supabase.from("tasks").select("id").eq("poster_id", userId);
          if (!tasks || tasks.length === 0) return 0;
          const { count } = await supabase.from("applications").select("id", { count: "exact", head: true }).in("task_id", tasks.map((t) => t.id));
          return count ?? 0;
        })(),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("reviewee_id", userId),
      ]);
      return {
        posted: posted.count ?? 0,
        completed: completed.count ?? 0,
        proposals: typeof proposals === "number" ? proposals : 0,
        reviews: reviews.count ?? 0,
      };
    },
  });

  const { data: notifs } = useQuery({
    queryKey: ["poster-notifs", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("notifications")
        .select("id, type, message, created_at, read")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const stats = postedTasks ?? { posted: 0, completed: 0, proposals: 0, reviews: 0 };

  return (
    <div className="space-y-6 pt-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PosterStatCard label="Posted Projects" value={stats.posted} icon={<Briefcase className="size-5" />} />
        <PosterStatCard label="Completed Projects" value={stats.completed} icon={<CheckCircle className="size-5" />} />
        <PosterStatCard label="Proposals" value={stats.proposals} icon={<Users className="size-5" />} />
        <PosterStatCard label="Reviews" value={stats.reviews} icon={<MessageSquare className="size-5" />} />
      </div>

      {/* Two-column: chart + notifications */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
        <div className="border border-[#E2E8F0] bg-white p-5">
          <h3 className="mb-4 text-[0.9rem] font-semibold text-[#1E293B]">Page Views</h3>
          <div className="flex h-48 items-end gap-1">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex-1">
                <div
                  className="rounded-t bg-[#16A34A] transition-all"
                  style={{ height: `${Math.max(4, Math.random() * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[0.65rem] text-[#94A3B8]">
            <span>1.0</span><span>0.8</span><span>0.6</span><span>0.4</span><span>0.2</span><span>0</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1.5 text-[0.8rem] font-semibold text-[#1E293B]">Projects</p>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="h-10 w-full border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[0.85rem] text-[#1E293B] focus:border-[#16A34A] focus:outline-none"
              >
                <option value="all">All Projects</option>
                {myTasksList?.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-[0.8rem] font-semibold text-[#1E293B]">Number Days</p>
              <select
                value={selectedDays}
                onChange={(e) => setSelectedDays(e.target.value)}
                className="h-10 w-full border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[0.85rem] text-[#1E293B] focus:border-[#16A34A] focus:outline-none"
              >
                <option value="7">7 days</option>
                <option value="15">15 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>
          </div>
        </div>

        <div className="border border-[#E2E8F0] bg-white p-5">
          <h3 className="mb-4 text-[0.9rem] font-semibold text-[#1E293B]">Notifications</h3>
          {notifs && notifs.length > 0 ? (
            <div className="space-y-3">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-start gap-3">
                  <div className="mt-0.5 size-2 shrink-0 rounded-full bg-[#16A34A]" />
                  <div className="min-w-0">
                    <p className="text-[0.8rem] font-medium text-[#1E293B] line-clamp-1">{n.type}</p>
                    <p className="text-[0.7rem] text-[#6B7280] line-clamp-1">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[0.8rem] text-[#6B7280]">No notifications yet.</p>
          )}
          {notifs && notifs.length > 0 && (
            <Link to="/app/notifications" className="mt-3 block text-center text-[0.75rem] font-medium text-[#16A34A] hover:underline">
              View all →
            </Link>
          )}
        </div>
      </div>

      {/* Recent Proposals */}
      <div className="border border-[#E2E8F0] bg-white p-5">
        <h3 className="mb-4 text-[0.9rem] font-semibold text-[#1E293B]">Recent Proposals</h3>
        {!recentProposals || recentProposals.length === 0 ? (
          <p className="text-[0.8rem] text-[#6B7280]">No proposals found.</p>
        ) : (
          <div className="space-y-3">
            {recentProposals.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between border border-[#E2E8F0] bg-[#FFFFFF] p-3">
                <div className="flex items-center gap-3">
                  <InitialsAvatar name={p.student?.full_name ?? "User"} size={36} avatarUrl={p.student?.avatar_url} />
                  <div>
                    <p className="text-[0.8rem] font-semibold text-[#1E293B]">{p.student?.full_name ?? "Anonymous"}</p>
                    <p className="text-[0.7rem] text-[#6B7280]">{p.task?.title ?? "Task"}</p>
                  </div>
                </div>
                <div className="text-right">
                  {p.price && <p className="text-[0.8rem] font-semibold text-[#1E293B]">₦{Number(p.price).toLocaleString("en-NG")}</p>}
                  <span className={`inline-block px-2 py-0.5 text-[0.65rem] font-medium ${
                    p.status === "accepted" ? "bg-[#e8f5e9] text-[#2e7d32]" :
                    p.status === "rejected" ? "bg-[#fce4ec] text-[#c62828]" :
                    "bg-[#fff3e0] text-[#e65100]"
                  }`}>
                    {p.status === "accepted" ? "Approved" : p.status === "rejected" ? "Rejected" : "Pending"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PosterStatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="border border-[#E2E8F0] bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.75rem] text-[#6B7280]">{label}</p>
          <p className="mt-1 text-[1.4rem] font-bold text-[#1E293B]">{value}</p>
        </div>
        <div className="grid size-10 place-items-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
          {icon}
        </div>
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

      {isLoading && <TaskFeedSkeleton />}

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
            <InitialsAvatar name={task.poster?.full_name} size={24} avatarUrl={task.poster?.avatar_url} />
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

function ApplicationRow({ app }: { app: any }) {
  const nav = useNavigate();
  const task = app.task;
  const poster = task?.poster;
  const status = app.status as string;
  const taskStatus = task?.task_status as string;

  const statusColors: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    accepted: "bg-success/15 text-success",
    rejected: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pending",
    accepted: "Accepted",
    rejected: "Not selected",
  };

  return (
    <div
      onClick={() => task?.id && nav({ to: "/app/tasks/$taskId", params: { taskId: task.id } })}
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card transition-colors active:bg-accent/50"
    >
      <InitialsAvatar name={poster?.full_name} size={36} avatarUrl={poster?.avatar_url} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{task?.title ?? "Task"}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {poster?.full_name && <span>{poster.full_name}</span>}
          {task?.budget && !task?.budget_negotiable && <span>· {naira(task.budget)}</span>}
          {task?.category && <span>· {task.category}</span>}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColors[status] ?? "bg-muted text-muted-foreground"}`}>
        {statusLabels[status] ?? status}
      </span>
    </div>
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

