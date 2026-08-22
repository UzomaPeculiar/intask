import { ReportButton } from "@/components/intask/ReportButton";
import { SaveTaskButton } from "@/components/intask/SaveTaskButton";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge, StatusPill } from "@/components/intask/Badges";
import { naira, shortDate } from "@/lib/format";
import {
  ArrowLeft,
  ShieldCheck,
  MapPin,
  Calendar as CalIcon,
  Loader2,
  Users,
  Share2,

  Eye,
  Clock,
  Briefcase,
  Globe,
  Languages,
  BarChart3,
  FileText,

  Star,
} from "lucide-react";
import { toast } from "sonner";
import { useApplicantCount, applicantLabel } from "@/hooks/useApplicantCount";
import { TaskDetailSkeleton } from "@/components/intask/Skeletons";
import { Input } from "@/components/ui/input";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";
import { getProjectRoomForTask, getTaskForViewer } from "@/lib/task.functions";

export const Route = createFileRoute("/app/tasks/$taskId/")({
  head: () => ({ meta: [{ title: "Task — InTask" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
  const loadRuntimePlatformSettings = useServerFn(getRuntimePlatformSettings);
  const loadProjectRoomForTask = useServerFn(getProjectRoomForTask);
  const loadTaskForViewer = useServerFn(getTaskForViewer);

  useEffect(() => {
    if (!taskId) return;
    (supabase as any).rpc("increment_task_views", { task_uuid: taskId });
  }, [taskId]);

  const nav = useNavigate();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-viewer", taskId],
    queryFn: async () => await loadTaskForViewer({ data: { taskId } }),
  });

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: escrowTx } = useQuery({
    queryKey: ["task-escrow-lock", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("status")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const { data: myApp } = useQuery({
    queryKey: ["my-app", taskId, me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase.from("applications").select("*").eq("task_id", taskId).eq("student_id", me!.id).maybeSingle();
      return data;
    },
  });

  const { data: teamMembership } = useQuery({
    queryKey: ["task-team-membership", taskId, me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      if (!me?.id) return null;
      const { data } = await supabase
        .from("task_team_members")
        .select("id, status")
        .eq("task_id", taskId)
        .eq("student_id", me.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-role", me?.id],
    enabled: !!me?.id,
    queryFn: async () => (await supabase.from("profiles").select("role").eq("id", me!.id).maybeSingle()).data,
  });

  const { data: myTaskReviews } = useQuery({
    queryKey: ["my-task-reviews", taskId, me?.id],
    enabled: !!taskId && !!me?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("reviewee_id")
        .eq("task_id", taskId)
        .eq("reviewer_id", me!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: completedTeamMembers } = useQuery({
    queryKey: ["completed-team-members", taskId],
    enabled: !!task?.is_team_task && task?.status === "completed" && !!me?.id && me.id === task.poster_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_team_members")
        .select("student_id")
        .eq("task_id", taskId)
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const myRole = (myProfile?.role ?? "student") as "student" | "alumni" | "company" | "individual";
  const canApply = myRole === "student" || myRole === "alumni";
  const liveApplicantCount = useApplicantCount(task?.id, task?.applicants_count ?? 0);

  if (isLoading) {
    return <TaskDetailSkeleton />;
  }

  if (!task) return <div className="px-4 pt-10 text-center text-muted-foreground">Task not found.</div>;

  const isOwn = me?.id === task.poster_id;
  const isAssignedStudent = !isOwn && (task.matched_student_id === me?.id || !!teamMembership);
  const canMessagePoster = !!me?.id && !isOwn && canApply;
  const isTaskEditable = (task.status === "open" || task.status === "matched") && !["pending", "in_escrow", "released", "refunded"].includes(escrowTx?.status ?? "");
  const reviewedIds = new Set((myTaskReviews ?? []).map((review: any) => review.reviewee_id).filter(Boolean));
  const ownerExpectedReviewees = task.is_team_task
    ? (completedTeamMembers ?? []).map((member: any) => member.student_id).filter(Boolean)
    : [task.matched_student_id].filter(Boolean);
  const ownerCanLeaveReview = task.status === "completed" && ownerExpectedReviewees.some((revieweeId: string) => !reviewedIds.has(revieweeId));
  const studentExpectedReviewees = [task.poster_id].filter(Boolean);
  const studentCanLeaveReview = task.status === "completed" && studentExpectedReviewees.some((revieweeId: string) => !reviewedIds.has(revieweeId));

  const messagePoster = useMutation({
    mutationFn: async () => {
      if (!me?.id) throw new Error("Please sign in to message the poster");
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("task_id", task.id)
        .eq("student_id", me.id)
        .eq("poster_id", task.poster_id)
        .maybeSingle();

      if (existing?.id) return existing.id;

      const { data, error } = await supabase
        .from("conversations")
        .insert({ task_id: task.id, student_id: me.id, poster_id: task.poster_id })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (conversationId) => nav({ to: "/app/messages", search: { conversationId } }),
    onError: (error: any) => toast.error(error?.message ?? "Could not open conversation"),
  });

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  return (
    <div className="min-h-screen bg-[#f0f7ec] text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10">
        {/* Back button */}
        <nav className="mb-5">
          <button
            onClick={() => nav({ to: "/app/browse", search: { q: "" } })}
            className="inline-flex items-center gap-2 rounded-full border border-[#c4deb8] bg-white px-4 py-2 text-[0.8rem] font-medium text-[#1a1e16] hover:bg-[#f4fbf0] transition-colors"
          >
            <ArrowLeft className="size-4" /> Browse Tasks
          </button>
        </nav>

        {/* Action buttons top right */}
        <div className="absolute right-4 top-5 flex items-center gap-2 sm:right-8 lg:right-10">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#c4deb8] bg-white px-3 py-1.5 text-[0.75rem] font-medium text-[#1a1e16] hover:bg-[#f4fbf0] transition-colors"
          >
            <Share2 className="size-3.5" /> Share
          </button>
          {me?.id && (
            <SaveTaskButton taskId={task.id} userId={me.id} />
          )}
          {task.poster_id !== me?.id && (
            <ReportButton reportedId={task.poster_id} reportedName={task.poster?.full_name ?? "this poster"} />
          )}
        </div>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Left column - Main content */}
          <div className="min-w-0 space-y-5">
            {/* Task Title Card */}
            <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
              <h1 className="text-[1.5rem] font-bold leading-[1.25] text-[#1a1e16]">
                {task.title}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.8rem] text-[#6a8064]">
                {task.work_type && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-4 text-[#3dcb6c]" />
                    {task.work_type === "remote" ? "Remote" : task.work_type === "on_campus" ? "On-campus" : "Remote or On-campus"}
                  </span>
                )}
                {task.deadline && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalIcon className="size-4 text-[#3dcb6c]" />
                    {shortDate(task.deadline)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="size-4 text-[#3dcb6c]" />
                  {task.views_count ?? 0} Views
                </span>
              </div>
            </div>

            {/* Task Details Grid */}
            <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
                <TaskDetailItem
                  icon={<MapPin className="size-5 text-[#3dcb6c]" />}
                  label="Project Location"
                  value={task.work_type === "remote" ? "Remote" : task.work_type === "on_campus" ? "On-campus" : "Hybrid"}
                />
                <TaskDetailItem
                  icon={<Briefcase className="size-5 text-[#3dcb6c]" />}
                  label="Project Type"
                  value={task.budget_negotiable ? "Negotiable" : "Fixed"}
                />
                <TaskDetailItem
                  icon={<Clock className="size-5 text-[#3dcb6c]" />}
                  label="Duration"
                  value={task.deadline ? shortDate(task.deadline) : "Open"}
                />
                <TaskDetailItem
                  icon={<BarChart3 className="size-5 text-[#3dcb6c]" />}
                  label="Level"
                  value={task.difficulty_level || "Any Level"}
                />
                <TaskDetailItem
                  icon={<Languages className="size-5 text-[#3dcb6c]" />}
                  label="Category"
                  value={task.category || "General"}
                />
                <TaskDetailItem
                  icon={<Globe className="size-5 text-[#3dcb6c]" />}
                  label="Work Type"
                  value={task.work_type === "remote" ? "Remote" : task.work_type === "on_campus" ? "On-campus" : "Flexible"}
                />
              </div>
            </div>

            {/* Project Description */}
            <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
              <h2 className="mb-4 text-[1.1rem] font-bold text-[#1a1e16]">Project Description</h2>
              <p className="whitespace-pre-wrap text-[0.88rem] leading-[1.7] text-[#3a3f36]">{task.description}</p>
            </div>

            {/* Attachments placeholder - if task has files */}
            {task.attachments_url && task.attachments_url.length > 0 && (
              <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
                <h2 className="mb-4 text-[1.1rem] font-bold text-[#1a1e16]">Attachments</h2>
                <div className="flex flex-wrap gap-3">
                  {(task.attachments_url as string[]).map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-[10px] border border-[#e4efe0] bg-[#f9fdf7] px-4 py-3 transition-colors hover:bg-[#f0f8ec]"
                    >
                      <FileText className="size-8 text-[#3dcb6c]" />
                      <div>
                        <p className="text-[0.8rem] font-semibold text-[#1a1e16]">Attachment {idx + 1}</p>
                        <p className="text-[0.7rem] text-[#6a8064]">PDF</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Skills Required */}
            {task.skills_needed?.length > 0 && (
              <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
                <h2 className="mb-4 text-[1.1rem] font-bold text-[#1a1e16]">Skills Required</h2>
                <div className="flex flex-wrap gap-2">
                  {task.skills_needed.map((skill: string) => (
                    <span
                      key={skill}
                      className="rounded-full border border-[#c4deb8] bg-[#f4fbf0] px-4 py-1.5 text-[0.78rem] font-medium text-[#1a7a42]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Proposals / Applications section */}
            <ProposalsSection taskId={taskId} task={task} me={me} isOwn={isOwn} canApply={canApply} liveApplicantCount={liveApplicantCount} canMessagePoster={canMessagePoster} messagePoster={messagePoster} />

            {/* Apply form for non-owners */}
            {!isOwn && !isAssignedStudent && (
              <div id="proposal-form" className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
                <h2 className="mb-4 text-[1.1rem] font-bold text-[#1a1e16]">Send Your Application</h2>
                {canApply ? (
                  myApp ? (
                    <div className="rounded-[10px] border border-[#c4deb8] bg-[#f4fbf0] p-4 text-center">
                      <p className="text-[0.85rem] font-medium text-[#1a7a42]">✓ Application submitted</p>
                      <p className="mt-1 text-[0.75rem] text-[#6a8064]">You've already applied to this task.</p>
                    </div>
                  ) : (
                    <ApplyForm taskId={task.id} budget={task.budget} negotiable={task.budget_negotiable} />
                  )
                ) : (
                  <p className="text-center text-[0.8rem] text-[#6a8064]">Only verified students can apply for tasks.</p>
                )}
              </div>
            )}

            {/* Related Tasks - placeholder */}
            <RelatedTasksSection taskId={taskId} category={task.category} />
          </div>

          {/* Right column - Sticky sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-5">
              {/* Price Card */}
              <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
                <p className="text-[1.8rem] font-bold text-[#1a1e16]">
                  {task.budget_negotiable ? "Negotiable" : naira(task.budget)}
                </p>
                <p className="mt-1 text-[0.8rem] text-[#6a8064]">{task.budget_negotiable ? "Open to negotiation" : "Fixed"}</p>

                <div className="mt-4">
                  {isOwn ? (
                    <OwnerActions
                      task={task}
                      taskId={taskId}
                      escrowTx={escrowTx}
                      isTaskEditable={isTaskEditable}
                      liveApplicantCount={liveApplicantCount}
                      ownerCanLeaveReview={ownerCanLeaveReview}
                      loadProjectRoomForTask={loadProjectRoomForTask}
                    />
                  ) : isAssignedStudent ? (
                    <AssignedStudentActions
                      task={task}
                      taskId={taskId}
                      studentCanLeaveReview={studentCanLeaveReview}
                      loadProjectRoomForTask={loadProjectRoomForTask}
                    />
                  ) : canApply ? (
                    myApp ? (
                      <Button disabled className="h-11 w-full rounded-[10px] border border-[#c4deb8] bg-white text-[0.85rem] font-medium text-[#1a1e16]">
                        Application submitted
                      </Button>
                    ) : (
                      <Button
                        className="h-11 w-full rounded-[10px] bg-[#3dcb6c] text-white text-[0.85rem] font-semibold hover:bg-[#33b45f]"
                        onClick={() => {
                          document.getElementById("proposal-form")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Apply ↗
                      </Button>
                    )
                  ) : (
                    <p className="text-center text-[0.75rem] text-[#6a8064]">Only verified students can apply.</p>
                  )}
                </div>

                {canApply && (
                  <p className="mt-2 text-center text-[0.75rem] text-[#6a8064]">{liveApplicantCount} student{liveApplicantCount === 1 ? "" : "s"} applied</p>
                )}
              </div>

              {/* About Poster Card */}
              <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
                <h3 className="mb-4 text-[1rem] font-bold text-[#1a1e16]">About Poster</h3>
                <Link
                  to="/app/profile/$userId"
                  params={{ userId: task.poster_id }}
                  className="flex items-center gap-3"
                >
                  <InitialsAvatar name={task.poster?.full_name} size={56} />
                  <div className="min-w-0">
                    <p className="truncate text-[0.9rem] font-semibold text-[#1a1e16]">{task.poster?.full_name}</p>
                    <div className="mt-0.5">
                      <VerifiedBadge role={task.poster?.role} verified={true} />
                    </div>
                  </div>
                </Link>

                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#e4efe0] pt-4">
                  <div className="text-center">
                    <p className="text-[0.65rem] text-[#6a8064]">Location</p>
                    <p className="mt-0.5 text-[0.75rem] font-medium text-[#1a1e16]">Campus</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[0.65rem] text-[#6a8064]">Posted</p>
                    <p className="mt-0.5 text-[0.75rem] font-medium text-[#1a1e16]">{shortDate(task.created_at)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[0.65rem] text-[#6a8064]">Category</p>
                    <p className="mt-0.5 text-[0.75rem] font-medium text-[#1a1e16]">{task.category || "General"}</p>
                  </div>
                </div>
              </div>

              {/* Message button */}
              {canMessagePoster && (
                <Button
                  variant="outline"
                  className="h-11 w-full rounded-[10px] border-[#3dcb6c] bg-white text-[0.85rem] font-semibold text-[#3dcb6c] hover:bg-[#f4fbf0]"
                  disabled={messagePoster.isPending}
                  onClick={() => messagePoster.mutate()}
                >
                  {messagePoster.isPending ? "Opening chat..." : "Contact Poster ↗"}
                </Button>
              )}

              {/* Escrow info */}
              <div className="rounded-[10px] border border-[#c4deb8] bg-[#f4fbf0] p-4">
                <p className="flex items-start gap-2 text-[0.75rem] leading-[1.5] text-[#6a8064]">
                  <ShieldCheck className="mt-[1px] size-4 shrink-0 text-[#1a7a42]" />
                  Payment is held securely in escrow via Paystack and released only when you approve delivered work.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile fixed bottom actions */}
      {!isOwn && isAssignedStudent && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-md space-y-2">
            <AssignedStudentActions task={task} taskId={taskId} studentCanLeaveReview={studentCanLeaveReview} loadProjectRoomForTask={loadProjectRoomForTask} />
          </div>
        </div>
      )}

      {isOwn && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-md space-y-2">
            <OwnerActions task={task} taskId={taskId} escrowTx={escrowTx} isTaskEditable={isTaskEditable} liveApplicantCount={liveApplicantCount} ownerCanLeaveReview={ownerCanLeaveReview} loadProjectRoomForTask={loadProjectRoomForTask} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function TaskDetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid size-10 place-items-center rounded-full bg-[#f0f7ec]">{icon}</div>
      <div>
        <p className="text-[0.72rem] text-[#6a8064]">{label}</p>
        <p className="mt-0.5 text-[0.85rem] font-semibold text-[#1a1e16]">{value}</p>
      </div>
    </div>
  );
}

function ProposalsSection({ taskId, task, me, isOwn, canApply, liveApplicantCount, canMessagePoster, messagePoster }: any) {
  const { data: apps, isLoading: appsLoading } = useQuery({
    queryKey: ["task-apps-preview", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data } = await supabase
        .from("applications")
        .select("*, student:profiles!applications_student_id_fkey(id, full_name, avatar_url, role)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  if (appsLoading || !apps || apps.length === 0) return null;

  return (
    <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
      <h2 className="mb-4 text-[1.1rem] font-bold text-[#1a1e16]">Proposals ({apps.length})</h2>
      <div className="space-y-3">
        {apps.map((app: any) => (
          <div key={app.id} className="flex items-start gap-3 rounded-[10px] border border-[#e4efe0] bg-[#f9fdf7] p-4">
            <InitialsAvatar name={app.student?.full_name} avatarUrl={app.student?.avatar_url} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[0.85rem] font-semibold text-[#1a1e16]">{app.student?.full_name}</p>
                <span className="inline-flex items-center gap-0.5 text-[0.7rem] text-[#6a8064]">
                  <Star className="size-3 fill-[#f5a623] text-[#f5a623]" /> 0.0
                </span>
              </div>
              <p className="mt-0.5 text-[0.7rem] text-[#6a8064]">
                {shortDate(app.created_at)}
              </p>
              {app.message && <p className="mt-1.5 line-clamp-2 text-[0.8rem] text-[#3a3f36]">{app.message}</p>}
            </div>
            <div className="shrink-0 text-right">
              {app.proposed_rate && (
                <p className="text-[0.85rem] font-bold text-[#1a1e16]">{naira(app.proposed_rate)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerActions({ task, taskId, escrowTx, isTaskEditable, liveApplicantCount, ownerCanLeaveReview, loadProjectRoomForTask }: any) {
  const nav = useNavigate();
  const actionPrimaryClass = "h-11 w-full rounded-[10px] bg-[#3dcb6c] text-white text-[0.85rem] font-semibold hover:bg-[#33b45f]";
  const actionSecondaryClass = "h-11 w-full rounded-[10px] border border-[#c4deb8] bg-white text-[#1a1e16] text-[0.85rem] font-medium hover:bg-[#f3f9f0]";

  return (
    <div className="space-y-2.5">
      {task.status !== "open" && !!(task.is_team_task || task.matched_student_id) && (
        <Button
          variant="outline"
          size="lg"
          className={`${actionSecondaryClass} w-full gap-1`}
          onClick={async () => {
            const room = await loadProjectRoomForTask({ data: { taskId: task.id } }).catch(() => null);
            const roomId = (room as any)?.roomId ?? (room as any)?.room_id;
            if (roomId) {
              nav({ to: "/app/rooms/$roomId", params: { roomId } });
            } else {
              toast.error("Project room not found");
            }
          }}
        >
          <Users className="size-4" /> Open project room
        </Button>
      )}
      {isTaskEditable && (
        <Link to="/app/tasks/$taskId/edit" params={{ taskId: task.id }}>
          <Button size="lg" variant="outline" className={actionSecondaryClass}>Edit task</Button>
        </Link>
      )}
      {task.status === "open" && (
        <Button size="lg" className={actionPrimaryClass} onClick={() => nav({ to: "/app/tasks/$taskId/applicants", params: { taskId: task.id } })}>
          {applicantLabel(liveApplicantCount)}
        </Button>
      )}
      {task.status === "matched" && (
        <Link to="/app/payment/$taskId" params={{ taskId: task.id }}>
          <Button size="lg" className={actionPrimaryClass}>Fund escrow to start</Button>
        </Link>
      )}
      {task.status === "in_progress" && <Button disabled size="lg" className={actionSecondaryClass}>Student is working</Button>}
      {task.status === "in_review" && (
        <Link to="/app/tasks/$taskId/review" params={{ taskId: task.id }}>
          <Button size="lg" className={actionPrimaryClass}>Review delivery</Button>
        </Link>
      )}
      {ownerCanLeaveReview && (
        <Link to="/app/tasks/$taskId/rate" params={{ taskId: task.id }}>
          <Button size="lg" variant="outline" className={actionSecondaryClass}>Leave a review</Button>
        </Link>
      )}
    </div>
  );
}

function AssignedStudentActions({ task, taskId, studentCanLeaveReview, loadProjectRoomForTask }: any) {
  const nav = useNavigate();
  const actionPrimaryClass = "h-11 w-full rounded-[10px] bg-[#3dcb6c] text-white text-[0.85rem] font-semibold hover:bg-[#33b45f]";
  const actionSecondaryClass = "h-11 w-full rounded-[10px] border border-[#c4deb8] bg-white text-[#1a1e16] text-[0.85rem] font-medium hover:bg-[#f3f9f0]";

  return (
    <div className="space-y-2.5">
      <Button
        variant="outline"
        size="lg"
        className={`${actionSecondaryClass} gap-1`}
        onClick={async () => {
          const room = await loadProjectRoomForTask({ data: { taskId: task.id } }).catch(() => null);
          const roomId = (room as any)?.roomId ?? (room as any)?.room_id;
          if (roomId) {
            nav({ to: "/app/rooms/$roomId", params: { roomId } });
          } else {
            toast.error("Project room not found");
          }
        }}
      >
        <Users className="size-4" /> Open project room
      </Button>
      {task.status === "in_progress" && (
        <Link to="/app/tasks/$taskId/deliver" params={{ taskId: task.id }}>
          <Button size="lg" className={actionPrimaryClass}>Submit delivery</Button>
        </Link>
      )}
      {task.status === "in_review" && <Button disabled size="lg" className={actionSecondaryClass}>Awaiting poster review</Button>}
      {studentCanLeaveReview && (
        <Link to="/app/tasks/$taskId/rate" params={{ taskId: task.id }}>
          <Button size="lg" variant="outline" className={actionSecondaryClass}>Leave a review</Button>
        </Link>
      )}
    </div>
  );
}

function RelatedTasksSection({ taskId, category }: { taskId: string; category?: string }) {
  const { data: relatedTasks, isLoading } = useQuery({
    queryKey: ["related-tasks", taskId, category],
    enabled: !!category,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, budget, budget_negotiable, category, skills_needed, work_type, poster:profiles!tasks_poster_id_fkey(full_name, avatar_url)")
        .eq("category", category!)
        .neq("id", taskId)
        .eq("status", "open")
        .limit(3);
      return data ?? [];
    },
  });

  if (isLoading || !relatedTasks || relatedTasks.length === 0) return null;

  return (
    <div className="rounded-[14px] border border-[#c4deb8] bg-white p-6">
      <h2 className="mb-4 text-[1.1rem] font-bold text-[#1a1e16]">Related Projects</h2>
      <div className="space-y-3">
        {relatedTasks.map((rt: any) => (
          <Link
            key={rt.id}
            to="/app/tasks/$taskId"
            params={{ taskId: rt.id }}
            className="flex items-center gap-4 rounded-[10px] border border-[#e4efe0] bg-[#f9fdf7] p-4 transition-colors hover:bg-[#f0f8ec]"
          >
            <InitialsAvatar name={rt.poster?.full_name} avatarUrl={rt.poster?.avatar_url} size={44} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.85rem] font-semibold text-[#1a1e16]">{rt.title}</p>
              <p className="mt-0.5 text-[0.7rem] text-[#6a8064]">{rt.category}</p>
              {rt.skills_needed?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {rt.skills_needed.slice(0, 3).map((s: string) => (
                    <span key={s} className="rounded-full border border-[#c4deb8] bg-[#f4fbf0] px-2 py-0.5 text-[0.65rem] text-[#1a7a42]">{s}</span>
                  ))}
                  {rt.skills_needed.length > 3 && (
                    <span className="text-[0.65rem] text-[#6a8064]">+{rt.skills_needed.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.9rem] font-bold text-[#1a1e16]">{rt.budget_negotiable ? "Negotiable" : naira(rt.budget)}</p>
              <p className="text-[0.65rem] text-[#6a8064]">{rt.budget_negotiable ? "Open" : "Fixed"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}



function ApplyForm({ taskId, budget, negotiable }: { taskId: string; budget: number; negotiable: boolean }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [hours, setHours] = useState("4");

  const apply = useMutation({
    mutationFn: async () => {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      if (!user) throw new Error("Not signed in");

      const { data: limitData } = await (supabase as any)
        .rpc("application_limit_for_student", { _student_id: user.id });
      const maxAllowed = Number(Array.isArray(limitData) ? limitData[0] : limitData);

      if (Number.isFinite(maxAllowed) && maxAllowed < 2147483647) {
        const { count } = await supabase
          .from("applications")
          .select("id", { count: "exact", head: true })
          .eq("student_id", user.id)
          .eq("status", "pending");

        if ((count ?? 0) >= maxAllowed) {
          throw new Error(`You can only have ${maxAllowed} active applications on the free plan.`);
        }
      }

      const { data, error } = await supabase
        .from("applications")
        .insert({
          task_id: taskId,
          student_id: user.id,
          message: msg.trim(),
          status: "pending",
          proposed_rate: (proposedRate ? Number(proposedRate) : null) as never,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Application submitted successfully");
      qc.invalidateQueries({ queryKey: ["my-app", taskId] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
    },
    onError: (e: any) => {
      toast.error(e?.message || "Something went wrong");
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[0.8rem] font-medium text-[#1a1e16]">Your Total Price</label>
          <Input
            type="number"
            value={proposedRate}
            onChange={(e) => setProposedRate(e.target.value)}
            placeholder="Price"
            className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[0.8rem] font-medium text-[#1a1e16]">Estimated Hours</label>
          <Input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="4"
            className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7]"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-[0.8rem] font-medium text-[#1a1e16]">Cover Letter</label>
        <Textarea
          rows={6}
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Why are you the right person for this task? Mention relevant experience..."
          maxLength={1000}
          className="rounded-[10px] border-[#c4deb8] bg-[#f9fdf7]"
        />
      </div>
      <Button
        className="h-11 rounded-[10px] bg-[#3dcb6c] text-[0.85rem] font-semibold text-white hover:bg-[#33b45f]"
        disabled={!msg.trim() || apply.isPending}
        onClick={() => apply.mutate()}
      >
        {apply.isPending ? "Submitting…" : "Apply ↗"}
      </Button>
    </div>
  );
}
