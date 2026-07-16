import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

  return (
    <div className="mx-auto max-w-md px-4 pt-5">
      <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
      {isLoading ? (
        <div className="mt-6 space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : !data || data.length === 0 ? (
        <div className="mt-6"><EmptyState icon={MessageCircle} title="No conversations yet" description="Once a payment is funded, your chat with the other party opens here." /></div>
      ) : (
        <ul className="mt-5 space-y-2">
          {data.map((c) => (
            <li key={c.id}>
              <Link to="/app/messages/$conversationId" params={{ conversationId: c.id }} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
                <InitialsAvatar name={c.other?.full_name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.other?.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.task?.title}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
