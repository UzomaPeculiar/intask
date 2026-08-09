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
    <div className="min-h-screen bg-[#eff8ea] text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="mx-auto w-full max-w-[640px] px-6 pb-10 pt-7 sm:px-10">
        <button
          onClick={() => {
            if (window.history.length > 1) window.history.back();
            else nav({ to: "/app/tasks/$taskId", params: { taskId } });
          }}
          aria-label="Back"
          className="mb-4 grid size-9 place-items-center rounded-full border border-[#c4deb8] bg-white"
        >
          <ArrowLeft className="size-4" />
        </button>

        <h1 className="font-['Space_Grotesk',sans-serif] text-[1.5rem] font-bold text-[#1a1e16]">Review delivery</h1>
        <p className="mt-1 text-[0.85rem] text-[#6a8064]">{task.title}</p>

        <div className="mt-5 rounded-[14px] border border-[#c4deb8] bg-white p-5">
          {task.is_team_task ? (
            <div className="space-y-4">
              {(teamDeliveries ?? []).map((delivery: any) => (
                <div key={delivery.id} className="rounded-[12px] border border-[#dbead4] bg-[#fbfef9] p-4">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Submitted by</p>
                  <p className="mt-1.5 font-['Space_Grotesk',sans-serif] text-[0.95rem] font-semibold text-[#1a1e16]">{delivery.student?.full_name ?? "Student"}</p>
                  {delivery.delivery_submitted_at ? (
                    <>
                      {Boolean(delivery.delivery_title) && (
                        <>
                          <div className="mt-3 h-px bg-[#e4efe0]" />
                          <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Work title</p>
                          <p className="mt-1.5 font-['Space_Grotesk',sans-serif] text-[0.95rem] font-semibold text-[#1a1e16]">{delivery.delivery_title}</p>
                        </>
                      )}
                      <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Student's message</p>
                      <p className="mt-1.5 whitespace-pre-wrap text-[0.85rem] leading-[1.6] text-[#1a1e16]">{delivery.delivery_message ?? "—"}</p>
                      {delivery.delivery_url && (
                        <a href={delivery.delivery_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[0.85rem] font-semibold text-[#3dcb6c]">
                          Open delivery <ExternalLink className="size-3.5" />
                        </a>
                      )}
                      {delivery.delivery_file_url && (
                        <a href={delivery.delivery_file_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[0.85rem] font-semibold text-[#3dcb6c]">
                          Open document{delivery.delivery_file_name ? `: ${delivery.delivery_file_name}` : ""} <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-[0.82rem] text-[#6a8064]">Submission pending</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <>
              {Boolean((task as any).delivery_title) && (
                <>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Work title</p>
                  <p className="mt-1.5 font-['Space_Grotesk',sans-serif] text-[1rem] font-semibold text-[#1a1e16]">{(task as any).delivery_title}</p>
                  <div className="my-3.5 h-px bg-[#e4efe0]" />
                </>
              )}
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Student's message</p>
              <p className="mt-1.5 whitespace-pre-wrap text-[0.85rem] leading-[1.6] text-[#1a1e16]">
                {(task.delivery_message ?? "—").split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part: string, i: number) =>
                  /^(https?:\/\/|www\.)/.test(part) ? (
                    <a key={i} href={/^https?:\/\//.test(part) ? part : `https://${part}`} target="_blank" rel="noreferrer" className="break-all text-[#3dcb6c] underline underline-offset-2">
                      {part}
                    </a>
                  ) : part
                )}
              </p>
              {task.delivery_url && (
                <a href={task.delivery_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[0.85rem] font-semibold text-[#3dcb6c]">
                  Open delivery <ExternalLink className="size-3.5" />
                </a>
              )}
              {Boolean((task as any).delivery_file_url) && (
                <a
                  href={(task as any).delivery_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-[0.85rem] font-semibold text-[#3dcb6c]"
                >
                  Open document{Boolean((task as any).delivery_file_name) ? `: ${(task as any).delivery_file_name}` : ""} <ExternalLink className="size-3.5" />
                </a>
              )}
            </>
          )}
        </div>

        <div className="mt-4 rounded-[14px] border border-[#c4deb8] bg-[#f0f8ec] p-5">
          <p className="flex items-center gap-1.5 text-[0.9rem] font-semibold text-[#1a7a42]"><ShieldCheck className="size-4" /> Happy with the work?</p>
          <p className="mt-1 text-[0.8rem] text-[#6a8064]">Releases {naira(Number(task.budget) * payoutRate)} to the student after {platformFeePercent}% platform fee.</p>
          <Button
            className="mt-3.5 h-12 w-full rounded-[10px] bg-[#1a7a42] text-[0.9rem] font-semibold text-white hover:bg-[#166838]"
            disabled={busy}
            onClick={approve}
          >
            Approve & release payment
          </Button>
        </div>

        <div className="mt-4 rounded-[14px] border border-[#c4deb8] bg-white p-5">
          <p className="text-[0.9rem] font-semibold text-[#1a1e16]">Needs changes?</p>
          <Textarea
            className="mt-2.5 min-h-[80px] rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] px-3.5 py-3 text-[0.85rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]/20"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What needs to be fixed?"
          />
          <Button
            variant="outline"
            className="mt-2.5 h-11 w-full rounded-[10px] border-[#c4deb8] bg-white text-[0.85rem] font-medium text-[#1a1e16] hover:bg-[#f7fbf4]"
            disabled={busy}
            onClick={revision}
          >
            Request revision
          </Button>
        </div>
      </div>
    </div>
  );
}
