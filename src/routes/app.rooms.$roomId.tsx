import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, Paperclip, Users, CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/rooms/$roomId")({
  head: () => ({ meta: [{ title: "Project Room — InTask" }] }),
  component: ProjectRoomPage,
});

function ProjectRoomPage() {
  const { roomId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "members" | "files">("chat");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: room } = useQuery({
    queryKey: ["project-room", roomId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_rooms")
        .select("*, task:tasks(id, title, status, budget)")
        .eq("id", roomId)
        .single();
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["room-members", roomId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_room_members")
        .select("*, user:profiles!project_room_members_user_id_fkey(id, full_name, role)")
        .eq("room_id", roomId);
      return data ?? [];
    },
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["room-messages", roomId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_room_messages")
        .select("*, sender:profiles!project_room_messages_sender_id_fkey(id, full_name)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: files } = useQuery({
    queryKey: ["room-files", roomId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("project_room_files")
        .select("*, uploader:profiles!project_room_files_uploaded_by_fkey(full_name)")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_room_messages", filter: `room_id=eq.${roomId}` }, () => {
        refetchMessages();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!message.trim() || !me) return;
    setSending(true);
    const { error } = await (supabase as any)
      .from("project_room_messages")
      .insert({ room_id: roomId, sender_id: me.id, content: message.trim() });
    setSending(false);
    if (error) { toast.error("Could not send message"); return; }
    setMessage("");
    refetchMessages();
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
    await (supabase as any).from("project_room_files").insert({
      room_id: roomId,
      uploaded_by: me.id,
      file_name: file.name,
      file_url: urlData?.signedUrl ?? "",
      file_type: file.type,
    });
    toast.success("File uploaded");
    qc.invalidateQueries({ queryKey: ["room-files", roomId] });
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border bg-card/95 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <p className="font-semibold text-foreground text-sm">{room?.name ?? "Project Room"}</p>
            <p className="text-xs text-muted-foreground">{room?.task?.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3.5" />
          <span>{members?.length ?? 0}</span>
        </div>
      </header>

      <div className="flex border-b border-border shrink-0">
        {(["chat", "members", "files"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize ${activeTab === t ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {activeTab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages?.map((m: any) => {
              const isMe = m.sender_id === me?.id;
              return (
                <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                  {!isMe && <InitialsAvatar name={m.sender?.full_name} size={28} />}
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 shadow-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                    {!isMe && <p className="text-[10px] font-medium mb-1 opacity-70">{m.sender?.full_name}</p>}
                    <p className="text-sm">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${isMe ? "opacity-70 text-right" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
            {(!messages || messages.length === 0) && (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-4 py-3 border-t border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <label className="grid size-9 place-items-center rounded-full border border-border cursor-pointer shrink-0 hover:bg-accent">
                <Paperclip className="size-4 text-muted-foreground" />
                <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
              </label>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={sendMessage}
                disabled={!message.trim() || sending}
                className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50 shrink-0"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === "members" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {members?.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl border border-border/80 bg-card/90 p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <InitialsAvatar name={m.user?.full_name} size={36} />
                <div>
                  <p className="text-sm font-medium text-foreground">{m.user?.full_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
              </div>
              {m.role === "lead" && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Lead</span>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "files" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {(!files || files.length === 0) && (
            <div className="text-center py-10">
              <FileText className="size-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No files uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-1">Use the paperclip icon in chat to share files</p>
            </div>
          )}
          {files?.map((f: any) => (
            <a key={f.id} href={f.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md">
              <div className="grid size-10 place-items-center rounded-lg bg-primary/10 shrink-0">
                <FileText className="size-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{f.file_name}</p>
                <p className="text-xs text-muted-foreground">Uploaded by {f.uploader?.full_name}</p>
              </div>
              <CheckCircle2 className="size-4 text-success shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}