import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { EmptyState } from "@/components/intask/EmptyState";
import { ArrowLeft, GraduationCap, Clock } from "lucide-react";

export const Route = createFileRoute("/app/mentorship/bookings")({
  head: () => ({ meta: [{ title: "My Bookings — InTask" }] }),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["my-bookings", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mentorship_bookings")
        .select("*, mentor:profiles!mentorship_bookings_mentor_id_fkey(id, full_name), service:mentorship_services(id, title, price, duration_minutes, category)")
        .eq("mentee_id", me!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const statusColor: Record<string, string> = {
    pending: "bg-warning/15 text-warning",
    confirmed: "bg-success/15 text-success",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
  };

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">My bookings</h1>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        )}

        {!isLoading && (bookings?.length ?? 0) === 0 && (
          <EmptyState
            icon={GraduationCap}
            title="No bookings yet"
            description="Browse mentors and book your first session."
            action={<Link to="/app/mentorship"><button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Browse mentors</button></Link>}
          />
        )}

        {bookings?.map((b: any) => (
          <div key={b.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <InitialsAvatar name={b.mentor?.full_name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{b.mentor?.full_name}</p>
                <p className="text-sm text-muted-foreground">{b.service?.title}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusColor[b.status] ?? "bg-muted text-muted-foreground"}`}>
                    {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="size-3" /> {b.service?.duration_minutes} min
                  </span>
                  <span className="text-xs font-medium text-success">₦{Number(b.service?.price ?? 0).toLocaleString("en-NG")}</span>
                </div>
                {b.scheduled_at && (
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(b.scheduled_at).toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                )}
                {b.notes && <p className="mt-1 text-xs text-muted-foreground italic">"{b.notes}"</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}