import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Clock, Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/mentorship/$serviceId")({
  head: () => ({ meta: [{ title: "Mentorship Session — InTask" }] }),
  component: MentorshipDetailPage,
});

function MentorshipDetailPage() {
  const { serviceId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: service } = useQuery({
    queryKey: ["mentorship-service", serviceId],
    queryFn: async () => {
      const { data: serviceData } = await (supabase as any)
        .from("mentorship_services")
        .select("*, mentor:profiles!mentorship_services_mentor_id_fkey(id, full_name, role)")
        .eq("id", serviceId)
        .single();
      if (!serviceData) return null;

      const { data: mentorProfile } = await supabase
        .from("student_profiles")
        .select("user_id, university, year_of_study, skills, rating_average, rating_count, tasks_completed, verified")
        .eq("user_id", serviceData.mentor_id)
        .maybeSingle();

      return { ...serviceData, mentor_profile: mentorProfile ?? null };
    },
  });

  const { data: reviews } = useQuery({
    queryKey: ["mentor-reviews", service?.mentor_id],
    enabled: !!service?.mentor_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("reviews")
        .select("rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey(full_name)")
        .eq("reviewee_id", service!.mentor_id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const book = useMutation({
    mutationFn: async () => {
      if (!me) throw new Error("Not signed in");
      if (me.id === service?.mentor_id) throw new Error("You cannot book your own service");
      const { data, error } = await (supabase as any)
        .from("mentorship_bookings")
        .insert({
          service_id: serviceId,
          mentor_id: service?.mentor_id,
          mentee_id: me.id,
          status: "pending",
          notes: notes.trim() || null,
          scheduled_at: scheduledAt || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Booking request sent. The mentor will confirm shortly.");
      setOpen(false);
      setNotes("");
      setScheduledAt("");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      nav({ to: "/app/mentorship/bookings" });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not book session"),
  });

  if (!service) return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  const isOwnService = me?.id === service.mentor_id;

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>

      <div className="px-4 pt-4">
        <div className="flex items-start gap-3">
          <InitialsAvatar name={service.mentor?.full_name} size={56} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground text-lg">{service.mentor?.full_name}</p>
            <VerifiedBadge role="alumni" />
            {service.mentor_profile?.university && (
              <p className="text-xs text-muted-foreground mt-0.5">{service.mentor_profile.university}</p>
            )}
            {(service.mentor_profile?.rating_count ?? 0) > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Star className="size-3 fill-warning text-warning" />
                {Number(service.mentor_profile.rating_average).toFixed(1)} · {service.mentor_profile.rating_count} reviews
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          <h1 className="text-xl font-semibold text-foreground">{service.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{service.description}</p>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" /> {service.duration_minutes} min session
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">{service.category}</span>
        </div>

        {service.mentor_profile?.skills?.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1">
            {service.mentor_profile.skills.slice(0, 5).map((s: string) => (
              <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
            ))}
          </div>
        )}

        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-semibold text-success">₦{Number(service.price).toLocaleString("en-NG")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">per session · {service.duration_minutes} minutes</p>
            </div>
            {!isOwnService ? (
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button>Book session</Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="rounded-t-2xl">
                  <SheetHeader className="text-left">
                    <SheetTitle>Book a session</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 px-4 pb-6 pt-2">
                    <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                      <p className="text-sm font-medium text-foreground">{service.title}</p>
                      <p className="text-xs text-muted-foreground">with {service.mentor?.full_name} · {service.duration_minutes} min</p>
                      <p className="text-sm font-semibold text-success">₦{Number(service.price).toLocaleString("en-NG")}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Preferred date and time (optional)</label>
                      <input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">What do you want to cover? <span className="text-muted-foreground font-normal">(optional)</span></label>
                      <textarea
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. I need help reviewing my CV for tech roles..."
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                    </div>
                    <p className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
                      <ShieldCheck className="size-4 text-success shrink-0" />
                      Payment is secured via Paystack escrow and released after your session is complete.
                    </p>
                    <Button className="w-full" size="lg" disabled={book.isPending} onClick={() => book.mutate()}>
                      {book.isPending ? "Sending request..." : "Send booking request"}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            ) : (
              <Button variant="outline" onClick={() => nav({ to: "/app/mentorship/manage" })}>
                Edit service
              </Button>
            )}
          </div>
          <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3 text-success" /> Payment held safely until session is completed
          </p>
        </div>

        {reviews && reviews.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold mb-3">Reviews</h2>
            <div className="space-y-3">
              {reviews.map((r: any, i) => (
                <div key={i} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{r.reviewer?.full_name ?? "Anonymous"}</p>
                    <span className="text-sm text-warning">{"★".repeat(r.rating)}</span>
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}