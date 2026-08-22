import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TaskCard } from "./app.index";
import { Bookmark, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/saved")({
  head: () => ({ meta: [{ title: "Saved Tasks — InTask" }] }),
  component: SavedTasksPage,
});

type Tab = "tasks";

function SavedTasksPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("tasks");

  const { data: savedTasks, isLoading } = useQuery({
    queryKey: ["saved-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("saved_tasks")
        .select("id, task:tasks!saved_tasks_task_id_fkey(id, title, budget, budget_negotiable, category, deadline, status, created_at, is_team_task, team_size, poster:profiles!tasks_poster_id_fkey(id, full_name, avatar_url))")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((s: any) => s.task).map((s: any) => s.task);
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 pt-6 lg:px-8">
      {/* Header */}
      <h1 className="text-2xl font-bold text-foreground">Saved</h1>

      {/* Tabs */}
      <div className="mt-6 rounded-xl border border-border bg-card">
        <div className="flex gap-0 border-b border-border px-4">
          <button
            onClick={() => setTab("tasks")}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              tab === "tasks"
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Tasks
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-muted" />
              ))}
            </div>
          ) : (savedTasks?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="grid size-12 place-items-center rounded-full bg-muted">
                <Bookmark className="size-6 text-muted-foreground" />
              </span>
              <p className="mt-3 text-sm text-muted-foreground">No saved tasks found.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link to="/app/browse" search={{ q: "" } as any}>Browse tasks</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedTasks?.map((task: any) => (
                <TaskCard key={task.id} task={task} currentUserId={user?.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
