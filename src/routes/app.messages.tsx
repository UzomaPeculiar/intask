import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/intask/EmptyState";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { ConversationListSkeleton, ChatMessagesSkeleton } from "@/components/intask/Skeletons";

export const Route = createFileRoute("/app/messages")({
  head: () => ({ meta: [{ title: "Messages — InTask" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    conversationId: typeof search.conversationId === "string" ? search.conversationId : undefined,
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const nav = useNavigate({ from: "/app/messages" });
  const search = Route.useSearch();
  const qc = useQueryClient();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["conversations", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      if (!me?.id) return [];
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("*, task:tasks(id,title), student:profiles!conversations_student_id_fkey(id,full_name,avatar_url), poster:profiles!conversations_poster_id_fkey(id,full_name,avatar_url)")
        .or(`student_id.eq.${me.id},poster_id.eq.${me.id}`)
        .order("created_at", { ascending: false });

      if (!error) {
        return (convos ?? []).map((c: any) => ({ ...c, other: c.student_id === me.id ? c.poster : c.student }));
      }

      // Fallback path: keep conversations visible even if embed joins fail.
      const { data: baseConvos, error: baseError } = await supabase
        .from("conversations")
        .select("id, task_id, student_id, poster_id, created_at")
        .or(`student_id.eq.${me.id},poster_id.eq.${me.id}`)
        .order("created_at", { ascending: false });

      if (baseError) throw baseError;

      const rows = baseConvos ?? [];
      const otherIds = rows.map((row: any) => (row.student_id === me.id ? row.poster_id : row.student_id));
      const taskIds = rows.map((row: any) => row.task_id);

      const [profilesRes, tasksRes] = await Promise.all([
        otherIds.length
          ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", otherIds)
          : Promise.resolve({ data: [] as any[] } as any),
        taskIds.length
          ? supabase.from("tasks").select("id, title").in("id", taskIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);

      const profileById = new Map<string, any>((profilesRes.data ?? []).map((profile: any) => [profile.id, profile]));
      const taskById = new Map<string, any>((tasksRes.data ?? []).map((task: any) => [task.id, task]));

      return rows.map((row: any) => {
        const otherId = row.student_id === me.id ? row.poster_id : row.student_id;
        return {
          ...row,
          task: taskById.get(row.task_id) ?? null,
          student: null,
          poster: null,
          other: profileById.get(otherId) ?? { id: otherId, full_name: "Conversation", avatar_url: null },
        };
      });
    },
    refetchInterval: 15_000,
  });

  const { data: requestedConversation, isLoading: requestedConversationLoading } = useQuery({
    queryKey: ["conversation-by-id", search.conversationId, me?.id],
    enabled: !!search.conversationId && !!me?.id,
    queryFn: async () => {
      if (!search.conversationId || !me?.id) return null;
      const { data, error } = await supabase
        .from("conversations")
        .select("*, task:tasks(id,title), student:profiles!conversations_student_id_fkey(id,full_name,avatar_url), poster:profiles!conversations_poster_id_fkey(id,full_name,avatar_url)")
        .eq("id", search.conversationId)
        .maybeSingle();

      if (!error && data) {
        return { ...data, other: data.student_id === me.id ? data.poster : data.student };
      }

      const { data: base, error: baseError } = await supabase
        .from("conversations")
        .select("id, task_id, student_id, poster_id, created_at")
        .eq("id", search.conversationId)
        .maybeSingle();

      if (baseError) throw baseError;
      if (!base) return null;

      const otherId = base.student_id === me.id ? base.poster_id : base.student_id;
      const [profileRes, taskRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").eq("id", otherId).maybeSingle(),
        supabase.from("tasks").select("id, title").eq("id", base.task_id).maybeSingle(),
      ]);

      return {
        ...base,
        task: taskRes.data ?? null,
        student: null,
        poster: null,
        other: profileRes.data ?? { id: otherId, full_name: "Conversation", avatar_url: null },
      };
    },
  });

  const mergedConversations = useMemo(() => {
    if (!requestedConversation) return conversations;
    return conversations.some((conversation: any) => conversation.id === requestedConversation.id)
      ? conversations
      : [requestedConversation, ...conversations];
  }, [conversations, requestedConversation]);

  useEffect(() => {
    const requestedId = search.conversationId;
    if (requestedId && mergedConversations.some((conversation: any) => conversation.id === requestedId)) {
      setSelectedConversationId(requestedId);
      return;
    }

    if (!selectedConversationId && mergedConversations.length > 0) {
      const fallback = mergedConversations[0].id;
      setSelectedConversationId(fallback);
      nav({ to: "/app/messages", search: { conversationId: fallback }, replace: true });
    }
  }, [mergedConversations, selectedConversationId, search.conversationId, nav]);

  useEffect(() => {
    if (!me?.id) return;

    let cancelled = false;

    const markUnreadMessagesAsRead = async () => {
      const { data: unreadMessages, error } = await supabase
        .from("messages")
        .select("id")
        .eq("read", false)
        .neq("sender_id", me.id);

      if (cancelled || error || !(unreadMessages?.length ?? 0)) return;

      const unreadIds = unreadMessages.map((message: any) => message.id);
      const { error: updateError } = await supabase.from("messages").update({ read: true } as any).in("id", unreadIds);
      if (!cancelled && !updateError) {
        qc.invalidateQueries({ queryKey: ["desktop-unread-messages"] });
        qc.invalidateQueries({ queryKey: ["unread-messages"] });
        qc.invalidateQueries({ queryKey: ["conversations", me.id] });
      }
    };

    void markUnreadMessagesAsRead();

    return () => {
      cancelled = true;
    };
  }, [me?.id, qc]);

  const selectedConversation = useMemo(
    () => mergedConversations.find((conversation: any) => conversation.id === selectedConversationId) ?? null,
    [mergedConversations, selectedConversationId],
  );

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", selectedConversationId],
    enabled: !!selectedConversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversationId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!selectedConversationId || !me?.id) return;

    const channel = supabase
      .channel(`messages-tab:${selectedConversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedConversationId}` },
        async (payload) => {
          qc.setQueryData(["messages", selectedConversationId], (current: any[] | undefined) => {
            const items = current ?? [];
            const incoming = payload.new as any;
            return items.some((message) => message.id === incoming.id) ? items : [...items, incoming];
          });
          qc.invalidateQueries({ queryKey: ["conversations", me.id] });

          if ((payload.new as any).sender_id !== me.id) {
            await supabase.from("messages").update({ read: true }).eq("id", (payload.new as any).id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, me?.id, qc]);

  useEffect(() => {
    if (!me?.id) return;

    const channel = supabase
      .channel(`conversations-live:${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", me.id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", me.id] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["conversations", me.id] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [me?.id, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedConversationId]);

  const grouped = useMemo(() => {
    const today: any[] = [];
    const earlier: any[] = [];
    for (const convo of mergedConversations ?? []) {
      const stamp = convo.created_at;
      const t = stamp ? new Date(stamp).getTime() : 0;
      const isToday = Number.isFinite(t) && Date.now() - t < 24 * 60 * 60 * 1000;
      (isToday ? today : earlier).push(convo);
    }
    return { today, earlier };
  }, [mergedConversations]);

  const listLoading = isLoading || (!!search.conversationId && requestedConversationLoading && mergedConversations.length === 0);

  async function send() {
    if (!draft.trim() || !selectedConversationId || !me?.id) return;
    const text = draft.trim();
    setDraft("");

    const { data: inserted, error } = await supabase.from("messages").insert({
      conversation_id: selectedConversationId,
      sender_id: me.id,
      content: text,
    }).select("*").single();

    if (error) {
      setDraft(text);
      return;
    }

    if (inserted) {
      qc.setQueryData(["messages", selectedConversationId], (current: any[] | undefined) => {
        const items = current ?? [];
        return items.some((message) => message.id === inserted.id) ? items : [...items, inserted];
      });
      qc.invalidateQueries({ queryKey: ["conversations", me.id] });
    }
  }

  function selectConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    nav({ to: "/app/messages", search: { conversationId }, replace: true });
  }

  function shortWhen(dateString?: string | null) {
    if (!dateString) return "";
    const now = Date.now();
    const then = new Date(dateString).getTime();
    if (!Number.isFinite(then)) return "";
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div className="min-h-screen bg-[#eff8ea] text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="mx-auto grid h-[720px] w-full max-w-[1280px] grid-cols-[360px_1fr] overflow-hidden">
        <aside className="flex min-h-0 flex-col border-r border-[#c4deb8] bg-white">
          <div className="border-b border-[#e4efe0] px-6 py-5">
            <h1 className="font-['Space_Grotesk',sans-serif] text-[1.2rem] font-bold text-[#1a1e16]">Messages</h1>
            <p className="mt-0.5 text-[0.75rem] text-[#6a8064]">Pick a conversation to continue</p>
          </div>

          {listLoading ? (
            <ConversationListSkeleton />
          ) : mergedConversations.length === 0 ? (
            <div className="p-4">
              <EmptyState icon={MessageCircle} title="No conversations yet" description="Once a payment is funded, your chat with the other party opens here." />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              <div className="px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Today</div>
              <div className="space-y-1">
                {grouped.today.length > 0 ? grouped.today.map((conversation: any) => {
                  const active = conversation.id === selectedConversationId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`flex w-full items-center gap-3 rounded-[12px] p-3 text-left transition-colors ${active ? "bg-[#d8f5e4]" : "hover:bg-[#f4fbf0]"}`}
                    >
                      <InitialsAvatar name={conversation.other?.full_name} avatarUrl={conversation.other?.avatar_url} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.85rem] font-semibold text-[#1a1e16]">{conversation.other?.full_name ?? "Chat"}</p>
                        <p className="truncate text-[0.7rem] text-[#6a8064]">{conversation.task?.title ?? "Task chat"}</p>
                      </div>
                      <div className="shrink-0 text-right text-[0.6rem] text-[#9eb79c]">{shortWhen(conversation.created_at)}</div>
                    </button>
                  );
                }) : <div className="px-3 py-3 text-sm text-[#6a8064]">No recent messages.</div>}
              </div>

              <div className="px-3 pb-1 pt-4 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Earlier</div>
              <div className="space-y-1">
                {grouped.earlier.length > 0 ? grouped.earlier.map((conversation: any) => {
                  const active = conversation.id === selectedConversationId;
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className={`flex w-full items-center gap-3 rounded-[12px] p-3 text-left transition-colors ${active ? "bg-[#d8f5e4]" : "hover:bg-[#f4fbf0]"}`}
                    >
                      <InitialsAvatar name={conversation.other?.full_name} avatarUrl={conversation.other?.avatar_url} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.85rem] font-semibold text-[#1a1e16]">{conversation.other?.full_name ?? "Chat"}</p>
                        <p className="truncate text-[0.7rem] text-[#6a8064]">{conversation.task?.title ?? "Task chat"}</p>
                      </div>
                      <div className="shrink-0 text-right text-[0.6rem] text-[#9eb79c]">{shortWhen(conversation.created_at)}</div>
                    </button>
                  );
                }) : <div className="px-3 py-3 text-sm text-[#6a8064]">No older conversations.</div>}
              </div>
            </div>
          )}
        </aside>

        <section className="flex min-h-0 flex-col bg-[#f9fdf7]">
          {selectedConversation ? (
            <>
              <div className="flex items-center gap-3 border-b border-[#e4efe0] bg-white px-6 py-[14px]">
                <InitialsAvatar name={selectedConversation.other?.full_name} avatarUrl={selectedConversation.other?.avatar_url} size={36} />
                <div className="min-w-0">
                  <p className="truncate text-[0.9rem] font-semibold text-[#1a1e16]">{selectedConversation.other?.full_name ?? "Chat"}</p>
                  <p className="truncate text-[0.7rem] text-[#6a8064]">{selectedConversation.task?.title ?? "Task chat"}</p>
                </div>
              </div>

              <div className="flex flex-1 min-h-0 flex-col">
                <div className="flex-1 space-y-3 overflow-y-auto px-6 py-6">
                  {messagesLoading ? (
                    <ChatMessagesSkeleton />
                  ) : messages.length === 0 ? (
                    <div className="pt-10">
                      <EmptyState icon={Send} title="Say hello to get the work started." description="Messages will appear here once the conversation begins." />
                    </div>
                  ) : (
                    messages.map((message: any) => {
                      const mine = message.sender_id === me?.id;
                      return (
                        <div key={message.id} className={`space-y-1 ${mine ? "flex flex-col items-end" : "flex flex-col items-start"}`}>
                          <div className={`max-w-[70%] rounded-[14px] px-[14px] py-[10px] text-[0.82rem] leading-[1.5] ${mine ? "rounded-br-[4px] bg-[#3dcb6c] text-white" : "rounded-bl-[4px] border border-[#e4efe0] bg-white text-[#1a1e16]"}`}>
                            {message.content}
                            <div className={`mt-1 text-[0.6rem] ${mine ? "text-white/60" : "text-[#9eb79c]"}`}>
                              {message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <div className="border-t border-[#e4efe0] bg-white px-6 py-[14px]">
                  <div className="flex items-center gap-[10px]">
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && send()}
                      placeholder="Type a message..."
                      className="h-10 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] px-[14px] text-[0.82rem]"
                    />
                    <Button size="icon" onClick={send} disabled={!draft.trim()} className="size-10 rounded-[10px] bg-[#3dcb6c] text-white hover:bg-[#35b860]">
                      <Send className="size-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center px-6">
              <EmptyState icon={MessageCircle} title="Pick a conversation" description="Choose a conversation on the left to start chatting." />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
