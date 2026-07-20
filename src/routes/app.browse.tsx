import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEED_FILTERS } from "@/lib/constants";
import { TaskCard } from "./app.index";
import { EmptyState } from "@/components/intask/EmptyState";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { Inbox, Search, Star, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/browse")({
  head: () => ({ meta: [{ title: "Browse — InTask" }] }),
  component: BrowsePage,
});

function BrowsePage() {
  const [tab, setTab] = useState<"tasks" | "people" | "saved">("tasks");
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pt-5">
      <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>

      {/* Tab toggle */}
      <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1 text-sm font-medium">
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

      {/* Search bar */}
      <div className="flex gap-2">
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
            className={showFilters ? "border-primary text-primary" : ""}
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        )}
      </div>

      {/* Advanced filters for tasks */}
      {tab === "tasks" && showFilters && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
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
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FEED_FILTERS.map((f) => {
            const active = f === filter;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>
      )}

      {/* Results */}
      {tab === "tasks" && <TasksResults q={q} filter={filter} minBudget={minBudget} maxBudget={maxBudget} />}
      {tab === "people" && <PeopleResults q={q} />}
      {tab === "saved" && <SavedTasksResults />}

      <div className="h-4" />
      {tab === "tasks" && (
        <p className="text-center text-xs text-muted-foreground">
          Looking to hire?{" "}
          <Link to="/app/tasks/create" className="font-medium text-primary hover:underline">Post a task</Link>
          {" . "}
          <Link to="/app/internships" className="font-medium text-primary hover:underline">Browse internships</Link>
        </p>
      )}
    </div>
  );
}

function TasksResults({ q, filter, minBudget, maxBudget }: { q: string; filter: string; minBudget: string; maxBudget: string }) {
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["browse-tasks", filter, q, minBudget, maxBudget],
    queryFn: async () => {
      let query = supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role)")
        .eq("status", "open")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
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

  const { data: me } = useQuery({
  queryKey: ["me-id"],
  queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  return <div className="space-y-3">{tasks?.map((t) => <TaskCard key={t.id} task={t} currentUserId={me?.id} />)}</div>;
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
    <div className="space-y-3">
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

  return (
    <div className="space-y-3">
      {saved.map((t: any) => (
        <TaskCard key={t.id} task={t} currentUserId={me?.id} />
      ))}
    </div>
  );
}