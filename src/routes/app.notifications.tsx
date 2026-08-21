import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/intask/EmptyState";
import { Bell, ArrowLeft } from "lucide-react";
import { NotificationsSkeleton } from "@/components/intask/Skeletons";

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
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", auth.user.id)
        .eq("read", false);
      qc.invalidateQueries({ queryKey: ["unread-count"] });
      qc.invalidateQueries({ queryKey: ["desktop-unread-notifs"] });
    })();
  }, [qc]);

  const grouped = useMemo(() => {
    const today: any[] = [];
    const earlier: any[] = [];
    const now = new Date();
    for (const item of data ?? []) {
      const created = new Date(item.created_at);
      const isToday = created.toDateString() === now.toDateString();
      (isToday ? today : earlier).push(item);
    }
    return { today, earlier };
  }, [data]);

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm">
          <ArrowLeft className="size-4" />
        </button>
      </header>
      <div className="px-4 pt-4">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 shadow-sm">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Updates</p>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        </div>
        {isLoading ? (
          <NotificationsSkeleton />
        ) : !data?.length ? (
          <div className="mt-6"><EmptyState icon={Bell} title="No notifications" description="You're all caught up." /></div>
        ) : (
          <div className="mt-5 space-y-5">
            {grouped.today.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today</h2>
                <ul className="space-y-2">
                  {grouped.today.map((n) => {
                    const Body = (
                      <div className={`rounded-2xl border p-3 shadow-sm transition-all ${n.read ? "border-border/80 bg-card/90" : "border-primary/40 bg-primary/5"}`}>
                        <p className="text-sm">{n.message}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    );
                    return <li key={n.id}>{n.link ? <Link to={n.link}>{Body}</Link> : Body}</li>;
                  })}
                </ul>
              </section>
            )}

            {grouped.earlier.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earlier</h2>
                <ul className="space-y-2">
                  {grouped.earlier.map((n) => {
                    const Body = (
                      <div className={`rounded-2xl border p-3 shadow-sm transition-all ${n.read ? "border-border/80 bg-card/90" : "border-primary/40 bg-primary/5"}`}>
                        <p className="text-sm">{n.message}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
                      </div>
                    );
                    return <li key={n.id}>{n.link ? <Link to={n.link}>{Body}</Link> : Body}</li>;
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
