import { MessagePartyLink } from "@/components/intask/MessagePartyLink";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { EmptyState } from "@/components/intask/EmptyState";
import { naira } from "@/lib/format";
import { ArrowLeft, Inbox, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { acceptTaskApplicant, removeAcceptedTaskApplicant } from "@/lib/task.functions";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";
import { ApplicationsSkeleton } from "@/components/intask/Skeletons";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";

export const Route = createFileRoute("/app/tasks/$taskId/applicants")({
  head: () => ({ meta: [{ title: "Applicants — InTask" }] }),
  component: ApplicantsPage,
});

function ApplicantsPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const acceptApplicant = useServerFn(acceptTaskApplicant);
  const removeAcceptedApplicant = useServerFn(removeAcceptedTaskApplicant);
  const loadRuntimePlatformSettings = useServerFn(getRuntimePlatformSettings);
  const [tab, setTab] = useState<"pending" | "accepted" | "rejected" | "all">("pending");

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("id", taskId).single()).data,
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

  const isOwner = !!me?.id && !!task?.poster_id && me.id === task.poster_id;

  const { data: apps, isLoading } = useQuery({
    queryKey: ["applicants", taskId],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, student:profiles!applications_student_id_fkey(id, full_name, role, avatar_url)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const applications = data ?? [];
      const ids = applications.map((application) => application.student_id);
      const studentProfileById: Record<string, any> = {};
      if (ids.length > 0) {
        const { data: studentProfiles } = await supabase
          .from("student_profiles")
          .select("user_id, department, portfolio, rating_average, rating_count, skills, tasks_completed, university, verified, year_of_study, verification_method, created_at, updated_at")
          .in("user_id", ids);
        for (const studentProfile of studentProfiles ?? []) studentProfileById[studentProfile.user_id] = studentProfile;
      }
      return applications.map((application) => ({ ...application, student_profile: studentProfileById[application.student_id] ?? null }));
    },
  });

  const accept = useMutation({
    mutationFn: async ({ appId, studentId, agreedPrice }: { appId: string; studentId: string; agreedPrice?: number }) => {
      return acceptApplicant({ data: { taskId, appId, studentId, agreedPrice } });
    },
    onSuccess: async (result) => {
      const isTeamTask = (task as any)?.is_team_task;
      const teamSize = (task as any)?.team_size ?? 1;
      toast.success(isTeamTask ? `Student added to team. ${teamSize} students needed total.` : "Student accepted. Fund escrow next.");
      qc.invalidateQueries({ queryKey: ["applicants", taskId] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      if (!result?.isTeamTask) {
        nav({ to: "/app/payment/$taskId", params: { taskId } });
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't accept"),
  });

  const dismiss = useMutation({
    mutationFn: async ({ appId, studentId }: { appId: string; studentId: string }) => {
      const { error } = await supabase.from("applications").update({ status: "rejected" }).eq("id", appId);
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "application_rejected",
        message: `Your application for "${task?.title}" was not selected this time. Keep applying!`,
        link: `/app/tasks/${taskId}`,
      });
    },
    onSuccess: () => {
      toast.success("Applicant dismissed");
      qc.invalidateQueries({ queryKey: ["applicants", taskId] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't dismiss"),
  });

  const removeAccepted = useMutation({
    mutationFn: async ({ appId, studentId }: { appId: string; studentId: string }) => {
      return removeAcceptedApplicant({ data: { taskId, appId, studentId } });
    },
    onSuccess: () => {
      toast.success("Accepted student removed. You can now accept another applicant.");
      qc.invalidateQueries({ queryKey: ["applicants", taskId] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't remove accepted student"),
  });

  const pendingApps = (apps ?? []).filter((application: any) => application.status === "pending");
  const acceptedApps = (apps ?? []).filter((application: any) => application.status === "accepted");
  const rejectedApps = (apps ?? []).filter((application: any) => application.status === "rejected");
  const visibleApps = tab === "all" ? apps ?? [] : tab === "pending" ? pendingApps : tab === "accepted" ? acceptedApps : rejectedApps;

  const tabButtonClass = (isActive: boolean) =>
    `rounded-lg px-2 py-2 text-center text-[0.8rem] font-semibold transition-colors ${
      isActive ? "bg-white text-[#1E293B] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "bg-transparent text-[#6B7280] hover:text-[#1E293B]"
    }`;

  const statusClass: Record<string, string> = {
    pending: "bg-[#F1F3F5] text-[#6B7280]",
    accepted: "bg-[rgba(22,163,74,0.12)] text-[#15803D]",
    rejected: "bg-[rgba(199,59,59,0.1)] text-[#c73b3b]",
  };

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 pb-10 pt-6 sm:px-6 md:px-12" style={{ color: "#1E293B" }}>
      <button
        onClick={() => window.history.back()}
        aria-label="Back"
        className="mb-4 inline-flex size-9 items-center justify-center rounded-full border bg-white"
        style={{ borderColor: "#E2E8F0" }}
      >
        <ArrowLeft className="size-4" />
      </button>

      {task && me && !isOwner && (
        <div className="mt-6 text-center text-sm text-muted-foreground">You don't have access to this task's applicants.</div>
      )}

      {isOwner && (
        <>
          {task && (
            <div
              className="mb-5 rounded-[18px] border p-5"
              style={{
                borderColor: "#E2E8F0",
                background: "linear-gradient(145deg, #F1F3F5, #eaf3f8)",
              }}
            >
              <h2 className="text-[1.2rem] font-bold leading-tight text-[#1E293B]" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>{task.title}</h2>
              <p className="mt-1.5 text-[1.1rem] font-bold text-[#15803D]" style={{ fontFamily: "Space Grotesk, Inter, sans-serif" }}>
                {task.budget_negotiable ? "Negotiable" : naira(task.budget)}
              </p>
            </div>
          )}

          <div className="mb-4 rounded-xl border bg-white p-4" style={{ borderColor: "#E2E8F0" }}>
            <h3 className="text-[0.9rem] font-semibold text-[#1E293B]">
              {apps?.length ?? 0} applicant{apps?.length === 1 ? "" : "s"}
            </h3>
            <p className="mt-0.5 text-[0.75rem] text-[#6B7280]">Review pending applicants first, then check accepted and dismissed history.</p>
          </div>

          {isLoading && <div className="mt-4"><ApplicationsSkeleton /></div>}

          {!isLoading && (apps?.length ?? 0) === 0 && (
            <div className="mt-4"><EmptyState icon={Inbox} title="No applicants yet" description="Students are being notified. Check back soon." /></div>
          )}

          {!isLoading && (apps?.length ?? 0) > 0 && (
            <>
              <div className="mb-5 grid grid-cols-4 gap-0.5 rounded-[10px] p-[3px]" style={{ backgroundColor: "#E2E8F0" }}>
                <button type="button" className={tabButtonClass(tab === "pending")} onClick={() => setTab("pending")}>Pending ({pendingApps.length})</button>
                <button type="button" className={tabButtonClass(tab === "accepted")} onClick={() => setTab("accepted")}>Accepted ({acceptedApps.length})</button>
                <button type="button" className={tabButtonClass(tab === "rejected")} onClick={() => setTab("rejected")}>Dismissed ({rejectedApps.length})</button>
                <button type="button" className={tabButtonClass(tab === "all")} onClick={() => setTab("all")}>All</button>
              </div>

              {visibleApps.length === 0 ? (
                <EmptyState icon={Inbox} title="No applicants in this group" description="Switch tabs to review other applicants." />
              ) : (
                <ul className="space-y-3">
                  {visibleApps.map((application: any) => (
                    <li
                      key={application.id}
                      className="cursor-pointer rounded-[14px] border bg-white p-[18px]"
                      style={{ borderColor: "#E2E8F0" }}
                      onClick={() => nav({ to: "/app/profile/$userId", params: { userId: application.student_id } })}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                          <InitialsAvatar name={application.student?.full_name} avatarUrl={application.student?.avatar_url} size={44} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate text-[0.9rem] font-semibold text-[#1E293B]">{application.student?.full_name}</p>
                            {application.student_profile?.verified && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold text-[#15803D]" style={{ backgroundColor: "rgba(22,163,74,0.12)" }}>
                                ✓ Verified
                              </span>
                            )}
                          </div>

                          {application.student_profile && (
                            <p className="mt-0.5 truncate text-[0.7rem] text-[#6B7280]">
                              {application.student_profile.university}
                              {application.student_profile.year_of_study ? ` · ${application.student_profile.year_of_study}` : ""}
                              {application.student_profile.department ? ` · ${application.student_profile.department}` : ""}
                            </p>
                          )}

                          <div className="mt-1 flex items-center gap-3 text-[0.7rem] text-[#6B7280]">
                            <span className="inline-flex items-center gap-1">
                              <Star className="size-3" />
                              {Number(application.student_profile?.rating_average ?? 0).toFixed(1)}
                            </span>
                            <span>{application.student_profile?.tasks_completed ?? 0} tasks done</span>
                          </div>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2.5 py-[3px] text-[0.65rem] font-semibold capitalize ${statusClass[application.status] ?? "bg-[#F1F3F5] text-[#6B7280]"}`}
                        >
                          {application.status === "rejected" ? "Dismissed" : application.status}
                        </span>
                      </div>

                      {application.message && <p className="mt-2.5 line-clamp-2 text-[0.8rem] leading-[1.5] text-[#1E293B]">{application.message}</p>}

                      {(application as any).proposed_rate && (
                        <p className="mt-2 text-[0.8rem] font-medium text-[#15803D]">Proposed rate: {naira((application as any).proposed_rate)}</p>
                      )}

                      {Array.isArray(application.student_profile?.skills) && application.student_profile.skills.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {application.student_profile.skills.slice(0, 3).map((skill: string) => (
                            <span key={skill} className="rounded-full px-2 py-0.5 text-[0.6rem] font-medium text-[#15803D]" style={{ backgroundColor: "#DCFCE7" }}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}

                      {application.status === "pending" && task?.status === "open" && (
                        <div className="mt-3 flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                          <div className="min-w-[120px] flex-1">
                            <AcceptSheet
                              studentName={application.student?.full_name ?? "this student"}
                              budget={task?.budget ?? 0}
                              negotiable={task?.budget_negotiable}
                              taskId={taskId}
                              platformFeePercent={platformFeePercent}
                              onConfirm={(agreedPrice) => accept.mutate({ appId: application.id, studentId: application.student_id, agreedPrice })}
                              pending={accept.isPending}
                            />
                          </div>

                          <MessagePartyLink
                            taskId={taskId}
                            studentId={application.student_id}
                            posterId={task.poster_id}
                            label="Message"
                            variant="outline"
                            className="h-9 border-[#E2E8F0] bg-transparent px-4 text-[0.8rem] font-semibold text-[#16A34A] hover:bg-transparent"
                          />

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 border-[#E2E8F0] bg-transparent px-4 text-[0.8rem] font-semibold text-[#6B7280] hover:bg-transparent"
                            disabled={dismiss.isPending}
                            onClick={(event) => {
                              event.stopPropagation();
                              dismiss.mutate({ appId: application.id, studentId: application.student_id });
                            }}
                          >
                            {dismiss.isPending ? "Dismissing…" : "Dismiss"}
                          </Button>
                        </div>
                      )}

                      {application.status === "accepted" && ["open", "matched"].includes(String(task?.status)) && (
                        <div className="mt-3" onClick={(event) => event.stopPropagation()}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 border-[#E2E8F0] bg-transparent px-4 text-[0.8rem] font-semibold text-[#6B7280] hover:bg-transparent"
                            disabled={removeAccepted.isPending}
                            onClick={() => removeAccepted.mutate({ appId: application.id, studentId: application.student_id })}
                          >
                            {removeAccepted.isPending ? "Removing…" : "Remove accepted student"}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function AcceptSheet({ studentName, budget, negotiable, taskId, platformFeePercent, onConfirm, pending }: {
  studentName: string;
  budget: number;
  negotiable?: boolean;
  taskId: string;
  platformFeePercent: number;
  onConfirm: (agreedPrice?: number) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState("");
  const finalAmount = negotiable && agreedPrice ? Number(agreedPrice) : budget;
  const payoutRate = 1 - platformFeePercent / 100;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="h-9 w-full bg-[#15803D] text-[0.8rem] font-semibold text-white hover:bg-[#156838]" size="sm">Accept</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Hire {studentName}?</SheetTitle>
          <SheetDescription>{negotiable ? "This task has a negotiable price. Enter the agreed amount." : `Budget: ${naira(budget)}`}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {negotiable && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Agreed price (₦)</label>
              <input
                type="number"
                value={agreedPrice}
                onChange={(event) => setAgreedPrice(event.target.value)}
                placeholder="e.g. 15000"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">Make sure you and the student have agreed on this amount before proceeding.</p>
            </div>
          )}

          {finalAmount > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount going to escrow</span>
                <span className="font-semibold text-foreground">{naira(finalAmount)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Student receives (after {platformFeePercent}% fee)</span>
                <span className="font-medium text-success">{naira(finalAmount * payoutRate)}</span>
              </div>
            </div>
          )}

          <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
            By accepting, you agree to pay this amount into escrow. Funds are held safely until you approve the work.
          </p>

          <Button
            className="w-full"
            size="lg"
            disabled={pending || (negotiable && !agreedPrice)}
            onClick={() => {
              onConfirm(negotiable && agreedPrice ? Number(agreedPrice) : undefined);
              setOpen(false);
            }}
          >
            {pending ? "Accepting…" : "Accept & proceed to payment"}
          </Button>

          <button className="w-full text-center text-sm text-muted-foreground" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
