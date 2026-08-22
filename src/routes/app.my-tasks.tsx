import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, ArrowRight, Trash2, Loader2, FolderGit2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/my-tasks")({
  head: () => ({ meta: [{ title: "My Tasks — InTask" }] }),
  component: MyTasksPage,
});

function MyTasksPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "budget-high" | "budget-low">("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["my-posted-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, budget, budget_negotiable, category, status, work_type, created_at, applicants_count, deadline")
        .eq("poster_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleDelete(taskId: string) {
    if (!window.confirm("Delete this task? This will remove its applications too.")) return;
    setDeletingId(taskId);
    const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("poster_id", user!.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Task deleted");
      qc.invalidateQueries({ queryKey: ["my-posted-tasks", user?.id] });
    }
    setDeletingId(null);
  }

  const filtered = (tasks ?? [])
    .filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === "budget-high") return (b.budget ?? 0) - (a.budget ?? 0);
      return (a.budget ?? 0) - (b.budget ?? 0);
    });

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-7 sm:px-8">
      <h1 className="mb-6 font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1E293B]">Manage Projects</h1>

      <div className="border border-[#E2E8F0] bg-white p-5">
        {/* Search & Sort bar */}
        <div className="mb-5 flex items-center justify-between gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ..."
              className="h-10 w-full border border-[#E2E8F0] bg-[#FFFFFF] pl-9 pr-3 text-[0.85rem] text-[#1E293B] placeholder:text-[#94A3B8] focus:border-[#16A34A] focus:outline-none focus:ring-1 focus:ring-[#16A34A]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[0.8rem] text-[#6B7280]">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[0.8rem] text-[#1E293B] focus:border-[#16A34A] focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="budget-high">Budget: High to Low</option>
              <option value="budget-low">Budget: Low to High</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse bg-[#FFFFFF]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center bg-[#DCFCE7]">
              <FolderGit2 className="size-6 text-[#16A34A]" />
            </div>
            <p className="mt-3 text-[0.9rem] font-medium text-[#1E293B]">
              {search ? "No tasks match your search" : "No tasks posted yet"}
            </p>
            {!search && (
              <Link
                to="/app/tasks/create"
                className="mt-3 inline-flex items-center gap-1.5 rounded-[10px] bg-[#16A34A] px-4 py-2 text-[0.8rem] font-semibold text-white"
              >
                Post Task
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_100px_120px_120px_160px] gap-4 border-b border-[#E2E8F0] px-2 py-3 text-[0.75rem] font-semibold uppercase tracking-wider text-[#94A3B8]">
              <span>Title</span>
              <span>Expired</span>
              <span>Cost/Type</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-[#E2E8F0]">
              {filtered.map((task) => {
                const isExpired = task.deadline && new Date(task.deadline) < new Date();
                return (
                  <div key={task.id} className="grid grid-cols-[1fr_100px_120px_120px_160px] items-center gap-4 px-2 py-4">
                    {/* Title column */}
                    <div className="min-w-0">
                      <Link
                        to="/app/tasks/$taskId"
                        params={{ taskId: task.id }}
                        className="text-[0.85rem] font-semibold text-[#1E293B] hover:text-[#16A34A] line-clamp-1"
                      >
                        {task.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.7rem] text-[#6B7280]">
                        <span className="text-[#16A34A]">{task.applicants_count ?? 0} Proposals</span>
                        <span>·</span>
                        <span>{task.category}</span>
                      </div>

                    </div>

                    {/* Expired column */}
                    <div className="text-[0.8rem] text-[#6B7280]">
                      {task.deadline
                        ? isExpired
                          ? <span className="text-[#d64545]">Expired</span>
                          : new Date(task.deadline).toLocaleDateString("en-NG", { month: "short", day: "numeric" })
                        : "—"}
                    </div>

                    {/* Cost/Type column */}
                    <div className="text-[0.85rem] font-semibold text-[#1E293B]">
                      {task.budget_negotiable ? "Open" : `₦${Number(task.budget).toLocaleString("en-NG")}`}
                      <p className="text-[0.7rem] font-normal text-[#6B7280] capitalize">{task.work_type ?? "remote"}</p>
                    </div>

                    {/* Status column */}
                    <div>
                      <span className={`inline-block px-2.5 py-0.5 text-[0.7rem] font-medium ${
                        task.status === "open" ? "bg-[#e8f5e9] text-[#2e7d32]" :
                        task.status === "in_progress" ? "bg-[#e3f2fd] text-[#1565c0]" :
                        task.status === "completed" ? "bg-[#f3e5f5] text-[#7b1fa2]" :
                        "bg-[#fff3e0] text-[#e65100]"
                      }`}>
                        {task.status === "open" ? "Open" :
                         task.status === "in_progress" ? "In Progress" :
                         task.status === "completed" ? "Completed" :
                         task.status}
                      </span>
                    </div>

                    {/* Actions column */}
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to="/app/tasks/$taskId/applicants"
                        params={{ taskId: task.id }}
                        className="inline-flex items-center gap-1 bg-[#16A34A] px-3 py-1.5 text-[0.75rem] font-semibold text-white transition-colors hover:bg-[#34b85e]"
                      >
                        View Proposals
                      </Link>
                      <Link
                        to="/app/tasks/$taskId"
                        params={{ taskId: task.id }}
                        className="grid size-8 place-items-center border border-[#E2E8F0] bg-[#FFFFFF] text-[#6B7280] transition-colors hover:border-[#16A34A] hover:text-[#16A34A]"
                      >
                        <ArrowRight className="size-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        disabled={deletingId === task.id}
                        className="grid size-8 place-items-center border border-[#E2E8F0] bg-[#fef4f4] text-[#d64545] transition-colors hover:border-[#d64545] disabled:opacity-50"
                      >
                        {deletingId === task.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
