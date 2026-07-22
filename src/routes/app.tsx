import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/useAuth.tsx";
import { Home, Compass, MessageCircle, User as UserIcon, Bell, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) nav({ to: "/auth/login" });
      else setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      if (!sess) nav({ to: "/auth/login" });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [nav]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <AuthProvider>
      <div className={`min-h-screen bg-background ${path.startsWith("/app/messages/") ? "" : "pb-20"}`}>
        {!path.startsWith("/app/messages/") && <NotifBell />}
        <Outlet />
        {!path.startsWith("/app/messages/") && <BottomNav path={path} />}
      </div>
    </AuthProvider>
  );
}

function NotifBell() {
  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("*", { count: "exact", head: true }).eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
  return (
    <Link to="/app/notifications" aria-label="Notifications" className="fixed right-3 top-3 z-30 grid size-10 place-items-center rounded-full border border-border/80 bg-card/90 shadow-sm backdrop-blur">
      <Bell className="size-4" />
      {unread ? <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread}</span> : null}
    </Link>
  );
}

function BottomNav({ path }: { path: string }) {
  const qc = useQueryClient();
  const { data: unreadMsgs = 0 } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return 0;
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("read", false)
        .neq("sender_id", me.user.id);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("nav-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["unread-messages"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        qc.invalidateQueries({ queryKey: ["unread-messages"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  useEffect(() => {
    if (path.startsWith("/app/messages")) {
      qc.invalidateQueries({ queryKey: ["unread-messages"] });
    }
  }, [path, qc]);

  const items = [
    { to: "/app", label: "Home", icon: Home, match: (p: string) => p === "/app" || p === "/app/", badge: 0 },
    { to: "/app/browse", label: "Browse", icon: Compass, match: (p: string) => p.startsWith("/app/browse") || p.startsWith("/app/tasks"), badge: 0 },
    { to: "/app/messages", label: "Messages", icon: MessageCircle, match: (p: string) => p.startsWith("/app/messages"), badge: path.startsWith("/app/messages") ? 0 : unreadMsgs },
    { to: "/app/profile/$userId" as any, label: "Profile", icon: UserIcon, match: (p: string) => p.startsWith("/app/profile"), badge: 0 },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 backdrop-blur shadow-[0_-12px_30px_-24px_rgba(15,23,42,0.25)]">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        <NavItem to="/app" label="Home" icon={Home} active={path === "/app" || path === "/app/"} badge={0} />
        <NavItem to="/app/browse" label="Browse" icon={Compass} active={path.startsWith("/app/browse") || path.startsWith("/app/tasks") || path.startsWith("/app/mentorship")} badge={0} />
        <NavItem to="/app/messages" label="Messages" icon={MessageCircle} active={path.startsWith("/app/messages")} badge={path.startsWith("/app/messages") ? 0 : unreadMsgs} />
        <li>
          <Link to="/app/profile/$userId" params={{ userId: "me" }} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium">
            <span className="relative">
              <UserIcon className={`size-5 ${path.startsWith("/app/profile") ? "text-primary" : "text-muted-foreground"}`} />
            </span>
            <span className={path.startsWith("/app/profile") ? "text-primary" : "text-muted-foreground"}>Profile</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function NavItem({ to, label, icon: Icon, active, badge }: { to: string; label: string; icon: any; active: boolean; badge: number }) {
  return (
    <li>
      <Link to={to as any} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium">
        <span className="relative">
          <Icon className={`size-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
          {badge > 0 && (
            <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span className={active ? "text-primary" : "text-muted-foreground"}>{label}</span>
      </Link>
    </li>
  );
}