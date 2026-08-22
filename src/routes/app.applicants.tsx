import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Users, Loader2, MapPin, Clock, DollarSign, Plus, Link2, Download, Trash2, Briefcase } from "lucide-react";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { toast } from "sonner";

export const Route = createFileRoute("/app/applicants")({
  head: () => ({ meta: [{ title: "Applicants — InTask" }] }),
  component: ApplicantsPage,
});

function ApplicantsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterTask, setFilterTask] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: tasks } = useQuery({
    queryKey: ["my-posted-tasks-for-filter", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("poster_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: applicants, isLoading } = useQuery({
    queryKey: ["all-applicants", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: myTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("poster_id", user!.id);

      if (!myTasks || myTasks.length === 0) return [];

      const taskIds = myTasks.map((t) => t.id);

      const { data: applications } = await supabase
        .from("applications")
        .select(`
          id, task_id, student_id, message, price, hours, status, created_at,
          student:profiles!applications_student_id_fkey(id, full_name, avatar_url, role),
          task:tasks!applications_task_id_fkey(id, title)
        `)
        .in("task_id", taskIds)
        .order("created_at", { ascending: false });

      const studentIds = [...new Set((applications ?? []).map((a: any) => a.student_id))];
      const { data: studentProfiles } = await supabase
        .from("student_profiles")
        .select("user_id, rating_average, rating_count, tasks_completed, verified, university, location")
        .in("user_id", studentIds);

      const profileMap = new Map((studentProfiles ?? []).map((sp: any) => [sp.user_id, sp]));

      return (applications ?? []).map((app: any) => ({
        ...app,
        studentProfile: profileMap.get(app.student_id) ?? null,
      }));
    },
  });

  async function handleStatusChange(appId: string, newStatus: "accepted" | "rejected") {
    setActionLoading(appId);
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", appId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(newStatus === "accepted" ? "Applicant accepted" : "Applicant rejected");
      qc.invalidateQueries({ queryKey: ["all-applicants", user?.id] });
    }
    setActionLoading(null);
  }

  async function handleDelete(appId: string) {
    if (!window.confirm("Remove this application?")) return;
    setActionLoading(appId);
    const { error } = await supabase.from("applications").delete().eq("id", appId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Application removed");
      qc.invalidateQueries({ queryKey: ["all-applicants", user?.id] });
    }
    setActionLoading(null);
  }

  // Group applicants by task
  const grouped = new Map<string, { taskTitle: string; apps: any[] }>();
  for (const app of applicants ?? []) {
    const taskId = app.task_id;
    const taskTitle = app.task?.title ?? "Unknown Task";
    if (filterTask !== "all" && taskId !== filterTask) continue;

    const nameMatch = !search.trim() || app.student?.full_name?.toLowerCase().includes(search.toLowerCase());
    if (!nameMatch) continue;

    if (!grouped.has(taskId)) grouped.set(taskId, { taskTitle, apps: [] });
    grouped.get(taskId)!.apps.push(app);
  }

  // Sort apps within each group
  for (const [, group] of grouped) {
    group.apps.sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  const totalApps = applicants?.length ?? 0;
  const approvedApps = applicants?.filter((a) => a.status === "accepted").length ?? 0;
  const rejectedApps = applicants?.filter((a) => a.status === "rejected").length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 pt-7 sm:px-8">
      <h1 className="mb-6 font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1a1e16]">All Applicants</h1>

      <div className="border border-[#e4efe0] bg-white p-5">
        {/* Filter bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ..."
              className="h-10 w-full border border-[#e4efe0] bg-[#f9fdf7] px-3 text-[0.85rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus:border-[#3dcb6c] focus:outline-none focus:ring-1 focus:ring-[#3dcb6c]"
            />
          </div>
          <select
            value={filterTask}
            onChange={(e) => setFilterTask(e.target.value)}
            className="h-10 border border-[#e4efe0] bg-[#f9fdf7] px-3 text-[0.8rem] text-[#1a1e16] focus:border-[#3dcb6c] focus:outline-none"
          >
            <option value="all">Filter by Job</option>
            {tasks?.map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <button className="grid size-10 place-items-center bg-[#3dcb6c] text-white transition-colors hover:bg-[#34b85e]">
            <Search className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[0.8rem] text-[#6a8064]">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-10 border border-[#e4efe0] bg-[#f9fdf7] px-3 text-[0.8rem] text-[#1a1e16] focus:border-[#3dcb6c] focus:outline-none"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
            </select>
          </div>
        </div>

        {/* Overall stats */}
        <div className="mb-5 flex items-center justify-end gap-6 text-[0.8rem]">
          <span className="text-[#6a8064]">Total(s): <span className="font-semibold text-[#1a1e16]">{totalApps}</span></span>
          <span className="text-[#6a8064]">Approved: <span className="font-semibold text-[#2e7d32]">{approvedApps}</span></span>
          <span className="text-[#6a8064]">Rejected(s): <span className="font-semibold text-[#d64545]">{rejectedApps}</span></span>
        </div>

        {/* Applicants grouped by task */}
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse bg-[#f9fdf7]" />
            ))}
          </div>
        ) : grouped.size === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center bg-[#f0f7ec]">
              <Users className="size-6 text-[#3dcb6c]" />
            </div>
            <p className="mt-3 text-[0.9rem] font-medium text-[#1a1e16]">No applicants found</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([taskId, { taskTitle, apps }]) => {
              const taskApproved = apps.filter((a) => a.status === "accepted").length;
              const taskRejected = apps.filter((a) => a.status === "rejected").length;

              return (
                <div key={taskId}>
                  {/* Task header */}
                  <div className="mb-3 flex items-center justify-between border-b border-[#e4efe0] pb-2">
                    <h2 className="text-[0.95rem] font-semibold text-[#1a1e16]">{taskTitle}</h2>
                    <div className="flex items-center gap-4 text-[0.75rem] text-[#6a8064]">
                      <span>Total(s): <span className="font-semibold text-[#1a1e16]">{apps.length}</span></span>
                      <span>Approved: <span className="font-semibold text-[#2e7d32]">{taskApproved}</span></span>
                      <span>Rejected(s): <span className="font-semibold text-[#d64545]">{taskRejected}</span></span>
                    </div>
                  </div>

                  {/* Applicant cards */}
                  <div className="space-y-3">
                    {apps.map((app: any) => (
                      <div key={app.id} className="border border-[#e4efe0] bg-[#f9fdf7] p-4">
                        <div className="flex items-start gap-3">
                          <InitialsAvatar
                            name={app.student?.full_name ?? "User"}
                            size={48}
                            avatarUrl={app.student?.avatar_url}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Link
                                to="/app/profile/$userId"
                                params={{ userId: app.student_id }}
                                className="text-[0.85rem] font-semibold text-[#1a1e16] hover:text-[#3dcb6c]"
                              >
                                {app.student?.full_name ?? "Anonymous"}
                              </Link>
                              <span className="bg-[#e8f5e9] px-2 py-0.5 text-[0.65rem] font-medium text-[#2e7d32]">
                                Freelancer
                              </span>
                              <span className={`px-2 py-0.5 text-[0.65rem] font-medium ${
                                app.status === "accepted" ? "bg-[#e8f5e9] text-[#2e7d32]" :
                                app.status === "rejected" ? "bg-[#fce4ec] text-[#c62828]" :
                                "bg-[#fff3e0] text-[#e65100]"
                              }`}>
                                {app.status === "accepted" ? "Approved" :
                                 app.status === "rejected" ? "Rejected" : "Pending"}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[0.75rem] text-[#6a8064]">
                              {app.studentProfile?.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="size-3" /> {app.studentProfile.location}
                                </span>
                              )}
                              {app.price && (
                                <span className="inline-flex items-center gap-1">
                                  <DollarSign className="size-3" /> ₦{Number(app.price).toLocaleString("en-NG")}
                                  {app.hours && ` / ${app.hours}h`}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3" />
                                Applied: {new Date(app.created_at).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            {app.message && (
                              <p className="mt-2 line-clamp-2 text-[0.8rem] leading-relaxed text-[#1a1e16]">{app.message}</p>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex shrink-0 items-center gap-1.5">
                            {app.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(app.id, "accepted")}
                                disabled={actionLoading === app.id}
                                className="grid size-8 place-items-center bg-[#3dcb6c] text-white transition-colors hover:bg-[#34b85e] disabled:opacity-50"
                                title="Accept"
                              >
                                {actionLoading === app.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                              </button>
                            )}
                            {app.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(app.id, "rejected")}
                                disabled={actionLoading === app.id}
                                className="grid size-8 place-items-center border border-[#e4efe0] bg-white text-[#6a8064] transition-colors hover:border-[#d64545] hover:text-[#d64545] disabled:opacity-50"
                                title="Reject"
                              >
                                <span className="text-[1.1rem] leading-none">×</span>
                              </button>
                            )}
                            <Link
                              to="/app/messages"
                              search={undefined as any}
                              className="grid size-8 place-items-center border border-[#e4efe0] bg-white text-[#6a8064] transition-colors hover:border-[#3dcb6c] hover:text-[#3dcb6c]"
                              title="Message"
                            >
                              <Link2 className="size-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(app.id)}
                              disabled={actionLoading === app.id}
                              className="grid size-8 place-items-center border border-[#e4efe0] bg-[#fef4f4] text-[#d64545] transition-colors hover:border-[#d64545] disabled:opacity-50"
                              title="Remove"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
