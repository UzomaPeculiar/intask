import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEED_FILTERS } from "@/lib/constants";
import { EmptyState } from "@/components/intask/EmptyState";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { Inbox, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MVP_FEATURES } from "@/lib/mvp-features";

export const Route = createFileRoute("/app/browse")({
  head: () => ({ meta: [{ title: "Browse — InTask" }] }),
  component: BrowsePage,
});

function BrowsePage() {
  const [tab, setTab] = useState<"tasks" | "saved">("tasks");
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");
  const [budgetBand, setBudgetBand] = useState("any");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { minBudget, maxBudget } = (() => {
    if (budgetBand === "under20") return { minBudget: "", maxBudget: "20000" };
    if (budgetBand === "20to50") return { minBudget: "20000", maxBudget: "50000" };
    if (budgetBand === "over50") return { minBudget: "50000", maxBudget: "" };
    return { minBudget: "", maxBudget: "" };
  })();

  const { data: taskCount = 0 } = useQuery({
    queryKey: ["browse-task-count", filter, q, minBudget, maxBudget, typeFilter],
    queryFn: async () => {
      try {
        const buildQuery = (workTypeValue?: string) => {
          let query = supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "open");
          if (me?.id) query = query.neq("poster_id", me.id);
          if (filter !== "All") query = query.ilike("category", `%${filter}%`);
          if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
          if (minBudget) query = query.gte("budget", Number(minBudget));
          if (maxBudget) query = query.lte("budget", Number(maxBudget));
          if (workTypeValue) query = query.eq("work_type", workTypeValue as any);
          return query;
        };

        const selectedWorkType = typeFilter === "all" ? undefined : typeFilter;
        let { count, error } = await buildQuery(selectedWorkType);

        if (error && typeFilter === "on_campus") {
          const retry = await buildQuery("on-campus");
          count = retry.count;
          error = retry.error;
        }

        if (error) {
          console.error("browse-task-count query failed", error);
          return 0;
        }

        return count ?? 0;
      } catch (err) {
        console.error("browse-task-count query exception", err);
        return 0;
      }
    },
  });

  const { data: savedCount = 0 } = useQuery({
    queryKey: ["saved-task-count", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("saved_tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", me!.id);
      return count ?? 0;
    },
  });

  const countLabel = tab === "tasks" ? `${taskCount} tasks available` : `${savedCount} saved tasks`;

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1240px] bg-[#eff8ea] px-5 py-7 text-[#1a1e16] lg:px-9">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1a1e16]">Browse Tasks</h1>
        <p className="text-[0.8rem] text-[#6a8064]">{countLabel}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-[#c4deb8] bg-white p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("tasks")}
            className={`rounded-full px-4 py-1.5 text-[0.8rem] transition-colors ${tab === "tasks" ? "bg-[#d8f5e4] text-[#1a7a42]" : "text-[#6a8064]"}`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setTab("saved")}
            className={`rounded-full px-4 py-1.5 text-[0.8rem] transition-colors ${tab === "saved" ? "bg-[#d8f5e4] text-[#1a7a42]" : "text-[#6a8064]"}`}
          >
            Saved
          </button>
        </div>
      </div>

      {tab === "tasks" && (
        <>
          <div className="mb-4 flex gap-2.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#6a8064]" />
              <Input
                placeholder="Search tasks by title, skill, or keyword..."
                className="h-11 rounded-[10px] border-[#c4deb8] bg-white pl-10 text-[0.9rem]"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="button" className="h-11 min-w-[106px] rounded-[10px] bg-[#3dcb6c] px-5 text-[0.85rem] font-semibold text-white hover:bg-[#35b860]">
              Search
            </Button>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            {FEED_FILTERS.map((f) => {
              const active = f === filter;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-4 py-1.5 text-[0.8rem] font-medium ${
                    active ? "border-[#3dcb6c] bg-[#d8f5e4] text-[#1a7a42]" : "border-[#c4deb8] bg-white text-[#1a1e16]"
                  }`}
                >
                  {f}
                </button>
              );
            })}

            <span className="mx-1 h-6 w-px bg-[#e4efe0]" />
            <select
              value={budgetBand}
              onChange={(e) => setBudgetBand(e.target.value)}
              className="h-9 rounded-lg border border-[#c4deb8] bg-white px-3 text-[0.8rem]"
            >
              <option value="any">Budget: Any</option>
              <option value="under20">Under ₦20,000</option>
              <option value="20to50">₦20,000 - ₦50,000</option>
              <option value="over50">Over ₦50,000</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg border border-[#c4deb8] bg-white px-3 text-[0.8rem]"
            >
              <option value="all">Type: All</option>
              <option value="remote">Remote</option>
              <option value="on_campus">On-campus</option>
            </select>
          </div>
        </>
      )}

      <section>
        {tab === "tasks" && <TasksResults q={q} filter={filter} minBudget={minBudget} maxBudget={maxBudget} typeFilter={typeFilter} />}
        {tab === "saved" && <SavedTasksResults />}
      </section>

      {tab === "tasks" && (
        <p className="mt-6 text-center text-xs text-[#6a8064]">
          Looking to hire?{" "}
          <Link to="/app/tasks/create" className="font-medium text-[#1a7a42] hover:underline">Post a task</Link>
          {" . "}
          {MVP_FEATURES.internships ? <Link to="/app/internships" className="font-medium text-[#1a7a42] hover:underline">Browse internships</Link> : <span className="font-medium text-[#1a7a42]">Post tasks instead</span>}
        </p>
      )}
    </div>
  );
}

function TasksResults({ q, filter, minBudget, maxBudget, typeFilter }: { q: string; filter: string; minBudget: string; maxBudget: string; typeFilter: string }) {
  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["browse-tasks", filter, q, minBudget, maxBudget, typeFilter],
    queryFn: async () => {
      try {
        const { data: me } = await supabase.auth.getUser();
        const buildQuery = (workTypeValue?: string) => {
          let query = supabase
            .from("tasks")
            .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role, avatar_url)")
            .eq("status", "open")
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(60);
          if (me.user?.id) query = query.neq("poster_id", me.user.id);
          if (filter !== "All") query = query.ilike("category", `%${filter}%`);
          if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
          if (minBudget) query = query.gte("budget", Number(minBudget));
          if (maxBudget) query = query.lte("budget", Number(maxBudget));
          if (workTypeValue) query = query.eq("work_type", workTypeValue as any);
          return query;
        };

        const selectedWorkType = typeFilter === "all" ? undefined : typeFilter;
        let { data, error } = await buildQuery(selectedWorkType);

        if (error && typeFilter === "on_campus") {
          const retry = await buildQuery("on-campus");
          data = retry.data;
          error = retry.error;
        }

        if (error) {
          console.error("browse-tasks query failed", error);
          return [];
        }

        return data ?? [];
      } catch (err) {
        console.error("browse-tasks query exception", err);
        return [];
      }
    },
  });

  if (isLoading) return <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />;

  if ((tasks?.length ?? 0) === 0) {
    return <EmptyState icon={Inbox} title="Nothing matches" description="Try clearing filters or searching for something else." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {tasks?.map((t: any) => <BrowseTaskCard key={t.id} task={t} userId={me?.id} />)}
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
        .select("task_id, tasks(*, poster:profiles!tasks_poster_id_fkey(id, full_name, role, avatar_url))")
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
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {saved.map((t: any) => (
        <BrowseTaskCard key={t.id} task={t} userId={me?.id} />
      ))}
    </div>
  );
}

function BrowseTaskCard({ task, userId }: { task: any; userId?: string }) {
  const posterName = task?.poster?.full_name || "Anonymous";

  const budgetLabel = task.budget_negotiable
    ? "Negotiable"
    : task.budget
      ? `₦${Number(task.budget).toLocaleString("en-NG")}`
      : "₦0";

  const workTypeLabel = task.work_type === "on_campus" ? "On-campus" : task.work_type === "remote" ? "Remote" : "Either";

  const tags = Array.isArray(task.skills_needed) ? task.skills_needed.slice(0, 3) : [];

  return (
    <Link to="/app/tasks/$taskId" params={{ taskId: task.id }} className="block">
      <article className="min-h-[208px] rounded-[14px] border border-[#c4deb8] bg-white p-[18px] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(61,203,108,0.12)]">
        <div className="mb-2.5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] text-[#6a8064]">{task.category} · {workTypeLabel}</p>
            <h3 className="mt-1 [font-family:'Space_Grotesk',sans-serif] text-[0.95rem] font-semibold leading-[1.3] text-[#1a1e16]">{task.title}</h3>
          </div>
          <div className="flex items-start gap-2">
            <p className="[font-family:'Space_Grotesk',sans-serif] text-[0.95rem] font-bold text-[#1a7a42]">{budgetLabel}</p>
            <SaveTaskButton taskId={task.id} userId={userId} />
          </div>
        </div>

        <p className="mb-3 line-clamp-2 text-[0.75rem] leading-[1.5] text-[#6a8064]">{task.description}</p>

        {tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {tags.map((tag: string) => (
              <span key={tag} className="rounded-full bg-[#f4fbf0] px-2 py-0.5 text-[0.6rem] font-medium text-[#6a8064]">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-[#e4efe0] pt-2.5">
          <div className="flex items-center gap-2">
            <InitialsAvatar name={posterName} size={26} avatarUrl={task.poster?.avatar_url} />
            <div>
              <p className="text-[0.7rem] font-medium text-[#1a1e16]">{posterName}</p>
              <p className="text-[0.6rem] text-[#9eb79c]">{task.applicants_count ?? 0} applicants</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-7 rounded-lg border-[#c4deb8] bg-transparent px-3 text-[0.7rem] font-semibold text-[#1a1e16] hover:border-[#3dcb6c] hover:bg-[#d8f5e4]"
          >
            Apply
          </Button>
        </div>
      </article>
    </Link>
  );
}
