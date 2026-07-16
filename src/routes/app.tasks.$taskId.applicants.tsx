import { MessagePartyLink } from "@/components/intask/MessagePartyLink";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { EmptyState } from "@/components/intask/EmptyState";
import { naira } from "@/lib/format";
import { ArrowLeft, Inbox, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/app/tasks/$taskId/applicants")({
  head: () => ({ meta: [{ title: "Applicants — InTask" }] }),
  component: ApplicantsPage,
});

function ApplicantsPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("id", taskId).single()).data,
  });

  const isOwner = !!me?.id && !!task?.poster_id && me.id === task.poster_id;

  const { data: apps, isLoading } = useQuery({
    queryKey: ["applicants", taskId],
    enabled: isOwner,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("applications")
        .select("*, student:profiles!applications_student_id_fkey(id, full_name, role)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const apps = data ?? [];
      const ids = apps.map((a) => a.student_id);
      const sp: Record<string, any> = {};
      if (ids.length) {
        const { data: sps } = await supabase.from("student_profiles").select("user_id, department, portfolio, rating_average, rating_count, skills, tasks_completed, university, verified, year_of_study, verification_method, created_at, updated_at").in("user_id", ids);
        for (const s of sps ?? []) sp[s.user_id] = s;
      }
      return apps.map((a) => ({ ...a, student_profile: sp[a.student_id] ?? null }));
    },
  });

  const accept = useMutation({
    mutationFn: async ({ appId, studentId, agreedPrice }: { appId: string; studentId: string; agreedPrice?: number }) => {
      const { error: ae } = await supabase.from("applications").update({ status: "accepted" }).eq("id", appId);
      if (ae) throw ae;
      const taskUpdate: any = { status: "matched", matched_student_id: studentId };
      if (agreedPrice) taskUpdate.budget = agreedPrice;
      const { error: te } = await supabase.from("tasks").update(taskUpdate).eq("id", taskId);
      if (te) throw te;
    },
    onSuccess: () => {
      toast.success("Student accepted. Fund escrow next.");
      qc.invalidateQueries({ queryKey: ["applicants", taskId] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["my-tasks"] });
      nav({ to: "/app/payment/$taskId", params: { taskId } });
    },
    onError: (e: any) => toast.error(e.message ?? "Couldn't accept"),
  });

  const dismiss = useMutation({
    mutationFn: async ({ appId, studentId }: { appId: string; studentId: string }) => {
      const { error } = await supabase
        .from("applications")
        .update({ status: "rejected" })
        .eq("id", appId);
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
  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>

      {task && me && !isOwner && (
        <div className="px-4 pt-10 text-center text-sm text-muted-foreground">
          You don't have access to this task's applicants.
        </div>
      )}

      {isOwner && (<>


      {task && (
        <div className="px-4 pt-4">
          <h1 className="text-xl font-semibold tracking-tight">{task.title}</h1>
          <p className="mt-1 text-lg font-semibold text-success">{task.budget_negotiable ? "Negotiable" : naira(task.budget)}</p>
        </div>
      )}

      <div className="px-4 pt-6">
        <h2 className="text-sm font-semibold text-foreground">{apps?.length ?? 0} applicant{apps?.length === 1 ? "" : "s"}</h2>
        {isLoading && <div className="mt-4 h-32 animate-pulse rounded-xl border border-border bg-card" />}
        {!isLoading && (apps?.length ?? 0) === 0 && (
          <div className="mt-4"><EmptyState icon={Inbox} title="No applicants yet" description="Students are being notified. Check back soon." /></div>
        )}

        <ul className="mt-4 space-y-3">
          {apps?.map((a) => (
            <li key={a.id} className="rounded-xl border border-border bg-card p-4 shadow-card cursor-pointer hover:border-primary/50 transition-colors" onClick={() => nav({ to: "/app/profile/$userId", params: { userId: a.student_id } })}>
              <div className="flex items-start gap-3">
                <InitialsAvatar name={a.student?.full_name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-foreground">{a.student?.full_name}</p>
                    <VerifiedBadge role={a.student?.role} verified={a.student_profile?.verified} />
                  </div>
                  {a.student_profile && (
                    <p className="truncate text-xs text-muted-foreground">
                      {a.student_profile.university} {a.student_profile.year_of_study ? `· ${a.student_profile.year_of_study}` : ""}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Star className="size-3 fill-warning text-warning" />{Number(a.student_profile?.rating_average ?? 0).toFixed(1)}</span>
                    <span>{a.student_profile?.tasks_completed ?? 0} tasks done</span>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{a.status}</span>
              </div>

              {a.message && (
                <p className="mt-3 line-clamp-3 text-sm text-foreground/90">{a.message}</p>
              )}
              {(a as any).proposed_rate && (
                <p className="mt-2 text-sm font-medium text-success">
                  Proposed rate: {naira((a as any).proposed_rate)}
                </p>
              )}   
              {a.student_profile?.skills?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {a.student_profile.skills.slice(0, 3).map((s: string) => (
                    <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {a.status === "pending" && task?.status === "open" ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <AcceptSheet
                        studentName={a.student?.full_name ?? "this student"}
                        budget={task?.budget ?? 0}
                        negotiable={task?.budget_negotiable}
                        taskId={taskId}
                        onConfirm={(agreedPrice) => accept.mutate({ appId: a.id, studentId: a.student_id, agreedPrice })}
                        pending={accept.isPending}
                      />
                    </div>
                  ) : (
                    <Button disabled className="w-full" size="sm">{a.status}</Button>
                  )}
                </div>
                {a.status === "pending" && task?.status === "open" && task?.budget_negotiable && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <MessagePartyLink
                      taskId={taskId}
                      studentId={a.student_id}
                      posterId={task.poster_id}
                      label="Discuss price with student"
                      variant="outline"
                      className="w-full"
                    />
                    </div>
                )}
                {a.status === "pending" && task?.status === "open" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-destructive"
                    disabled={dismiss.isPending}
                    onClick={(e) => { e.stopPropagation(); dismiss.mutate({ appId: a.id, studentId: a.student_id }); }}
                  >
                    {dismiss.isPending ? "Dismissing…" : "Dismiss applicant"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
      </>)}
    </div>
  );
}

function AcceptSheet({ studentName, budget, negotiable, taskId, onConfirm, pending }: { 
  studentName: string; 
  budget: number; 
  negotiable?: boolean;
  taskId: string;
  onConfirm: (agreedPrice?: number) => void; 
  pending: boolean; 
}) {
  const [open, setOpen] = useState(false);
  const [agreedPrice, setAgreedPrice] = useState("");
  const finalAmount = negotiable && agreedPrice ? Number(agreedPrice) : budget;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button className="w-full bg-success text-success-foreground hover:bg-success/90" size="sm">Accept</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Hire {studentName}?</SheetTitle>
          <SheetDescription>
            {negotiable ? "This task has a negotiable price. Enter the agreed amount." : `Budget: ${naira(budget)}`}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          {negotiable && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Agreed price (₦)</label>
              <input
                type="number"
                value={agreedPrice}
                onChange={(e) => setAgreedPrice(e.target.value)}
                placeholder="e.g. 15000"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-xs text-muted-foreground">
                Make sure you and the student have agreed on this amount before proceeding.
              </p>
            </div>
          )}
          {finalAmount > 0 && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount going to escrow</span>
                <span className="font-semibold text-foreground">{naira(finalAmount)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">Student receives (after 8% fee)</span>
                <span className="font-medium text-success">{naira(finalAmount * 0.92)}</span>
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
            onClick={() => { onConfirm(negotiable && agreedPrice ? Number(agreedPrice) : undefined); setOpen(false); }}
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
