import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEED_FILTERS } from "@/lib/constants";
import { TaskCard } from "./app.index";
import { EmptyState } from "@/components/intask/EmptyState";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { Inbox, Search, Star, SlidersHorizontal, Lock, ShieldCheck, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/browse")({
  head: () => ({ meta: [{ title: "Browse — InTask" }] }),
  component: BrowsePage,
});

function BrowsePage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"tasks" | "people" | "saved">("tasks");
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["browse-my-role", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", me!.id)
        .maybeSingle();
      return data;
    },
  });

  const role = myProfile?.role;
  const isHiringRole = role === "company" || role === "individual";

  if (isHiringRole) {
    return <HiringTalentBrowse />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 lg:px-8">
      <div className="it-hero-surface rounded-2xl border p-4 shadow-sm lg:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Discover</p>
        <h1 className="text-2xl font-semibold tracking-tight">Find Work</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find open tasks and apply quickly.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-border/80 bg-card/70 p-3 shadow-sm lg:p-4">
        <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border/80 bg-muted p-1 text-sm font-medium shadow-sm lg:max-w-md">
          <button
            onClick={() => setTab("tasks")}
            className={`rounded-md py-2 transition-colors ${tab === "tasks" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Tasks
          </button>
          <button
            onClick={() => setTab("people")}
            className={`rounded-md py-2 transition-colors ${tab === "people" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            People
          </button>
          <button
            onClick={() => setTab("saved")}
            className={`rounded-md py-2 transition-colors ${tab === "saved" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Saved
          </button>
        </div>

        <div className="flex gap-2 lg:max-w-2xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={tab === "tasks" ? "Search tasks…" : "Search by name or skill…"}
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {tab === "tasks" && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "it-link-accent border-primary" : ""}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          )}
        </div>

        {tab === "tasks" && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Category filters</span>
            <button onClick={() => setShowFilters((prev) => !prev)} className="it-link-accent font-medium hover:underline">
              {showFilters ? "Hide advanced" : "Show advanced"}
            </button>
          </div>
        )}
      </section>

      {/* Advanced filters for tasks */}
      {tab === "tasks" && showFilters && (
        <div className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3 shadow-sm">
          <p className="text-sm font-medium text-foreground">Filter by budget (₦)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Min budget</label>
              <Input
                type="number"
                placeholder="e.g. 5000"
                value={minBudget}
                onChange={(e) => setMinBudget(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max budget</label>
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={maxBudget}
                onChange={(e) => setMaxBudget(e.target.value)}
              />
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => { setMinBudget(""); setMaxBudget(""); }}
          >
            Clear filters
          </Button>
        </div>
      )}

      {/* Category chips — tasks only */}
      {tab === "tasks" && (
        <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
          {FEED_FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                  active ? "it-chip-active" : "border-border bg-card text-foreground"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      )}

      <section className="space-y-3">
        {tab === "tasks" && <TasksResults q={q} filter={filter} minBudget={minBudget} maxBudget={maxBudget} />}
        {tab === "people" && <PeopleResults q={q} />}
        {tab === "saved" && <SavedTasksResults />}
      </section>

      <div className="h-4" />
      {tab === "tasks" && (
        <p className="text-center text-xs text-muted-foreground">
          Looking to hire?{" "}
          <Link to="/app/tasks/create" className="it-link-accent font-medium hover:underline">Post a task</Link>
          {" . "}
          <Link to="/app/internships" className="it-link-accent font-medium hover:underline">Browse internships</Link>
        </p>
      )}
    </div>
  );
}

type TalentRow = {
  id: string;
  full_name: string;
  role: string;
  student: {
    university: string | null;
    skills: string[];
    rating_average: number;
    rating_count: number;
    tasks_completed: number;
    verified: boolean;
  };
  startingRate: number | null;
  isAvailable: boolean;
};

const TALENT_SKILL_CATEGORIES = [
  "All categories",
  "Design",
  "Coding",
  "Writing",
  "Marketing",
  "Data",
  "Business",
  "Tutoring",
  "Operations",
];

function skillCategoryOf(skills: string[]) {
  const text = (skills ?? []).join(" ").toLowerCase();
  if (/design|ui|ux|graphic|web\s*design/.test(text)) return "Design";
  if (/python|javascript|app dev|mobile|excel|spreadsheet/.test(text)) return "Coding";
  if (/writing|copywriting|content/.test(text)) return "Writing";
  if (/social media|marketing/.test(text)) return "Marketing";
  if (/data|research/.test(text)) return "Data";
  if (/business|product management/.test(text)) return "Business";
  if (/tutoring|math|science|english/.test(text)) return "Tutoring";
  return "Operations";
}

function HiringTalentBrowse() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [skillCategory, setSkillCategory] = useState("All categories");
  const [university, setUniversity] = useState("");
  const [minRating, setMinRating] = useState("4");
  const [availabilityOnly, setAvailabilityOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minRate, setMinRate] = useState("");
  const [maxRate, setMaxRate] = useState("");

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: mySub } = useQuery({
    queryKey: ["browse-my-subscription", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_subscriptions")
        .select("plan:subscription_plans(name)")
        .eq("company_id", me!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const planName = String(mySub?.plan?.name ?? "Free");
  const isPro = planName.toLowerCase().includes("pro");

  const { data: talents, isLoading } = useQuery({
    queryKey: ["hiring-browse-talents", q, skillCategory, university, minRating, availabilityOnly, verifiedOnly, minRate, maxRate],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["student", "alumni"])
        .neq("id", me?.id ?? "")
        .order("full_name", { ascending: true })
        .limit(120);
      if (profilesError) throw profilesError;
      if (!profiles || profiles.length === 0) return [] as TalentRow[];

      const profileIds = profiles.map((p) => p.id);
      const { data: students, error: studentsError } = await supabase
        .from("student_profiles")
        .select("user_id, university, skills, rating_average, rating_count, tasks_completed, verified")
        .in("user_id", profileIds);
      if (studentsError) throw studentsError;

      const { data: activeTasks } = await supabase
        .from("tasks")
        .select("matched_student_id")
        .in("matched_student_id", profileIds)
        .in("status", ["matched", "in_progress", "in_review"]);

      const { data: rates } = await supabase
        .from("applications")
        .select("student_id, proposed_rate")
        .in("student_id", profileIds)
        .not("proposed_rate", "is", null)
        .limit(1000);

      const activeSet = new Set((activeTasks ?? []).map((r: any) => r.matched_student_id).filter(Boolean));
      const minRateByStudent: Record<string, number> = {};
      for (const row of rates ?? []) {
        const sid = row.student_id;
        const proposed = Number(row.proposed_rate ?? 0);
        if (!sid || proposed <= 0) continue;
        if (!(sid in minRateByStudent)) minRateByStudent[sid] = proposed;
        else minRateByStudent[sid] = Math.min(minRateByStudent[sid], proposed);
      }

      const studentById: Record<string, any> = {};
      for (const s of students ?? []) studentById[s.user_id] = s;

      let rows: TalentRow[] = profiles
        .filter((p) => studentById[p.id])
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          role: p.role,
          student: studentById[p.id],
          startingRate: minRateByStudent[p.id] ?? null,
          isAvailable: !activeSet.has(p.id),
        }));

      if (q.trim()) {
        const term = q.trim().toLowerCase();
        rows = rows.filter((r) =>
          r.full_name.toLowerCase().includes(term) ||
          (r.student.skills ?? []).some((s) => s.toLowerCase().includes(term)) ||
          String(r.student.university ?? "").toLowerCase().includes(term)
        );
      }

      if (skillCategory !== "All categories") {
        rows = rows.filter((r) => skillCategoryOf(r.student.skills ?? []) === skillCategory);
      }

      if (university.trim()) {
        rows = rows.filter((r) => String(r.student.university ?? "").toLowerCase().includes(university.trim().toLowerCase()));
      }

      if (minRating) {
        const threshold = Number(minRating);
        rows = rows.filter((r) => Number(r.student.rating_average ?? 0) >= threshold);
      }

      if (availabilityOnly) rows = rows.filter((r) => r.isAvailable);
      if (verifiedOnly) rows = rows.filter((r) => !!r.student.verified);

      if (minRate) rows = rows.filter((r) => (r.startingRate ?? 0) >= Number(minRate));
      if (maxRate) rows = rows.filter((r) => (r.startingRate ?? Number.MAX_SAFE_INTEGER) <= Number(maxRate));

      return rows;
    },
  });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 lg:px-8">
      <div className="it-hero-surface rounded-2xl border p-4 shadow-sm lg:p-6">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Discover</p>
        <h1 className="text-2xl font-semibold tracking-tight">Find Talent</h1>
        <p className="mt-1 text-sm text-muted-foreground">Browse student and alumni talent to hire faster.</p>
      </div>

      <section className="space-y-3 rounded-2xl border border-border/80 bg-card/70 p-3 shadow-sm lg:p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, skill, or university"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <select value={skillCategory} onChange={(e) => setSkillCategory(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              {TALENT_SKILL_CATEGORIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Any rating</option>
              <option value="4">4+ stars</option>
              <option value="4.5">4.5+ stars</option>
            </select>
            <Input placeholder="University" value={university} onChange={(e) => setUniversity(e.target.value)} />
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
              <input id="verifiedOnly" type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
              <label htmlFor="verifiedOnly" className="text-xs text-muted-foreground">Verified only</label>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-2">
            <input id="availableOnly" type="checkbox" checked={availabilityOnly} onChange={(e) => setAvailabilityOnly(e.target.checked)} />
            <label htmlFor="availableOnly" className="text-xs text-muted-foreground">Available only</label>
          </div>
          <Input type="number" placeholder="Min starting rate" value={minRate} onChange={(e) => setMinRate(e.target.value)} />
          <Input type="number" placeholder="Max starting rate" value={maxRate} onChange={(e) => setMaxRate(e.target.value)} />
        </div>
      </section>

      {!isPro && (
        <div className="it-note-warning rounded-2xl border p-4 flex items-start justify-between gap-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-warning">Unlock Talent Search — Upgrade to Pro</p>
            <p className="text-xs text-muted-foreground mt-1">
              Free and Growth plans can preview talent cards. Upgrade to Pro to open full profiles and contact options.
            </p>
          </div>
          <Button size="sm" onClick={() => nav({ to: "/app/subscription" as any })}>Upgrade</Button>
        </div>
      )}

      {isLoading && <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />}

      {!isLoading && (talents?.length ?? 0) === 0 && (
        <EmptyState icon={Search} title="No talent found" description="Try adjusting filters to broaden results." />
      )}

      {!!talents?.length && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {talents.map((t) => (
            <TalentCard key={t.id} talent={t} isPro={isPro} />
          ))}
        </div>
      )}
    </div>
  );
}

function TalentCard({ talent, isPro }: { talent: TalentRow; isPro: boolean }) {
  const nav = useNavigate();
  const firstName = talent.full_name?.split(" ")[0] ?? "Talent";
  const category = skillCategoryOf(talent.student.skills ?? []);

  if (!isPro) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="blur-[2px] opacity-85 pointer-events-none select-none">
          <div className="flex items-start gap-3">
            <InitialsAvatar name={firstName} size={40} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{firstName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{category} talent</p>
              <p className="text-xs text-muted-foreground mt-1">University hidden</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(talent.student.skills ?? []).slice(0, 2).map((s) => (
                  <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-background/65" />
        <div className="absolute inset-x-4 bottom-4 rounded-lg border border-border bg-card/95 p-3 shadow-sm">
          <p className="text-xs font-semibold text-foreground">Unlock Talent Search — Upgrade to Pro</p>
          <Button size="sm" className="mt-2 w-full" onClick={() => nav({ to: "/app/subscription" as any })}>Upgrade to Pro</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <InitialsAvatar name={talent.full_name ?? undefined} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="truncate font-medium text-foreground">{talent.full_name}</p>
            <VerifiedBadge role={talent.role as any} verified={talent.student.verified} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{talent.student.university ?? "University not set"}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="size-3 fill-warning text-warning" />
              {Number(talent.student.rating_average ?? 0).toFixed(1)}
            </span>
            <span>{talent.student.tasks_completed ?? 0} tasks done</span>
            <span className={talent.isAvailable ? "text-success" : "text-warning"}>{talent.isAvailable ? "Available" : "Busy"}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {(talent.student.skills ?? []).slice(0, 3).map((s) => (
              <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Starting rate: {talent.startingRate ? `₦${talent.startingRate.toLocaleString("en-NG")}` : "Not set"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link to="/app/profile/$userId" params={{ userId: talent.id }}>
          <Button variant="outline" size="sm" className="w-full gap-1">
            <ShieldCheck className="size-3.5" /> View profile
          </Button>
        </Link>
        <Button size="sm" className="w-full gap-1" onClick={() => nav({ to: "/app/tasks/create" as any })}>
          <Briefcase className="size-3.5" /> Send offer
        </Button>
      </div>
    </div>
  );
}

function TasksResults({ q, filter, minBudget, maxBudget }: { q: string; filter: string; minBudget: string; maxBudget: string }) {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["browse-tasks", filter, q, minBudget, maxBudget],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      let query = supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role)")
        .eq("status", "open")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
      if (me.user?.id) query = query.neq("poster_id", me.user.id);
      if (filter !== "All") query = query.ilike("category", `%${filter}%`);
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      if (minBudget) query = query.gte("budget", Number(minBudget));
      if (maxBudget) query = query.lte("budget", Number(maxBudget));
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />;

  if ((tasks?.length ?? 0) === 0) {
    return <EmptyState icon={Inbox} title="Nothing matches" description="Try clearing filters or searching for something else." />;
  }

  const categories = Array.from(new Set((tasks ?? []).map((t: any) => t.category).filter(Boolean)));
  const { data: categoryBudgetStats = {} } = useCategoryBudgetStats(categories);

  const { data: me } = useQuery({
  queryKey: ["me-id"],
  queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  return <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">{tasks?.map((t) => <TaskCard key={t.id} task={t} currentUserId={me?.id} categoryBudgetStats={categoryBudgetStats} />)}</div>;
}

function PeopleResults({ q }: { q: string }) {
  const { data: people, isLoading } = useQuery({
    queryKey: ["browse-people", q],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      let profilesQuery = supabase
        .from("profiles")
        .select("id, full_name, role")
        .neq("id", me.user?.id ?? "")
        .order("full_name", { ascending: true })
        .limit(40);
      if (q.trim()) profilesQuery = profilesQuery.ilike("full_name", `%${q.trim()}%`);
      const { data: profiles, error } = await profilesQuery;
      if (error) throw error;
      if (!profiles || profiles.length === 0) return [];

      const ids = profiles.map((p) => p.id);
      const { data: studentProfiles } = await supabase
        .from("student_profiles")
        .select("user_id, university, year_of_study, skills, rating_average, rating_count, tasks_completed, verified")
        .in("user_id", ids);

      const spMap: Record<string, any> = {};
      for (const sp of studentProfiles ?? []) spMap[sp.user_id] = sp;

      let results = profiles.map((p) => ({ ...p, student: spMap[p.id] ?? null }));

      if (q.trim()) {
        const lowerQ = q.trim().toLowerCase();
        results = results.filter((p) =>
          p.full_name?.toLowerCase().includes(lowerQ) ||
          p.student?.skills?.some((s: string) => s.toLowerCase().includes(lowerQ)) ||
          p.student?.university?.toLowerCase().includes(lowerQ)
        );
      }

      return results;
    },
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />)}
    </div>
  );

  if ((people?.length ?? 0) === 0) {
    return <EmptyState icon={Inbox} title="No people found" description="Try searching by name, skill, or university." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {people?.map((p) => (
        <Link key={p.id} to="/app/profile/$userId" params={{ userId: p.id }} className="block">
          <div className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors active:bg-accent/50">
            <div className="flex items-start gap-3">
              <InitialsAvatar name={p.full_name ?? undefined} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-foreground">{p.full_name}</p>
                  <VerifiedBadge role={p.role as any} verified={p.student?.verified} />
                </div>
                {p.student?.university ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.student.university}
                    {p.student.year_of_study ? ` · ${p.student.year_of_study}` : ""}
                  </p>
                ) : (p.role === "company" || p.role === "individual") ? (
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{p.role} account</p>
                ) : null}
                
                <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {(p.student?.rating_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="size-3 fill-warning text-warning" />
                      {Number(p.student.rating_average).toFixed(1)}
                    </span>
                  )}
                  {(p.student?.tasks_completed ?? 0) > 0 && (
                    <span>{p.student.tasks_completed} tasks done</span>
                  )}
                </div>
                {p.student?.skills && p.student.skills.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.student.skills.slice(0, 3).map((s: string) => (
                      <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        {s}
                      </span>
                    ))}
                    {p.student.skills.length > 3 && (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        +{p.student.skills.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
function SavedTasksResults() {
  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: saved, isLoading } = useQuery({
    queryKey: ["saved-tasks"],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("saved_tasks")
        .select("task_id, tasks(*, poster:profiles!tasks_poster_id_fkey(id, full_name, role))")
        .eq("user_id", me!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s: any) => s.tasks).filter(Boolean);
    },
  });

  if (isLoading) return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />)}
    </div>
  );

  if (!saved || saved.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No saved tasks yet"
        description="Tap the bookmark icon on any task to save it for later."
      />
    );
  }

  const categories = Array.from(new Set((saved ?? []).map((t: any) => t.category).filter(Boolean)));
  const { data: categoryBudgetStats = {} } = useCategoryBudgetStats(categories);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
      {saved.map((t: any) => (
        <TaskCard key={t.id} task={t} currentUserId={me?.id} categoryBudgetStats={categoryBudgetStats} />
      ))}
    </div>
  );
}

function useCategoryBudgetStats(categories: string[]) {
  const key = [...categories].sort().join("|");
  return useQuery({
    queryKey: ["browse-category-budget-stats", key],
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