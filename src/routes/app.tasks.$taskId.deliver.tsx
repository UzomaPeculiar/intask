import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { getProjectRoomForTask, getTaskForDelivery, submitTaskDelivery } from "@/lib/task.functions";

export const Route = createFileRoute("/app/tasks/$taskId/deliver")({
  head: () => ({ meta: [{ title: "Submit delivery — InTask" }] }),
  component: DeliverPage,
});

function DeliverPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const submitDelivery = useServerFn(submitTaskDelivery);
  const loadProjectRoomForTask = useServerFn(getProjectRoomForTask);
  const loadTaskForDelivery = useServerFn(getTaskForDelivery);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: task, isLoading: loadingTask, error: taskError } = useQuery({
    queryKey: ["task-for-delivery", taskId],
    queryFn: async () => await loadTaskForDelivery({ data: { taskId } }),
  });

  async function submit() {
    if (!title.trim() || !message.trim()) return;
    setBusy(true);
    try {
      let uploadedFileUrl: string | undefined;
      let uploadedFileName: string | undefined;

      if (documentFile) {
        const fileExt = documentFile.name.split(".").pop();
        const filePath = `deliveries/${taskId}/${Date.now()}-${documentFile.name.replace(/\s+/g, "-")}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("project-files")
          .upload(filePath, documentFile, { upsert: true });
        if (uploadError) {
          throw new Error(uploadError.message || "Could not upload document");
        }
        const { data: urlData, error: signedUrlError } = await supabase.storage
          .from("project-files")
          .createSignedUrl(filePath, 60 * 60 * 24 * 30);
        if (signedUrlError) {
          throw new Error(signedUrlError.message || "Could not prepare document link");
        }
        uploadedFileUrl = urlData?.signedUrl ?? undefined;
        uploadedFileName = documentFile.name;
      }

      await submitDelivery({ data: {
        taskId,
        title: title.trim(),
        message: message.trim(),
        url: url.trim() || undefined,
        fileUrl: uploadedFileUrl,
        fileName: uploadedFileName,
      } });
      toast.success("Delivery submitted");
      if (task?.is_team_task) {
        const room = await loadProjectRoomForTask({ data: { taskId } }).catch(() => null);
        const roomId = (room as any)?.roomId ?? (room as any)?.room_id;
        if (roomId) {
          nav({ to: "/app/rooms/$roomId", params: { roomId }, replace: true });
          return;
        }
      }
      nav({ to: "/app/tasks/$taskId", params: { taskId }, replace: true });
    } catch (error: any) {
      toast.error(error.message ?? "Could not submit delivery");
      setBusy(false);
      return;
    }
  }

  if (loadingTask) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;

  if (taskError || !task) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">Could not open delivery page</p>
          <p className="text-sm text-muted-foreground">You may no longer have access to submit for this task.</p>
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
          <Label>Title of your work</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Final landing page draft" />
        </div>
        <div className="space-y-1.5">
          <Label>Message to poster</Label>
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Summarise what you delivered." />
        </div>
        <div className="space-y-1.5">
          <Label>Link to file or work (optional)</Label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/…" />
        </div>
        <div className="space-y-1.5">
          <Label>Attach document (optional)</Label>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent/40">
            <Paperclip className="size-4" />
            <span className="truncate">{documentFile ? documentFile.name : "Choose a document to include with this submission"}</span>
            <input
              type="file"
              className="hidden"
              onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        <Button className="w-full" size="lg" onClick={submit} disabled={busy || !title.trim() || !message.trim()}>
          {busy ? "Submitting…" : "Submit for review"}
        </Button>
      </div>
    </div>
  );
}
