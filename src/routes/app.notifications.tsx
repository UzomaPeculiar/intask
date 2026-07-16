import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/intask/EmptyState";
import { Bell, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — InTask" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  useEffect(() => {
    (async () => {
      await supabase.from("notifications").update({ read: true }).eq("read", false);
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    })();
  }, [qc]);

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>
      <div className="px-4 pt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        {isLoading ? (
          <div className="mt-6 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : !data?.length ? (
          <div className="mt-6"><EmptyState icon={Bell} title="No notifications" description="You're all caught up." /></div>
        ) : (
          <ul className="mt-5 space-y-2">
            {data.map((n) => {
              const Body = (
                <div className={`rounded-xl border p-3 ${n.read ? "border-border bg-card" : "border-primary/40 bg-primary/5"}`}>
                  <p className="text-sm">{n.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link to={n.link}>{Body}</Link> : Body}</li>;
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
