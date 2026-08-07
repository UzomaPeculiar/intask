import { ReportButton } from "@/components/intask/ReportButton";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { naira, shortDate } from "@/lib/format";
import { ArrowLeft, ShieldCheck, MapPin, Calendar as CalIcon, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { useApplicantCount, applicantLabel } from "@/hooks/useApplicantCount";
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
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  }

  if (!task) return <div className="px-4 pt-10 text-center text-muted-foreground">Task not found.</div>;

  const isOwn = me?.id === task.poster_id;
  const isAssignedStudent = !isOwn && (task.matched_student_id === me?.id || !!teamMembership);
  const isTaskEditable = (task.status === "open" || task.status === "matched") && !["pending", "in_escrow", "released", "refunded"].includes(escrowTx?.status ?? "");
  const reviewedIds = new Set((myTaskReviews ?? []).map((review: any) => review.reviewee_id).filter(Boolean));
  const ownerExpectedReviewees = task.is_team_task
    ? (completedTeamMembers ?? []).map((member: any) => member.student_id).filter(Boolean)
    : [task.matched_student_id].filter(Boolean);
  const ownerCanLeaveReview = task.status === "completed" && ownerExpectedReviewees.some((revieweeId: string) => !reviewedIds.has(revieweeId));
  const studentExpectedReviewees = [task.poster_id].filter(Boolean);
  const studentCanLeaveReview = task.status === "completed" && studentExpectedReviewees.some((revieweeId: string) => !reviewedIds.has(revieweeId));

  const ownerActions = (
    <>
      {task.status !== "open" && !!(task.is_team_task || task.matched_student_id) && (
        <Button
          variant="outline"
          size="lg"
          className="w-full gap-1"
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
          <Button size="lg" variant="outline" className="w-full">Edit task</Button>
        </Link>
      )}
      {task.status === "open" && (
        <Button size="lg" className="w-full" onClick={() => nav({ to: "/app/tasks/$taskId/applicants", params: { taskId: task.id } })}>
          {applicantLabel(liveApplicantCount)}
        </Button>
      )}
      {task.status === "matched" && (
        <Link to="/app/payment/$taskId" params={{ taskId: task.id }}>
          <Button size="lg" className="w-full">Fund escrow to start</Button>
        </Link>
      )}
      {task.status === "in_progress" && <Button disabled size="lg" className="w-full">Student is working — you'll be notified</Button>}
      {task.status === "in_review" && (
        <Link to="/app/tasks/$taskId/review" params={{ taskId: task.id }}>
          <Button size="lg" className="w-full bg-success text-success-foreground hover:bg-success/90">Review delivery</Button>
        </Link>
      )}
      {ownerCanLeaveReview && (
        <Link to="/app/tasks/$taskId/rate" params={{ taskId: task.id }}>
          <Button size="lg" variant="outline" className="w-full">Leave a review</Button>
        </Link>
      )}
    </>
  );

  const assignedStudentActions = (
    <>
      <Button
        variant="outline"
        size="lg"
        className="w-full gap-1"
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
          <Button size="lg" className="w-full">Submit delivery</Button>
        </Link>
      )}
      {task.status === "in_review" && <Button disabled size="lg" className="w-full">Awaiting poster review</Button>}
      {studentCanLeaveReview && (
        <Link to="/app/tasks/$taskId/rate" params={{ taskId: task.id }}>
          <Button size="lg" variant="outline" className="w-full">Leave a review</Button>
        </Link>
      )}
    </>
  );

  const applicantActions = (
    <>
      {canApply ? (
        myApp ? (
          <Button disabled size="lg" className="w-full">Application submitted</Button>
        ) : (
          <ApplySheet taskId={task.id} budget={task.budget} negotiable={task.budget_negotiable} />
        )
      ) : (
        <p className="text-center text-xs text-muted-foreground">Only verified students can apply for tasks.</p>
      )}
      {canApply && (
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{liveApplicantCount} student{liveApplicantCount === 1 ? "" : "s"} applied</p>
      )}
    </>
  );

  return (
    <div className="mx-auto w-full max-w-7xl pb-32 lg:px-8 lg:pb-10">
      <header className="flex items-center gap-2 px-4 pt-4 lg:px-0 lg:pt-6">
        <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm">
          <ArrowLeft className="size-4" />
        </button>
      </header>

      <div className="grid items-start gap-6 px-4 pt-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-0">
        <div className="space-y-5">
          <div className="it-hero-surface rounded-3xl border p-4 shadow-sm lg:p-6">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight lg:text-3xl">{task.title}</h1>
            <p className="mt-2 text-3xl font-semibold text-success">{task.budget_negotiable ? "Open" : naira(task.budget)}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="size-3 text-success" /> Held safely until work is approved
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{task.category}</span>
            {task.deadline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <CalIcon className="size-3" /> {shortDate(task.deadline)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              <MapPin className="size-3" /> {task.work_type === "remote" ? "Remote" : task.work_type === "on_campus" ? "On-campus" : "Remote or on-campus"}
            </span>
          </div>

          <section className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm lg:p-5">
            <h2 className="text-sm font-semibold text-foreground">About this task</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{task.description}</p>
          </section>

          <section className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm lg:p-5">
            <h2 className="text-sm font-semibold text-foreground">Task details</h2>
            <Accordion type="multiple" className="mt-1 w-full">
              {task.skills_needed?.length > 0 && (
                <AccordionItem value="skills" className="border-border/70">
                  <AccordionTrigger className="py-3">Skills needed</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-1.5">
                      {task.skills_needed.map((s: string) => (
                        <span key={s} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">{s}</span>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )}

              <AccordionItem value="poster" className="border-border/70">
                <AccordionTrigger className="py-3">Posted by</AccordionTrigger>
                <AccordionContent>
                  <Link to="/app/profile/$userId" params={{ userId: task.poster_id }} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-background/70 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                    <InitialsAvatar name={task.poster?.full_name} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{task.poster?.full_name}</p>
                      <div className="mt-0.5"><VerifiedBadge role={task.poster?.role} verified={true} /></div>
                    </div>
                  </Link>
                  {task.poster_id !== me?.id && (
                    <div className="mt-3">
                      <ReportButton reportedId={task.poster_id} reportedName={task.poster?.full_name ?? "this poster"} />
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>

          {(task as any)?.is_team_task && <TeamMembersSection taskId={taskId} teamSize={(task as any).team_size} />}

          {(task as any).is_team_task && (
            <div className="it-note-accent rounded-2xl border px-3 py-3 shadow-sm">
              <p className="text-sm font-medium">👥 Team task — {(task as any).team_size} students needed</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Total budget: ₦{task.budget ? Number(task.budget).toLocaleString("en-NG") : "0"} · Each student receives ₦{task.budget ? Math.floor((task.budget * payoutRate) / (task as any).team_size).toLocaleString("en-NG") : "0"} after platform fee
              </p>
            </div>
          )}

          {!isOwn && <div className="pb-6 lg:hidden">{applicantActions}</div>}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Decision panel</p>
              <div className="mt-3 space-y-2">
                {isAssignedStudent ? assignedStudentActions : isOwn ? ownerActions : applicantActions}
              </div>
            </div>

            <Link to="/app/profile/$userId" params={{ userId: task.poster_id }} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-sm transition-colors hover:bg-accent/40">
              <InitialsAvatar name={task.poster?.full_name} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{task.poster?.full_name}</p>
                <p className="text-xs text-muted-foreground">Task poster</p>
              </div>
            </Link>
          </div>
        </aside>
      </div>

      {isAssignedStudent && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-md space-y-2">{assignedStudentActions}</div>
        </div>
      )}

      {isOwn && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto max-w-md space-y-2">{ownerActions}</div>
        </div>
      )}
    </div>
  );
}

function TeamMembersSection({ taskId, teamSize }: { taskId: string; teamSize: number }) {
  const { data: members } = useQuery({
    queryKey: ["team-members", taskId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("task_team_members")
        .select("*, student:profiles!task_team_members_student_id_fkey(id, full_name)")
        .eq("task_id", taskId);
      return data ?? [];
    },
  });

  if (!members || members.length === 0) return null;

  return (
    <div className="px-4 pt-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        Team ({members.length}/{teamSize} filled)
      </h2>
      <div className="space-y-2">
        {members.map((m: any) => (
          <div key={m.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <InitialsAvatar name={m.student?.full_name} size={32} />
              <div>
                <p className="text-sm font-medium text-foreground">{m.student?.full_name}</p>
                <p className="text-xs capitalize text-muted-foreground">{m.role}</p>
              </div>
            </div>
            <span className="text-sm font-medium text-success">
              ₦{Number(m.payment_share).toLocaleString("en-NG")}
            </span>
          </div>
        ))}
      </div>
      {members.length < teamSize && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {teamSize - members.length} more student{teamSize - members.length === 1 ? "" : "s"} needed
        </p>
      )}
    </div>
  );
}

function ApplySheet({ taskId, budget, negotiable }: { taskId: string; budget: number; negotiable: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [proposedRate, setProposedRate] = useState("");

  const apply = useMutation({
    mutationFn: async () => {
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        console.error("[apply] auth error", authErr);
        throw authErr;
      }
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
      if (error) {
        console.error("[apply] insert error", error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast.success("Application submitted successfully");
      qc.invalidateQueries({ queryKey: ["my-app", taskId] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      setOpen(false);
    },
    onError: (e: any) => {
      console.error("[apply] failed", e);
      const msg = String(e?.message ?? "");
      if (msg.toLowerCase().includes("row-level security") || msg.toLowerCase().includes("policy")) {
        toast.error("Application blocked: free plan limit reached or this task is no longer open.");
        return;
      }
      toast.error(msg || "Something went wrong submitting your application. Please try again.");
    },
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="lg" className="w-full">Apply for this task</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Apply — {negotiable ? "Open to negotiation" : naira(budget)}</SheetTitle>
          <SheetDescription>Why are you the right person for this?</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <Textarea rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Be specific — mention relevant projects or experience." maxLength={1000} />
          {negotiable && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Your proposed rate (₦)</label>
              <Input
                type="number"
                value={proposedRate}
                onChange={(e) => setProposedRate(e.target.value)}
                placeholder="e.g. 15000"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">The poster will see your proposed rate alongside your application.</p>
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Your profile will be attached automatically.
          </div>
          <Button className="w-full" size="lg" disabled={!msg.trim() || apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending ? "Submitting…" : "Submit application"}
          </Button>
          <button className="w-full text-center text-sm text-muted-foreground" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
