import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/intask/EmptyState";
import { ArrowLeft, Plus, GraduationCap, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/mentorship/manage")({
  head: () => ({ meta: [{ title: "My Mentorship Services — InTask" }] }),
  component: ManageMentorshipPage,
});

const MENTORSHIP_CATEGORIES = [
  "Career Advice", "CV Review", "Mock Interview", "Tech Skills",
  "Business", "Design", "Writing", "Project Review", "General",
];

function ManageMentorshipPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("60");
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["my-mentorship-services", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mentorship_services")
        .select("*")
        .eq("mentor_id", me!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: bookings } = useQuery({
    queryKey: ["mentor-bookings", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("mentorship_bookings")
        .select("*, mentee:profiles!mentorship_bookings_mentee_id_fkey(full_name, id), service:mentorship_services(title)")
        .eq("mentor_id", me!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const confirmBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      await (supabase as any).from("mentorship_bookings").update({ status: "confirmed" }).eq("id", bookingId);
      const booking = bookings?.find((b: any) => b.id === bookingId);
      if (booking) {
        await supabase.from("notifications").insert({
          user_id: booking.mentee_id,
          type: "booking_confirmed",
          message: `Your mentorship session for "${booking.service?.title}" has been confirmed.`,
          link: "/app/mentorship/bookings",
        });
      }
    },
    onSuccess: () => {
      toast.success("Booking confirmed");
      qc.invalidateQueries({ queryKey: ["mentor-bookings"] });
    },
  });

  const completeBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      await (supabase as any).from("mentorship_bookings").update({ status: "completed" }).eq("id", bookingId);
    },
    onSuccess: () => {
      toast.success("Session marked as complete");
      qc.invalidateQueries({ queryKey: ["mentor-bookings"] });
    },
  });

  function startEdit(s: any) {
    setTitle(s.title);
    setDescription(s.description);
    setCategory(s.category);
    setPrice(String(s.price));
    setDuration(String(s.duration_minutes));
    setEditing(s);
    setAdding(true);
  }

  function resetForm() {
    setTitle(""); setDescription(""); setCategory(""); setPrice(""); setDuration("60");
    setAdding(false); setEditing(null);
  }

  async function save() {
    if (!title.trim() || !description.trim() || !category || !price) {
      toast.error("Please fill in all fields");
      return;
    }
    if (Number(price) < 1000) {
      toast.error("Minimum price is ₦1,000");
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await (supabase as any)
        .from("mentorship_services")
        .update({ title: title.trim(), description: description.trim(), category, price: Number(price), duration_minutes: Number(duration), updated_at: new Date().toISOString() })
        .eq("id", editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Service updated");
    } else {
      const { error } = await (supabase as any)
        .from("mentorship_services")
        .insert({ mentor_id: me!.id, title: title.trim(), description: description.trim(), category, price: Number(price), duration_minutes: Number(duration), active: true });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Service created");
    }
    setSaving(false);
    resetForm();
    qc.invalidateQueries({ queryKey: ["my-mentorship-services"] });
    qc.invalidateQueries({ queryKey: ["mentorship-services"] });
  }

  async function remove(id: string) {
    await (supabase as any).from("mentorship_services").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-mentorship-services"] });
    qc.invalidateQueries({ queryKey: ["mentorship-services"] });
    toast.success("Service removed");
  }

  const pendingBookings = bookings?.filter((b: any) => b.status === "pending") ?? [];
  const confirmedBookings = bookings?.filter((b: any) => b.status === "confirmed") ?? [];
  const completedBookings = bookings?.filter((b: any) => b.status === "completed") ?? [];

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-lg font-semibold">My services</h1>
        </div>
        {!adding && (
          <Button size="sm" className="gap-1" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add service
          </Button>
        )}
      </header>

      <div className="px-4 pt-4 space-y-4">
        {adding && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold">{editing ? "Edit service" : "New service"}</h2>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. CV Review for Tech Roles" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what students will get from this session..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Select category</option>
                {MENTORSHIP_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Price (₦)</label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 5000" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                <select value={duration} onChange={(e) => setDuration(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                  <option value="120">120 min</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create service"}</Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        {pendingBookings.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Pending requests</h2>
            <div className="space-y-3">
              {pendingBookings.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-warning/30 bg-card p-3">
                  <p className="text-sm font-medium">{b.mentee?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{b.service?.title}</p>
                  {b.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{b.notes}"</p>}
                  {b.scheduled_at && <p className="text-xs text-muted-foreground mt-1">Requested: {new Date(b.scheduled_at).toLocaleString("en-NG")}</p>}
                  <Button size="sm" className="mt-2 w-full" onClick={() => confirmBooking.mutate(b.id)}>Confirm booking</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {confirmedBookings.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Confirmed sessions</h2>
            <div className="space-y-3">
              {confirmedBookings.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-success/30 bg-card p-3">
                  <p className="text-sm font-medium">{b.mentee?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{b.service?.title}</p>
                  {b.scheduled_at && <p className="text-xs text-muted-foreground mt-1">{new Date(b.scheduled_at).toLocaleString("en-NG")}</p>}
                  <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => completeBooking.mutate(b.id)}>Mark as completed</Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {isLoading && <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />}

        {!isLoading && (services?.length ?? 0) === 0 && !adding && (
          <EmptyState icon={GraduationCap} title="No services yet" description="Share your knowledge and earn by offering mentorship sessions." action={<Button onClick={() => setAdding(true)} className="gap-1"><Plus className="size-3.5" /> Add your first service</Button>} />
        )}

        {services && services.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your services</h2>
            <div className="space-y-3">
              {services.map((s: any) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.category} · {s.duration_minutes} min · ₦{Number(s.price).toLocaleString("en-NG")}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(s)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => remove(s.id)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{s.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {completedBookings.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Completed sessions</h2>
            <div className="space-y-2">
              {completedBookings.map((b: any) => (
                <div key={b.id} className="rounded-xl border border-border bg-card p-3 opacity-70">
                  <p className="text-sm font-medium">{b.mentee?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{b.service?.title}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}