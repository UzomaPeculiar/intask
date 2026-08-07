import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { releaseEscrow, requestRevision } from "@/lib/paystack.functions";
import { naira } from "@/lib/format";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";
import { getTaskForViewer } from "@/lib/task.functions";

export const Route = createFileRoute("/app/tasks/$taskId/review")({
  head: () => ({ meta: [{ title: "Review delivery — InTask" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const release = useServerFn(releaseEscrow);
  const revise = useServerFn(requestRevision);
  const loadRuntimePlatformSettings = useServerFn(getRuntimePlatformSettings);
  const loadTaskForViewer = useServerFn(getTaskForViewer);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const { data: task, isLoading: loadingTask, error: taskError } = useQuery({
    queryKey: ["task-viewer", taskId],
    queryFn: async () => await loadTaskForViewer({ data: { taskId } }),
  });
  const { data: teamDeliveries } = useQuery({
    queryKey: ["team-deliveries", taskId],
    enabled: !!task?.is_team_task,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_team_members")
        .select("id, delivery_title, delivery_message, delivery_url, delivery_file_url, delivery_file_name, delivery_submitted_at, student:profiles!task_team_members_student_id_fkey(id, full_name)")
        .eq("task_id", taskId)
        .eq("status", "active")
        .order("created_at", { ascending: true });
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

  async function approve() {
    if (!task || !meId) return;
    setBusy(true);
    try {
      const r = await release({ data: { taskId } });
      toast.success(`Released — student gets ${naira(r.payout)}`);
      nav({ to: "/app/tasks/$taskId/rate", params: { taskId } });
    } catch (e: any) {
      toast.error(e.message ?? "Could not release payment");
      setBusy(false);
    }
  }
  async function revision() {
    if (!notes.trim()) { toast.error("Tell the student what to fix"); return; }
    setBusy(true);
    try {
      await revise({ data: { taskId, notes: notes.trim() } });
      toast.success("Revision requested");
      nav({ to: "/app/tasks/$taskId", params: { taskId } });
    } catch (e: any) { toast.error(e.message); setBusy(false); }
  }

  if (loadingTask) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;

  if (taskError || !task) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">Task not found</p>
          <p className="text-sm text-muted-foreground">You may no longer have access to this task.</p>
          <Button variant="outline" onClick={() => nav({ to: "/app" as any })}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => {
          if (window.history.length > 1) window.history.back();
          else nav({ to: "/app/tasks/$taskId", params: { taskId } });
        }} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>
      <div className="space-y-5 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review delivery</h1>
          <p className="mt-1 text-sm text-muted-foreground">{task.title}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          {task.is_team_task ? (
            <div className="space-y-4">
              {(teamDeliveries ?? []).map((delivery: any) => (
                <div key={delivery.id} className="rounded-lg border border-border/80 bg-background/60 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Submitted by</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{delivery.student?.full_name ?? "Student"}</p>
                  {delivery.delivery_submitted_at ? (
                    <>
                      {Boolean(delivery.delivery_title) && (
                        <>
                          <p className="mt-3 text-xs font-medium text-muted-foreground">Work title</p>
                          <p className="mt-1 text-sm font-medium text-foreground">{delivery.delivery_title}</p>
                        </>
                      )}
                      <p className="mt-3 text-xs font-medium text-muted-foreground">Student's message</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{delivery.delivery_message ?? "—"}</p>
                      {delivery.delivery_url && (
                        <a href={delivery.delivery_url} target="_blank" rel="noreferrer" className="it-link-accent mt-3 inline-flex items-center gap-1 text-sm font-medium">
                          Open delivery <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {delivery.delivery_file_url && (
                        <a href={delivery.delivery_file_url} target="_blank" rel="noreferrer" className="it-link-accent mt-2 inline-flex items-center gap-1 text-sm font-medium">
                          Open document{delivery.delivery_file_name ? `: ${delivery.delivery_file_name}` : ""} <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">Submission pending</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              {Boolean((task as any).delivery_title) && (
                <>
                  <p className="text-xs font-medium text-muted-foreground">Work title</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{(task as any).delivery_title}</p>
                  <div className="my-3 h-px bg-border" />
                </>
              )}
              <p className="text-xs font-medium text-muted-foreground">Student's message</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {(task.delivery_message ?? "—").split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part: string, i: number) =>
                  /^(https?:\/\/|www\.)/.test(part) ? (
                    <a key={i} href={/^https?:\/\//.test(part) ? part : `https://${part}`} target="_blank" rel="noreferrer" className="it-link-accent underline underline-offset-2 break-all">
                      {part}
                    </a>
                  ) : part
                )}
              </p>
              {task.delivery_url && (
                <a href={task.delivery_url} target="_blank" rel="noreferrer" className="it-link-accent mt-3 inline-flex items-center gap-1 text-sm font-medium">
                  Open delivery <ExternalLink className="size-3.5" />
                </a>
              )}
              {Boolean((task as any).delivery_file_url) && (
                <a
                  href={(task as any).delivery_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="it-link-accent mt-2 inline-flex items-center gap-1 text-sm font-medium"
                >
                  Open document{Boolean((task as any).delivery_file_name) ? `: ${(task as any).delivery_file_name}` : ""} <ExternalLink className="size-3.5" />
                </a>
              )}
            </>
          )}
        </div>

        <div className="it-note-success rounded-xl border p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-success"><ShieldCheck className="size-4" /> Happy with the work?</p>
          <p className="mt-1 text-xs text-muted-foreground">Releases {naira(Number(task.budget) * payoutRate)} to the student after {platformFeePercent}% platform fee.</p>
          <Button className="mt-3 w-full bg-success text-success-foreground hover:bg-success/90" size="lg" disabled={busy} onClick={approve}>
            Approve & release payment
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Needs changes?</p>
          <Textarea className="mt-2" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What needs to be fixed?" />
          <Button variant="outline" className="mt-3 w-full" disabled={busy} onClick={revision}>Request revision</Button>
        </div>
      </div>
    </div>
  );
}
