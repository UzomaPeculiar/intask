import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Eye, Users, Star, CheckCircle2, Clock } from "lucide-react";
import { naira } from "@/lib/format";

export const Route = createFileRoute("/app/tasks/$taskId/analytics")({
  head: () => ({ meta: [{ title: "Task Analytics — InTask" }] }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", taskId)
        .single();
      return data;
    },
  });

  const { data: applications } = useQuery({
    queryKey: ["task-applications", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("id, status, created_at")
        .eq("task_id", taskId);
      return data ?? [];
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["task-reviews", taskId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating, comment, reviewer:profiles!reviews_reviewer_id_fkey(full_name)")
        .eq("task_id", taskId);
      return data ?? [];
    },
  });

  const totalApplicants = applications?.length ?? 0;
  const acceptedApplicants = applications?.filter((a) => a.status === "accepted").length ?? 0;
  const avgRating = reviews && reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (r.rating ?? 0), 0) / reviews.length).toFixed(1)
    : null;

  const stats = [
    {
      label: "Total views",
      value: (task as any)?.view_count ?? 0,
      icon: Eye,
      color: "text-primary bg-primary/10",
    },
    {
      label: "Total applicants",
      value: totalApplicants,
      icon: Users,
      color: "text-success bg-success/15",
    },
    {
      label: "Accepted",
      value: acceptedApplicants,
      icon: CheckCircle2,
      color: "text-warning bg-warning/15",
    },
    {
      label: "Avg rating",
      value: avgRating ? `${avgRating} ★` : "—",
      icon: Star,
      color: "text-warning bg-warning/15",
    },
  ];

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button
          onClick={() => window.history.back()}
          className="grid size-9 place-items-center rounded-full border border-border bg-card"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">Task Analytics</h1>
      </header>

      {task && (
        <div className="px-4 pt-4">
          <p className="text-sm text-muted-foreground">{task.title}</p>
          <p className="text-lg font-semibold text-success mt-0.5">
            {task.budget_negotiable ? "Negotiable" : naira(task.budget)}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className={`grid size-8 place-items-center rounded-lg ${color} mb-2`}>
              <Icon className="size-4" />
            </div>
            <p className="text-2xl font-semibold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="px-4 pt-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Conversion</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Views → Applications</span>
                <span>{(task as any)?.view_count ? Math.round((totalApplicants / (task as any).view_count) * 100) : 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(task as any)?.view_count ? Math.min(100, Math.round((totalApplicants / (task as any).view_count) * 100)) : 0}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Applications → Accepted</span>
                <span>{totalApplicants ? Math.round((acceptedApplicants / totalApplicants) * 100) : 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{ width: `${totalApplicants ? Math.min(100, Math.round((acceptedApplicants / totalApplicants) * 100)) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {reviews && reviews.length > 0 && (
        <div className="px-4 pt-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Reviews received</h2>
          <div className="space-y-3">
            {reviews.map((r: any, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.reviewer?.full_name ?? "Anonymous"}</p>
                  <span className="text-sm text-warning">{"★".repeat(r.rating)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(!reviews || reviews.length === 0) && task?.status === "completed" && (
        <div className="px-4 pt-6">
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Clock className="size-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No reviews yet for this task</p>
          </div>
        </div>
      )}
    </div>
  );
}