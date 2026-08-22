import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Briefcase, Clock, CheckCircle, XCircle, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/app/applied")({
  head: () => ({ meta: [{ title: "Tasks Applied — InTask" }] }),
  component: AppliedPage,
} as any);

function AppliedPage() {
  const { user } = useAuth();

  const { data: applications, isLoading } = useQuery({
    queryKey: ["applied-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("id, message, status, created_at, task:tasks(id, title, budget, category, status, poster:profiles!tasks_poster_id_fkey(full_name, avatar_url))")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="size-5 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  const statusColors: Record<string, { bg: string; text: string; icon: any }> = {
    pending: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]", icon: Clock },
    accepted: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", icon: CheckCircle },
    rejected: { bg: "bg-[#FEE2E2]", text: "text-[#DC2626]", icon: XCircle },
    completed: { bg: "bg-[#DCFCE7]", text: "text-[#15803D]", icon: CheckCircle },
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[900px]">
        <h1 className="mb-6 font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1E293B]">Tasks Applied</h1>

        {(!applications || applications.length === 0) ? (
          <div className="border border-[#E2E8F0] bg-white p-8 text-center">
            <Briefcase className="mx-auto size-10 text-[#E2E8F0]" />
            <p className="mt-3 text-[0.9rem] text-[#6B7280]">You haven't applied to any tasks yet.</p>
            <Link to="/app/browse" className="mt-4 inline-flex items-center gap-1 text-[0.85rem] font-medium text-[#16A34A] hover:underline">
              Browse Tasks <ExternalLink className="size-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app: any) => {
              const status = statusColors[app.status] || statusColors.pending;
              const StatusIcon = status.icon;
              return (
                <Link
                  key={app.id}
                  to="/app/tasks/$taskId"
                  params={{ taskId: app.task?.id }}
                  className="block border border-[#E2E8F0] bg-white p-5 transition-colors hover:border-[#16A34A]/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[0.95rem] font-semibold text-[#1E293B] line-clamp-1">{app.task?.title || "Task"}</h3>
                      {app.task?.poster?.full_name && (
                        <p className="mt-0.5 text-[0.8rem] text-[#6B7280]">{app.task.poster.full_name}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.75rem] text-[#6B7280]">
                        {app.task?.budget != null && (
                          <span className="font-semibold text-[#1E293B]">₦{app.task.budget.toLocaleString()}</span>
                        )}
                        {app.task?.category && <span>· {app.task.category}</span>}
                        <span>· Applied {new Date(app.created_at).toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 px-2.5 py-1 text-[0.75rem] font-medium ${status.bg} ${status.text}`}>
                      <StatusIcon className="size-3" /> {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
