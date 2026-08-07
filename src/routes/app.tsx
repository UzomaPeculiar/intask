import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasSupabaseClientConfig } from "@/integrations/supabase/env";
import { AuthProvider } from "@/hooks/useAuth.tsx";
import { Home, Compass, MessageCircle, User as UserIcon, Bell, Loader2 } from "lucide-react";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hasSupabaseConfig = hasSupabaseClientConfig();
  const loadRuntimePlatformSettings = useServerFn(getRuntimePlatformSettings);

  const { data: me } = useQuery({
    queryKey: ["app-layout-user"],
    enabled: ready,
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["app-layout-profile", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, is_admin")
        .eq("id", me!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: runtimeSettings, isLoading: isLoadingRuntimeSettings } = useQuery({
    queryKey: ["runtime-platform-settings"],
    enabled: ready,
    queryFn: async () => await loadRuntimePlatformSettings(),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!hasSupabaseConfig) return;

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
  }, [hasSupabaseConfig, nav]);

  if (!hasSupabaseConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">App is not configured</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The Supabase environment variables are missing in this deployment, so the app area cannot load yet.
          </p>
          <div className="mt-5">
            <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const maintenanceMode = !!runtimeSettings?.maintenance_mode;
  const isAdmin = !!myProfile?.is_admin;

  if (isLoadingRuntimeSettings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (maintenanceMode && !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-foreground">InTask is under maintenance</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We are making improvements right now. Please check back shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        {!path.startsWith("/app/messages/") && <DesktopSidebar path={path} />}
        <div className={`${path.startsWith("/app/messages/") ? "" : "pb-20 lg:pb-0 lg:pl-72"}`}>
          <Outlet />
        </div>
        {!path.startsWith("/app/messages/") && <BottomNav path={path} />}
      </div>
    </AuthProvider>
  );
}

function DesktopSidebar({ path }: { path: string }) {
  const { data: me } = useQuery({
    queryKey: ["nav-me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["nav-profile-role", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", me!.id).maybeSingle();
      return data;
    },
  });

  const browseLabel = "Browse Tasks";

  const { data: unreadMsgs = 0 } = useQuery({
    queryKey: ["desktop-unread-messages"],
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

  const { data: unreadNotifs = 0 } = useQuery({
    queryKey: ["desktop-unread-notifs"],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", me.user.id)
        .eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
      <div className="border-b border-sidebar-border px-6 py-5">
        <Link to="/app" className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          InTask
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <DesktopNavItem to="/app" label="Dashboard" icon={Home} active={path === "/app" || path === "/app/"} />
        <DesktopNavItem to="/app/browse" label={browseLabel} icon={Compass} active={path.startsWith("/app/browse") || path.startsWith("/app/tasks")} />
        <DesktopNavItem to="/app/messages" label="Messages" icon={MessageCircle} active={path.startsWith("/app/messages")} badge={path.startsWith("/app/messages") ? 0 : unreadMsgs} />
        <DesktopNavItem to="/app/notifications" label="Alerts" icon={Bell} active={path.startsWith("/app/notifications")} badge={unreadNotifs} />
        <DesktopNavItem to="/app/profile/$userId" label="Profile" icon={UserIcon} active={path.startsWith("/app/profile")} params={{ userId: "me" }} />
      </nav>
    </aside>
  );
}

function NotifBell() {
  const { data: unread } = useQuery({
    queryKey: ["unread-count"],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", me.user.id)
        .eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
  return (
    <Link to="/app/notifications" aria-label="Notifications" className="fixed left-3 top-3 z-30 grid size-10 place-items-center rounded-full border border-border/80 bg-card/90 shadow-sm backdrop-blur">
      <Bell className="size-4" />
      {unread ? <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread}</span> : null}
    </Link>
  );
}

function BottomNav({ path }: { path: string }) {
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["nav-me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["nav-profile-role", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", me!.id).maybeSingle();
      return data;
    },
  });

  const browseLabel = "Browse";

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

  const { data: unreadNotifs = 0 } = useQuery({
    queryKey: ["unread-count"],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser();
      if (!me.user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", me.user.id)
        .eq("read", false);
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 backdrop-blur shadow-[0_-12px_30px_-24px_rgba(15,23,42,0.25)] lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        <NavItem to="/app" label="Home" icon={Home} active={path === "/app" || path === "/app/"} badge={0} />
        <NavItem to="/app/browse" label={browseLabel} icon={Compass} active={path.startsWith("/app/browse") || path.startsWith("/app/tasks")} badge={0} />
        <NavItem to="/app/messages" label="Messages" icon={MessageCircle} active={path.startsWith("/app/messages")} badge={path.startsWith("/app/messages") ? 0 : unreadMsgs} />
        <NavItem to="/app/notifications" label="Alerts" icon={Bell} active={path.startsWith("/app/notifications")} badge={unreadNotifs} />
        <li>
          <Link to="/app/profile/$userId" params={{ userId: "me" }} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium">
            <span className="relative">
              <UserIcon className={`size-5 ${path.startsWith("/app/profile") ? "text-accent-foreground" : "text-muted-foreground"}`} />
            </span>
            <span className={path.startsWith("/app/profile") ? "text-accent-foreground" : "text-muted-foreground"}>Profile</span>
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
          <Icon className={`size-5 ${active ? "text-accent-foreground" : "text-muted-foreground"}`} />
          {badge > 0 && (
            <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span className={active ? "text-accent-foreground" : "text-muted-foreground"}>{label}</span>
      </Link>
    </li>
  );
}

function DesktopNavItem({
  to,
  label,
  icon: Icon,
  active,
  badge,
  params,
}: {
  to: string;
  label: string;
  icon: any;
  active: boolean;
  badge?: number;
  params?: Record<string, string>;
}) {
  return (
    <Link
      to={to as any}
      params={params as any}
      className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon className="size-4" />
        {label}
      </span>
      {!!badge && badge > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sidebar-primary px-1 text-[10px] font-semibold text-sidebar-primary-foreground">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}