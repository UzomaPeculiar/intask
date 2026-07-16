import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tasks/$taskId/deliver")({
  head: () => ({ meta: [{ title: "Submit delivery — InTask" }] }),
  component: DeliverPage,
});

function DeliverPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("id", taskId).single()).data,
  });

  async function submit() {
    if (!message.trim()) return;
    setBusy(true);
    const { error } = await supabase
      .from("tasks")
      .update({
        status: "in_review",
        delivery_message: message.trim(),
        delivery_url: url.trim() || null,
        delivery_submitted_at: new Date().toISOString(),
      })
      .eq("id", taskId);
    if (error) { toast.error(error.message); setBusy(false); return; }
    if (task?.poster_id) {
      const { data: { user } } = await supabase.auth.getUser();
      let studentName = "A student";
      if (user) {
        const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
        if (prof?.full_name) studentName = prof.full_name;
      }
      await supabase.from("notifications").insert({
        user_id: task.poster_id,
        type: "delivery_submitted",
        message: `${studentName} has submitted work for ${task.title}. Review it now.`,
        link: `/app/tasks/${taskId}/review`,
      });
    }
    toast.success("Delivery submitted");
    nav({ to: "/app/tasks/$taskId", params: { taskId } });
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
          <h1 className="text-2xl font-semibold tracking-tight">Submit delivery</h1>
          <p className="mt-1 text-sm text-muted-foreground">{task.title}</p>
        </div>
        {task.revision_notes && (
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm">
            <p className="font-medium text-warning">Revision requested</p>
            <p className="mt-1 text-foreground/90">{task.revision_notes}</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Message to poster</Label>
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Summarise what you delivered." />
        </div>
        <div className="space-y-1.5">
          <Label>Link to file or work (optional)</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
        </div>
        <Button className="w-full" size="lg" onClick={submit} disabled={busy || !message.trim()}>
          {busy ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </div>
  );
}
