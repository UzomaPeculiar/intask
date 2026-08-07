import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { getModerationRules } from "@/lib/admin.functions";
import { findModerationMatches } from "@/lib/moderation";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
  const [pendingWarning, setPendingWarning] = useState<{ text: string; matches: string[] } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const loadModerationRules = useServerFn(getModerationRules);
  const { data: moderationRules } = useQuery({
    queryKey: ["moderation-rules"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const res = await loadModerationRules();
      return res.words ?? [];
    },
  });

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setMeId(u.user?.id ?? null);
      const { data: convo } = await supabase
        .from("conversations")
        .select("*, task:tasks(id,title), student:profiles!conversations_student_id_fkey(id,full_name,role), poster:profiles!conversations_poster_id_fkey(id,full_name,role)")
        .eq("id", conversationId).single();
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

  const messagesWithMatches = useMemo(() => {
    const rules = moderationRules ?? [];
    return messages.map((m) => ({
      ...m,
      moderationMatches: findModerationMatches(String(m.content ?? ""), rules),
    }));
  }, [messages, moderationRules]);

  const draftMatches = useMemo(() => {
    const rules = moderationRules ?? [];
    return findModerationMatches(draft.trim(), rules);
  }, [draft, moderationRules]);

  async function insertMessage(text: string) {
    if (!meId) return;
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: meId,
      content: text,
    });
    if (error) {
      toast.error(error.message ?? "Could not send message");
      throw error;
    }
  }

  async function send() {
    if (!draft.trim() || !meId) return;
    const text = draft.trim();

    let rules = moderationRules ?? [];
    if (rules.length === 0) {
      try {
        const fresh = await loadModerationRules();
        rules = fresh.words ?? [];
      } catch {
        rules = [];
      }
    }

    const matches = findModerationMatches(text, rules);
    if (matches.length > 0) {
      setPendingWarning({ text, matches });
      return;
    }

    setDraft("");
    await insertMessage(text);
  }

  async function sendAfterWarning() {
    if (!pendingWarning) return;
    setDraft("");
    const text = pendingWarning.text;
    setPendingWarning(null);
    await insertMessage(text);
  }

  if (loading) return <div className="grid min-h-screen place-items-center text-muted-foreground"><Loader2 className="size-5 animate-spin" /></div>;

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => {
          if (window.history.length > 1) window.history.back();
          else nav({ to: "/app/messages" });
        }} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
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
        {messagesWithMatches.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`space-y-1 ${mine ? "flex flex-col items-end" : "flex flex-col items-start"}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {m.content}
              </div>
              {m.moderationMatches.length > 0 && (
                <div className="max-w-[78%] rounded-md border border-warning/30 bg-warning/15 px-2.5 py-1.5 text-xs text-warning">
                  ⚠️ This message mentions {m.moderationMatches.join(", ")}. Keep payments and communication on InTask for financial protection.
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-1.5">
          {draftMatches.length > 0 && (
            <div className="rounded-md border border-warning/30 bg-warning/15 px-2.5 py-1.5 text-xs text-warning">
              ⚠️ This draft mentions {draftMatches.join(", ")}. Keep payments and communication on InTask for financial protection.
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message…" />
            <Button size="icon" onClick={send} disabled={!draft.trim()}><Send className="size-4" /></Button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingWarning} onOpenChange={(open) => !open && setPendingWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Payment-safety warning</AlertDialogTitle>
            <AlertDialogDescription>
              This message mentions: {pendingWarning?.matches.join(", ")}. For your financial protection, keep payments and communication inside InTask. Escrow and dispute protection only cover on-platform transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={sendAfterWarning}>Send anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
