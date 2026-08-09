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

        <h1 className="font-['Space_Grotesk',sans-serif] text-[1.5rem] font-bold text-[#1a1e16]">Submit delivery</h1>
        <p className="mt-1 text-[0.85rem] text-[#6a8064]">{task.title}</p>

        {task.revision_notes && (
          <div className="mt-4 rounded-[10px] border border-[#e6c79a] bg-[#f7ecd9] p-3.5">
            <p className="text-[0.85rem] font-semibold text-[#b5771a]">⚠️ Revision requested</p>
            <p className="mt-1 text-[0.8rem] leading-relaxed text-[#8b5f17]">{task.revision_notes}</p>
          </div>
        )}

        <div className="mt-5 rounded-[16px] border border-[#c4deb8] bg-white p-6">
          <div className="mb-[18px] space-y-1.5">
            <Label className="text-[0.8rem] font-semibold text-[#1a1e16]">Title of your work</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Final landing page draft"
              className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] text-[0.85rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]/20"
            />
          </div>

          <div className="mb-[18px] space-y-1.5">
            <Label className="text-[0.8rem] font-semibold text-[#1a1e16]">Message to poster</Label>
            <Textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Summarise what you delivered..."
              className="min-h-[120px] rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] px-3.5 py-3 text-[0.85rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]/20"
            />
          </div>

          <div className="mb-[18px] space-y-1.5">
            <Label className="text-[0.8rem] font-semibold text-[#1a1e16]">Link to file or work <span className="font-normal text-[#9eb79c]">(optional)</span></Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] text-[0.85rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]/20"
            />
          </div>

          <div className="mb-[18px] space-y-1.5">
            <Label className="text-[0.8rem] font-semibold text-[#1a1e16]">Attach document <span className="font-normal text-[#9eb79c]">(optional)</span></Label>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-dashed border-[#c4deb8] bg-[#f9fdf7] px-3.5 py-3 text-[0.85rem] text-[#6a8064] hover:border-[#3dcb6c]">
              <Paperclip className="size-4" />
              <span className="truncate">{documentFile ? documentFile.name : "Choose a document to include with this submission"}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <Button
            className="h-12 w-full rounded-[10px] bg-[#3dcb6c] text-[0.9rem] font-semibold text-white hover:bg-[#34b35d]"
            onClick={submit}
            disabled={busy || !title.trim() || !message.trim()}
          >
            {busy ? "Submitting..." : "Submit for review"}
          </Button>
        </div>
      </div>
    </div>
  );
}
