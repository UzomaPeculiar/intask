import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEED_FILTERS, TASK_CATEGORIES, SKILLS } from "@/lib/constants";
import { EmptyState } from "@/components/intask/EmptyState";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { Inbox, Search, MapPin, Eye, Users, ArrowUpRight, SlidersHorizontal, ChevronDown, X, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MVP_FEATURES } from "@/lib/mvp-features";
import { TaskFeedSkeleton } from "@/components/intask/Skeletons";
import { naira } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/app/browse")({
  head: () => ({ meta: [{ title: "Browse — InTask" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || "",
  }),
  component: BrowsePage,
});

function BrowsePage() {
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ);
  const [sortBy, setSortBy] = useState("default");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [workType, setWorkType] = useState("all");
  const [budgetMin, setBudgetMin] = useState(0);
  const [budgetMax, setBudgetMax] = useState(100000);
  const [categoriesToShow, setCategoriesToShow] = useState(6);
  const [skillsToShow, setSkillsToShow] = useState(6);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const minBudget = budgetMin > 0 ? String(budgetMin) : "";
  const maxBudget = budgetMax < 100000 ? String(budgetMax) : "";

  const { data: taskCount = 0 } = useQuery({
    queryKey: ["browse-task-count", selectedCategories, q, minBudget, maxBudget, workType],
    queryFn: async () => {
      try {
        let query = supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "open");
        if (me?.id) query = query.neq("poster_id", me.id);
        if (selectedCategories.length > 0) {
          query = query.or(selectedCategories.map(c => `category.ilike.%${c}%`).join(","));
        }
        if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
        if (minBudget) query = query.gte("budget", Number(minBudget));
        if (maxBudget) query = query.lte("budget", Number(maxBudget));
        if (workType !== "all") {
          const wt = workType === "on_campus" ? "on-campus" : workType;
          query = query.eq("work_type", wt as any);
        }
        const { count, error } = await query;
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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-[#1a3a2a] px-5 py-10 lg:px-9 lg:py-14">
        {/* Decorative shapes */}
        <div className="absolute right-0 top-0 h-full w-1/3 opacity-20">
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <path d="M150,0 C180,50 200,100 150,150 C100,200 50,150 0,100 C-50,50 0,0 50,0 C100,0 120,-20 150,0" fill="white" opacity="0.1" />
          </svg>
        </div>

        <div className="relative mx-auto max-w-[1240px]">
          <h1 className="text-3xl font-bold text-white lg:text-4xl">Browse Tasks</h1>
          <p className="mt-2 max-w-lg text-sm text-white/70">
            Find projects that match your skills and start earning today.
          </p>

          {/* Search Bar */}
          <div className="mt-6 flex max-w-2xl gap-0 overflow-hidden">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Project title, keywords"
                className="h-12 rounded-l-xl rounded-r-none border-0 bg-white pl-11 text-sm"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Button type="button" className="h-12 rounded-l-none rounded-r-xl bg-[#3dcb6c] px-8 text-sm font-semibold text-white hover:bg-[#35b860]">
              Search
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1240px] px-5 py-6 lg:px-9">
        {/* Results bar */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing all <span className="font-medium text-foreground">{taskCount}</span> results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className="flex items-center gap-2 border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <SlidersHorizontal className="size-4" />
              Filter
            </button>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none border border-border bg-card px-4 py-2 pr-8 text-sm font-medium text-foreground"
              >
                <option value="default">Sort by (Default)</option>
                <option value="newest">Newest</option>
                <option value="budget_high">Budget: High to Low</option>
                <option value="budget_low">Budget: Low to High</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Task Results */}
        <TasksResults
          q={q}
          selectedCategories={selectedCategories}
          selectedSkills={selectedSkills}
          minBudget={minBudget}
          maxBudget={maxBudget}
          workType={workType}
          sortBy={sortBy}
        />

        {/* Filter Drawer */}
        <FilterDrawer
          open={showFilters}
          onClose={() => setShowFilters(false)}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
          selectedSkills={selectedSkills}
          setSelectedSkills={setSelectedSkills}
          workType={workType}
          setWorkType={setWorkType}
          budgetMin={budgetMin}
          setBudgetMin={setBudgetMin}
          budgetMax={budgetMax}
          setBudgetMax={setBudgetMax}
          categoriesToShow={categoriesToShow}
          setCategoriesToShow={setCategoriesToShow}
          skillsToShow={skillsToShow}
          setSkillsToShow={setSkillsToShow}
        />

        {/* Bottom CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Looking to hire?{" "}
            <Link to="/app/tasks/create" className="font-medium text-[#1a7a42] hover:underline">Post a task</Link>
            {MVP_FEATURES.internships && (
              <>
                {" · "}
                <Link to="/app/internships" className="font-medium text-[#1a7a42] hover:underline">Browse internships</Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function TasksResults({
  q,
  selectedCategories,
  selectedSkills,
  minBudget,
  maxBudget,
  workType,
  sortBy,
}: {
  q: string;
  selectedCategories: string[];
  selectedSkills: string[];
  minBudget: string;
  maxBudget: string;
  workType: string;
  sortBy: string;
}) {
  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["browse-tasks", selectedCategories, selectedSkills, q, minBudget, maxBudget, workType, sortBy],
    queryFn: async () => {
      try {
        const { data: me } = await supabase.auth.getUser();
        let query = supabase
          .from("tasks")
          .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role, avatar_url)")
          .eq("status", "open")
          .limit(60);
        if (me.user?.id) query = query.neq("poster_id", me.user.id);
        if (selectedCategories.length > 0) {
          query = query.or(selectedCategories.map(c => `category.ilike.%${c}%`).join(","));
        }
        if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
        if (minBudget) query = query.gte("budget", Number(minBudget));
        if (maxBudget) query = query.lte("budget", Number(maxBudget));
        if (workType !== "all") {
          const wt = workType === "on_campus" ? "on-campus" : workType;
          query = query.eq("work_type", wt as any);
        }

        // Apply sorting
        if (sortBy === "newest") {
          query = query.order("created_at", { ascending: false });
        } else if (sortBy === "budget_high") {
          query = query.order("budget", { ascending: false });
        } else if (sortBy === "budget_low") {
          query = query.order("budget", { ascending: true });
        } else {
          query = query.order("featured", { ascending: false }).order("created_at", { ascending: false });
        }

        const { data, error } = await query;
        if (error) {
          console.error("browse-tasks query failed", error);
          return [];
        }

        // Client-side filter for skills
        let results = data ?? [];
        if (selectedSkills.length > 0) {
          results = results.filter((t: any) => {
            const taskSkills: string[] = Array.isArray(t.skills_needed) ? t.skills_needed : [];
            return selectedSkills.some(s => taskSkills.some(ts => ts.toLowerCase().includes(s.toLowerCase())));
          });
        }

        return results;
      } catch (err) {
        console.error("browse-tasks query exception", err);
        return [];
      }
    },
  });

  if (isLoading) return <TaskFeedSkeleton />;

  if ((tasks?.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No tasks found"
        description="Try clearing filters or searching for something else."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tasks?.map((t: any) => <BrowseTaskCard key={t.id} task={t} userId={me?.id} />)}
    </div>
  );
}

function FilterDrawer({
  open,
  onClose,
  selectedCategories,
  setSelectedCategories,
  selectedSkills,
  setSelectedSkills,
  workType,
  setWorkType,
  budgetMin,
  setBudgetMin,
  budgetMax,
  setBudgetMax,
  categoriesToShow,
  setCategoriesToShow,
  skillsToShow,
  setSkillsToShow,
}: {
  open: boolean;
  onClose: () => void;
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  selectedSkills: string[];
  setSelectedSkills: (v: string[]) => void;
  workType: string;
  setWorkType: (v: string) => void;
  budgetMin: number;
  setBudgetMin: (v: number) => void;
  budgetMax: number;
  setBudgetMax: (v: number) => void;
  categoriesToShow: number;
  setCategoriesToShow: (v: number) => void;
  skillsToShow: number;
  setSkillsToShow: (v: number) => void;
}) {
  if (!open) return null;

  const toggleCategory = (cat: string) => {
    if (cat === "All") {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories(
      selectedCategories.includes(cat)
        ? selectedCategories.filter(c => c !== cat)
        : [...selectedCategories, cat]
    );
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(
      selectedSkills.includes(skill)
        ? selectedSkills.filter(s => s !== skill)
        : [...selectedSkills, skill]
    );
  };

  const visibleCategories = TASK_CATEGORIES.slice(0, categoriesToShow);
  const visibleSkills = SKILLS.slice(0, skillsToShow);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="relative h-full w-full max-w-sm overflow-y-auto bg-card shadow-xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">All Filters</h2>
          <button onClick={onClose} className="grid size-9 place-items-center border border-border bg-muted text-foreground transition-colors hover:bg-accent">
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {/* Category */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Category</h3>
            <div className="space-y-2">
              {visibleCategories.map((cat) => (
                <label key={cat} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={selectedCategories.includes(cat)}
                    onCheckedChange={() => toggleCategory(cat)}
                  />
                  <span className="text-sm text-foreground">{cat}</span>
                </label>
              ))}
            </div>
            {TASK_CATEGORIES.length > categoriesToShow && (
              <button
                onClick={() => setCategoriesToShow(TASK_CATEGORIES.length)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-[#3dcb6c] hover:underline"
              >
                <span>+</span> Show More
              </button>
            )}
          </section>

          <hr className="border-border" />

          {/* Work Type */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Project Type</h3>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="w-full border border-border bg-card px-4 py-2.5 text-sm text-foreground"
            >
              <option value="all">All types</option>
              <option value="remote">Remote</option>
              <option value="on_campus">On-campus</option>
            </select>
          </section>

          <hr className="border-border" />

          {/* Budget Range */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Budget</h3>
            <div className="flex items-center justify-between mb-2">
              <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground">{naira(budgetMin)}</span>
              <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-foreground">{naira(budgetMax)}</span>
            </div>
            <div className="relative h-2">
              <div className="absolute inset-0 bg-border" />
              <div
                className="absolute inset-y-0 bg-[#3dcb6c]"
                style={{
                  left: `${(budgetMin / 100000) * 100}%`,
                  right: `${100 - (budgetMax / 100000) * 100}%`,
                }}
              />
              <input
                type="range"
                min={0}
                max={100000}
                step={5000}
                value={budgetMin}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val < budgetMax) setBudgetMin(val);
                }}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
              />
              <input
                type="range"
                min={0}
                max={100000}
                step={5000}
                value={budgetMax}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (val > budgetMin) setBudgetMax(val);
                }}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
              />
            </div>
          </section>

          <hr className="border-border" />

          {/* Skills */}
          <section>
            <h3 className="mb-3 text-sm font-semibold text-foreground">Skills</h3>
            <div className="space-y-2">
              {visibleSkills.map((skill) => (
                <label key={skill} className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={selectedSkills.includes(skill)}
                    onCheckedChange={() => toggleSkill(skill)}
                  />
                  <span className="text-sm text-foreground">{skill}</span>
                </label>
              ))}
            </div>
            {SKILLS.length > skillsToShow && (
              <button
                onClick={() => setSkillsToShow(SKILLS.length)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-[#3dcb6c] hover:underline"
              >
                <span>+</span> Show More
              </button>
            )}
          </section>
        </div>

        {/* Search Button */}
        <div className="sticky bottom-0 border-t border-border bg-card px-5 py-4">
          <Button onClick={onClose} className="w-full bg-[#3dcb6c] text-white hover:bg-[#35b860]">
            Search
          </Button>
        </div>
      </div>
    </div>
  );
}

function BrowseTaskCard({ task, userId }: { task: any; userId?: string }) {
  const posterName = task?.poster?.full_name || "Anonymous";
  const workTypeLabel = task.work_type === "on_campus" ? "On-campus" : task.work_type === "remote" ? "Remote" : "Either";
  const tags = Array.isArray(task.skills_needed) ? task.skills_needed.slice(0, 2) : [];
  const applicantCount = task.applicants_count ?? 0;

  const budgetDisplay = task.budget_negotiable
    ? "Negotiable"
    : task.budget
      ? `${naira(task.budget)}`
      : "₦0";

  const rateType = task.work_type === "remote" ? "Remote" : "Fixed";

  return (
    <Link to="/app/tasks/$taskId" params={{ taskId: task.id }} className="group block">
      <article className="relative flex h-full flex-col border border-border bg-card p-4 transition-all hover:shadow-md">
        {/* Poster info */}
        <div className="mb-3 flex items-center gap-3">
          <InitialsAvatar name={posterName} size={40} avatarUrl={task.poster?.avatar_url} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              <span>{workTypeLabel}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                {applicantCount} views
              </span>
              <span className="flex items-center gap-1">
                <Users className="size-3" />
                {applicantCount} proposals
              </span>
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-[#1a7a42]">
          {task.title}
        </h3>

        {/* Description */}
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {task.description || "No description provided."}
        </p>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tags.map((tag: string) => (
              <span
                key={tag}
                className="bg-[#f4fbf0] px-2.5 py-0.5 text-[10px] font-medium text-[#3a7a4a]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <div className="mb-4">
          <span className="text-lg font-bold text-foreground">{budgetDisplay}</span>
          {!task.budget_negotiable && task.budget && (
            <span className="ml-1 text-xs text-muted-foreground">/ {rateType}</span>
          )}
        </div>

        {/* Apply button */}
        <div className="mt-auto">
          <Button
            variant="outline"
            className="w-full justify-between border-[#3dcb6c] text-[#1a7a42] hover:bg-[#d8f5e4] hover:text-[#1a7a42]"
          >
            <span>Apply</span>
            <ArrowUpRight className="size-4" />
          </Button>
        </div>

        {/* Save button */}
        <div className="absolute right-3 top-3">
          <SaveTaskButton taskId={task.id} userId={userId} />
        </div>
      </article>
    </Link>
  );
}
