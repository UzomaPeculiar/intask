import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/messages/$conversationId")({
  head: () => ({ meta: [{ title: "Chat — InTask" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { conversationId } = Route.useParams();
  const nav = useNavigate();
  const [meId, setMeId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [other, setOther] = useState<any>(null);
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMeId(u.user?.id ?? null);
      const { data: convo } = await supabase
        .from("conversations")
        .select("*, task:tasks(id,title), student:profiles!conversations_student_id_fkey(id,full_name,role), poster:profiles!conversations_poster_id_fkey(id,full_name,role)")
        .eq("id", conversationId).single();
      console.log("Convo data:", convo);
      console.log("User:", u.user?.id);
      if (convo && u.user) {
        setOther(convo.student_id === u.user.id ? convo.poster : convo.student);
        setTask(convo.task);
      }
      const { data: msgs } = await supabase
        .from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
      setMessages(msgs ?? []);
      setLoading(false);
      if (u.user) {
        await supabase.from("messages").update({ read: true })
          .eq("conversation_id", conversationId).eq("read", false).neq("sender_id", u.user.id);
      }
    })();

    const ch = supabase
      .channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          setMessages((m) => (m.some((x) => x.id === (payload.new as any).id) ? m : [...m, payload.new as any]));
          const { data: u } = await supabase.auth.getUser();
          const msg = payload.new as any;
          if (u.user && msg.sender_id !== u.user.id) {
            await supabase.from("messages").update({ read: true }).eq("id", msg.id);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  async function send() {
    if (!draft.trim() || !meId) return;
    const text = draft.trim();
    setDraft("");
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId, sender_id: meId, content: text,
    });
    if (error) console.error(error);
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => nav({ to: "/app/messages" })} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <InitialsAvatar name={other?.full_name} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{other?.full_name ?? "Chat"}</p>
          {task?.title && <p className="truncate text-xs text-muted-foreground">{task.title}</p>}
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4 pb-32">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">Say hello to get the work started.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" />
          <Button size="icon" onClick={send} disabled={!draft.trim()}><Send className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
