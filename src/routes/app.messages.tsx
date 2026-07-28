import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/intask/EmptyState";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/app/messages")({
  head: () => ({ meta: [{ title: "Messages — InTask" }] }),
  component: MessagesLayout,
});

function MessagesLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isConversation = path.startsWith("/app/messages/");

  if (isConversation) {
    return <Outlet />;
  }

  return <MessagesPage />;
}

function MessagesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return [];
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("*, task:tasks(id,title), student:profiles!conversations_student_id_fkey(id,full_name,role), poster:profiles!conversations_poster_id_fkey(id,full_name,role)")
        .or(`student_id.eq.${me.user.id},poster_id.eq.${me.user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (convos ?? []).map((c: any) => ({ ...c, other: c.student_id === me.user!.id ? c.poster : c.student }));
    },
  });

  const grouped = useMemo(() => {
    const today: any[] = [];
    const earlier: any[] = [];
    const now = new Date();
    for (const convo of data ?? []) {
      const created = new Date(convo.created_at);
      const isToday = created.toDateString() === now.toDateString();
      (isToday ? today : earlier).push(convo);
    }
    return { today, earlier };
  }, [data]);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-5">
      <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 shadow-sm">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Inbox</p>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-xs text-muted-foreground">Pick a conversation to continue where you left off.</p>
      </div>
      {isLoading ? (
        <div className="mt-6 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : !data || data.length === 0 ? (
        <div className="mt-6"><EmptyState icon={MessageCircle} title="No conversations yet" description="Once a payment is funded, your chat with the other party opens here." /></div>
      ) : (
        <div className="mt-5 space-y-5">
          {grouped.today.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</h2>
              <ul className="space-y-2">
                {grouped.today.map((c) => (
                  <li key={c.id}>
                    <Link to="/app/messages/$conversationId" params={{ conversationId: c.id }} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <InitialsAvatar name={c.other?.full_name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.other?.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.task?.title}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {grouped.earlier.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earlier</h2>
              <ul className="space-y-2">
                {grouped.earlier.map((c) => (
                  <li key={c.id}>
                    <Link to="/app/messages/$conversationId" params={{ conversationId: c.id }} className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/90 p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <InitialsAvatar name={c.other?.full_name} size={44} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.other?.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.task?.title}</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
