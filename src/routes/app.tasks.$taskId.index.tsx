import { ReportButton } from "@/components/intask/ReportButton";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { naira, shortDate } from "@/lib/format";
import { ArrowLeft, ShieldCheck, MapPin, Calendar as CalIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApplicantCount, applicantLabel } from "@/hooks/useApplicantCount";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/tasks/$taskId/")({
  head: () => ({ meta: [{ title: "Task — InTask" }] }),
  component: TaskDetail,
});

function TaskDetail() {
  const { taskId } = Route.useParams();
    useEffect(() => {
    if (!taskId) return;
    (supabase as any).rpc("increment_task_views", { task_uuid: taskId });
  }, [taskId]);
  const nav = useNavigate();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, poster:profiles!tasks_poster_id_fkey(id, full_name, role)")
        .eq("id", taskId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: myApp } = useQuery({
    queryKey: ["my-app", taskId, me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase.from("applications").select("*").eq("task_id", taskId).eq("student_id", me!.id).maybeSingle();
      return data;
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-role", me?.id],
    enabled: !!me?.id,
    queryFn: async () => (await supabase.from("profiles").select("role").eq("id", me!.id).maybeSingle()).data,
  });
  const myRole = (myProfile?.role ?? "student") as "student" | "alumni" | "company" | "individual";
  const canApply = myRole === "student" || myRole === "alumni";

  const liveApplicantCount = useApplicantCount(task?.id, task?.applicants_count ?? 0);

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;
  }
  if (!task) return <div className="px-4 pt-10 text-center text-muted-foreground">Task not found.</div>;

  const isOwn = me?.id === task.poster_id;

  return (
    <div className="mx-auto max-w-md pb-32">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>

      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight">{task.title}</h1>
        <p className="mt-2 text-3xl font-semibold text-success">{task.budget_negotiable ? "Open" : naira(task.budget)}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3 text-success" /> Held safely until work is approved
        </p>

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

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">About this task</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{task.description}</p>
        </section>

        {task.skills_needed?.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-foreground">Skills needed</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {task.skills_needed.map((s: string) => (
                <span key={s} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">{s}</span>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">Posted by</h2>
          <Link to="/app/profile/$userId" params={{ userId: task.poster_id }} className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
            <InitialsAvatar name={task.poster?.full_name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{task.poster?.full_name}</p>
              <div className="mt-0.5"><VerifiedBadge role={task.poster?.role} verified={true} /></div>
            </div>
          </Link>
        </section>
        {task.poster_id !== me?.id && (
          <div className="mt-2">
            <ReportButton 
              reportedId={task.poster_id} 
              reportedName={task.poster?.full_name ?? "this poster"} 
            />
          </div>
        )}
      </div>

      {/* Action bar */}
      {!isOwn && task.matched_student_id === me?.id && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-md space-y-2">
            {task.status === "in_progress" && (
              <Link to="/app/tasks/$taskId/deliver" params={{ taskId: task.id }}>
                <Button size="lg" className="w-full">Submit delivery</Button>
              </Link>
            )}
            {task.status === "in_review" && <Button disabled size="lg" className="w-full">Awaiting poster review</Button>}
            {task.status === "completed" && (
              <Link to="/app/tasks/$taskId/rate" params={{ taskId: task.id }}>
                <Button size="lg" variant="outline" className="w-full">Leave a review</Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {!isOwn && task.matched_student_id !== me?.id && task.status === "open" && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-md">
            {canApply ? (
              myApp ? (
                <Button disabled size="lg" className="w-full">Application submitted</Button>
              ) : (
                <ApplySheet taskId={task.id} budget={task.budget} negotiable={task.budget_negotiable}/>
              )
            ) : (
              <p className="text-center text-xs text-muted-foreground">Only verified students can apply for tasks.</p>
            )}
            {canApply && (
              <p className="mt-1.5 text-center text-[11px] text-muted-foreground">{liveApplicantCount} student{liveApplicantCount === 1 ? "" : "s"} applied</p>
            )}
          </div>
        </div>
      )}

      {isOwn && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-md space-y-2">
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
            {task.status === "completed" && (
              <Link to="/app/tasks/$taskId/rate" params={{ taskId: task.id }}>
                <Button size="lg" variant="outline" className="w-full">Leave a review</Button>
              </Link>
            )}
          </div>
        </div>
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
      if (authErr) { console.error("[apply] auth error", authErr); throw authErr; }
      if (!user) throw new Error("Not signed in");
      const { data, error } = await supabase.from("applications").insert({
        task_id: taskId, 
        student_id: user.id, 
        message: msg.trim(), 
        status: "pending",
        proposed_rate: (proposedRate ? Number(proposedRate) : null) as never,
      }).select().single();
      if (error) { console.error("[apply] insert error", error); throw error; }
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
      toast.error("Something went wrong submitting your application. Please try again.");
    },
  });


  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><Button size="lg" className="w-full">Apply for this task</Button></SheetTrigger>
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
          <button className="w-full text-center text-sm text-muted-foreground" onClick={() => setOpen(false)}>Cancel</button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
