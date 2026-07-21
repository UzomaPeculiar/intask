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

export const Route = createFileRoute("/app/tasks/$taskId/review")({
  head: () => ({ meta: [{ title: "Review delivery — InTask" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const release = useServerFn(releaseEscrow);
  const revise = useServerFn(requestRevision);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null));
  }, []);

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("id", taskId).single()).data,
  });

  async function approve() {
    if (!task || !meId) return;
    setBusy(true);
    try {
      const revieweeId = meId === task.poster_id ? task.matched_student_id : task.poster_id;
      if (!revieweeId) {
        throw new Error("Nothing to release to yet");
      }

      const r = await release({ data: { taskId } });
      await (supabase as any).rpc("credit_wallet", {
        p_user_id: revieweeId,
        p_amount: Number(task.budget) * 0.92,
        p_description: `Payment for "${task.title}"`,
        p_reference: taskId,
      });
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

  if (!task) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => nav({ to: "/app/tasks/$taskId", params: { taskId } })} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>
      <div className="space-y-5 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Review delivery</h1>
          <p className="mt-1 text-sm text-muted-foreground">{task.title}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-xs font-medium text-muted-foreground">Student's message</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {(task.delivery_message ?? "—").split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((part: string, i: number) =>
              /^(https?:\/\/|www\.)/.test(part) ? (
                <a key={i} href={/^https?:\/\//.test(part) ? part : `https://${part}`} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 break-all">
                  {part}
                </a>
              ) : part
            )}
          </p>
          {task.delivery_url && (
            <a href={task.delivery_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Open delivery <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>

        <div className="rounded-xl border border-success/30 bg-success/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-success"><ShieldCheck className="size-4" /> Happy with the work?</p>
          <p className="mt-1 text-xs text-muted-foreground">Releases {naira(Number(task.budget))} to the student (minus 8% platform fee).</p>
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
