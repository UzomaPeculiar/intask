import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ensureMvpFeatureEnabled } from "@/lib/mvp-features";
import { addProjectRoomFile, getProjectRoomData, postProjectRoomMessage } from "@/lib/task.functions";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Paperclip, Users, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rooms/$roomId")({
  beforeLoad: () => ensureMvpFeatureEnabled("rooms"),
  head: () => ({ meta: [{ title: "Project Room — InTask" }] }),
  component: ProjectRoomPage,
});

function ProjectRoomPage() {
  const { roomId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const loadProjectRoomData = useServerFn(getProjectRoomData);
  const sendProjectRoomMessage = useServerFn(postProjectRoomMessage);
  const saveProjectRoomFile = useServerFn(addProjectRoomFile);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "members" | "files">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: roomState, refetch: refetchRoomState, isLoading, error } = useQuery({
    queryKey: ["project-room-data", roomId],
    queryFn: async () => await loadProjectRoomData({ data: { roomId } }),
  });

  const room = roomState?.room as any;
  const members = roomState?.members as any[] | undefined;
  const messages = roomState?.messages as any[] | undefined;
  const files = roomState?.files as any[] | undefined;
  const isPoster = !!me?.id && room?.task?.poster_id === me.id;
  const canSubmitTeamDelivery = Boolean(
    room?.task?.is_team_task &&
    room?.task?.id &&
    room?.task?.status === "in_progress" &&
    me?.id &&
    !isPoster,
  );

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_room_messages", filter: `room_id=eq.${roomId}` }, () => {
        refetchRoomState();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, refetchRoomState]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!message.trim() || !me) return;
    setSending(true);
    const error = await sendProjectRoomMessage({ data: { roomId, content: message.trim() } }).catch((e: any) => e);
    setSending(false);
    if (error instanceof Error) { toast.error(error.message || "Could not send message"); return; }
    setMessage("");
    refetchRoomState();
  }

  async function uploadFile(file: File) {
    if (!me) return;
    const fileExt = file.name.split(".").pop();
    const filePath = `rooms/${roomId}/${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error("File upload failed"); return; }
    const { data: urlData } = await supabase.storage
      .from("project-files")
      .createSignedUrl(filePath, 60 * 60 * 24 * 30);
    const fileUrl = urlData?.signedUrl ?? "";
    const saveError = await saveProjectRoomFile({
      data: {
        roomId,
        fileName: file.name,
        fileUrl,
        fileType: file.type || null,
      },
    }).catch((e: any) => e);
    if (saveError instanceof Error) {
      toast.error(saveError.message || "Could not save file");
      return;
    }
    toast.success("File uploaded");
    await qc.invalidateQueries({ queryKey: ["project-room-data", roomId] });
    await refetchRoomState();
  }

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Loading project room...</div>;
  }

  if (error || !room) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">Project room not available</p>
          <p className="text-sm text-muted-foreground">This room could not be opened right now.</p>
          <Button variant="outline" onClick={() => nav({ to: "/app" as any })}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] [font-family:'Inter',sans-serif]">
      <div className="mx-auto h-screen max-w-[1280px] lg:grid lg:grid-cols-[1fr_300px]">
        <main className="flex min-h-0 flex-col bg-[#FFFFFF]">
          <header className="flex items-center gap-3 border-b border-[#E2E8F0] bg-white px-6 py-3.5">
            <button
              onClick={() => window.history.back()}
              className="grid size-8 place-items-center rounded-full border border-[#E2E8F0] bg-white"
              aria-label="Back"
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <InitialsAvatar name={room?.name ?? "Project Room"} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9rem] font-semibold text-[#1E293B]">{room?.name ?? "Project Room"}</p>
              <p className="truncate text-[0.7rem] text-[#6B7280]">{room?.task?.title}</p>
            </div>
            <div className="flex items-center gap-1 text-[0.72rem] text-[#6B7280]">
              <Users className="size-3.5" />
              <span>{members?.length ?? 0}</span>
            </div>
          </header>

          <div className="flex border-b border-[#E2E8F0] bg-white">
            {(["chat", "members", "files"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-1 border-b-2 px-2 py-2.5 text-center text-[0.8rem] font-semibold capitalize transition-colors ${
                  activeTab === t ? "border-[#16A34A] text-[#16A34A]" : "border-transparent text-[#6B7280]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {canSubmitTeamDelivery && (
            <div className="border-b border-[#E2E8F0] bg-white px-6 py-3">
              <Button
                className="w-full"
                onClick={() => nav({ to: "/app/tasks/$taskId/deliver", params: { taskId: room.task.id } })}
              >
                Submit team delivery
              </Button>
            </div>
          )}

          {activeTab === "chat" && (
            <>
              <div className="flex-1 space-y-3 overflow-y-auto px-6 py-5">
                {(!messages || messages.length === 0) && (
                  <div className="py-8 text-center text-[0.7rem] text-[#94A3B8]">Project room created</div>
                )}

                {messages?.map((m: any) => {
                  const isMe = m.sender_id === me?.id;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[72%] rounded-[14px] px-3.5 py-2.5 text-[0.82rem] leading-relaxed ${
                          isMe
                            ? "rounded-br-[4px] bg-[#16A34A] text-white"
                            : "rounded-bl-[4px] border border-[#E2E8F0] bg-white text-[#1E293B]"
                        }`}
                      >
                        <p className={`mb-0.5 text-[0.65rem] font-semibold ${isMe ? "text-white/70" : "text-[#6B7280]"}`}>
                          {isMe ? "You" : m.sender?.full_name}
                        </p>
                        <p>{m.content}</p>
                        <p className={`mt-1 text-[0.6rem] ${isMe ? "text-white/60" : "text-[#94A3B8]"}`}>
                          {new Date(m.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="flex items-center gap-2.5 border-t border-[#E2E8F0] bg-white px-6 py-3.5">
                <label className="grid size-10 cursor-pointer place-items-center rounded-[10px] border border-[#E2E8F0] bg-white">
                  <Paperclip className="size-4 text-[#6B7280]" />
                  <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
                </label>
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Type a message..."
                  className="h-10 flex-1 rounded-[10px] border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 text-[0.82rem] outline-none focus:border-[#16A34A]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!message.trim() || sending}
                  className="grid size-10 place-items-center rounded-[10px] bg-[#16A34A] text-white disabled:opacity-50"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </>
          )}

          {activeTab === "members" && (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-2">
                {members?.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between rounded-[10px] border border-[#E2E8F0] bg-white p-3">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={m.user?.full_name} size={34} />
                      <div>
                        <p className="text-[0.82rem] font-semibold text-[#1E293B]">{m.user?.full_name}</p>
                        <p className="text-[0.68rem] capitalize text-[#6B7280]">{m.role}</p>
                      </div>
                    </div>
                    {m.role === "lead" && (
                      <span className="rounded-full border border-[#E2E8F0] bg-[#F1F3F5] px-2 py-0.5 text-[0.62rem] font-semibold text-[#16A34A]">
                        Lead
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {(!files || files.length === 0) && (
                <div className="py-10 text-center">
                  <FileText className="mx-auto mb-2 size-8 text-[#94A3B8]" />
                  <p className="text-sm text-[#6B7280]">No files uploaded yet</p>
                  <p className="mt-1 text-xs text-[#94A3B8]">Use the paperclip icon in chat to share files</p>
                </div>
              )}
              <div className="space-y-2">
                {files?.map((f: any) => (
                  <a
                    key={f.id}
                    href={f.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 rounded-[10px] border border-[#E2E8F0] bg-white p-3 transition-colors hover:bg-[#F1F3F5]"
                  >
                    <div className="grid size-9 place-items-center rounded-[8px] border border-[#E2E8F0] bg-[#F1F3F5]">
                      <FileText className="size-4 text-[#6B7280]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.8rem] font-medium text-[#1E293B]">{f.file_name}</p>
                      <p className="text-[0.65rem] text-[#94A3B8]">Uploaded by {f.uploader?.full_name}</p>
                    </div>
                    <CheckCircle2 className="size-4 text-[#16A34A]" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </main>

        <aside className="hidden overflow-y-auto border-l border-[#E2E8F0] bg-white p-5 lg:block">
          <div className="mb-4 rounded-[12px] border border-[#E2E8F0] bg-[#F1F3F5] p-3.5">
            <p className="text-[0.8rem] font-semibold text-[#1E293B]">{room?.task?.title}</p>
            <p className="mt-1 font-['Space_Grotesk',sans-serif] text-[1rem] font-bold text-[#15803D]">
              ₦{Number(room?.task?.budget_max ?? room?.task?.budget_min ?? 0).toLocaleString("en-NG")}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[0.7rem] text-[#6B7280]">
              <span className="inline-block size-1.5 rounded-full bg-[#16A34A]" />
              {room?.task?.status === "in_progress" ? "In progress" : room?.task?.status?.replaceAll("_", " ")}
            </p>
          </div>

          <p className="mb-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#94A3B8]">Members</p>
          <div className="mb-5 space-y-1">
            {members?.map((m: any) => {
              const isCurrent = m.user_id === me?.id;
              return (
                <div key={`side-${m.id}`} className="flex items-center gap-2 rounded-[10px] p-2.5 hover:bg-[#F1F3F5]">
                  <InitialsAvatar name={m.user?.full_name} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-[0.8rem] font-semibold text-[#1E293B]">
                      {m.user?.full_name}
                      {isCurrent ? <span className="ml-1 text-[0.6rem] font-semibold text-[#16A34A]">you</span> : null}
                    </p>
                    <p className="text-[0.65rem] capitalize text-[#6B7280]">{m.role}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mb-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#94A3B8]">Files</p>
          <div className="space-y-1.5">
            {files?.slice(0, 4).map((f: any) => (
              <a
                key={`side-file-${f.id}`}
                href={f.file_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] p-2.5 hover:bg-[#F1F3F5]"
              >
                <FileText className="size-4 text-[#6B7280]" />
                <div className="min-w-0">
                  <p className="truncate text-[0.78rem] font-medium text-[#1E293B]">{f.file_name}</p>
                  <p className="text-[0.62rem] text-[#94A3B8]">Shared file</p>
                </div>
              </a>
            ))}
            {(!files || files.length === 0) && (
              <p className="text-[0.7rem] text-[#94A3B8]">No files shared yet.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

