import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tasks/$taskId/rate")({
  head: () => ({ meta: [{ title: "Leave a review — InTask" }] }),
  component: RatePage,
});

function RatePage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [meId, setMeId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null)); }, []);

  const { data: task } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("id", taskId).single()).data,
  });

  async function submit() {
    if (!task || !meId) return;
    setBusy(true);
    const revieweeId = meId === task.poster_id ? task.matched_student_id : task.poster_id;
    if (!revieweeId) { toast.error("Nothing to review"); setBusy(false); return; }
    const { error } = await supabase.from("reviews").insert({
      task_id: taskId, reviewer_id: meId, reviewee_id: revieweeId, rating, comment: comment.trim() || null,
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    // Recompute rating average for student (best-effort)
    const { data: rows } = await supabase.from("reviews").select("rating").eq("reviewee_id", revieweeId);
    if (rows && rows.length) {
      const avg = rows.reduce((s, r) => s + (r.rating as number), 0) / rows.length;
      await supabase.from("student_profiles").update({
        rating_average: Math.round(avg * 100) / 100,
        rating_count: rows.length,
      }).eq("user_id", revieweeId);
    }
    toast.success("Thanks for your review");
    qc.invalidateQueries({ queryKey: ["profile"] });
    nav({ to: "/app/tasks/$taskId", params: { taskId } });
  }

  if (!task) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => nav({ to: "/app/tasks/$taskId", params: { taskId } })} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>
      <div className="space-y-5 px-4 pt-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leave a review</h1>
          <p className="mt-1 text-sm text-muted-foreground">{task.title}</p>
        </div>
        <div>
          <p className="text-sm font-medium">Rating</p>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`}>
                <Star className={`size-8 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Comment (optional)</p>
          <Textarea className="mt-2" rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How did it go?" />
        </div>
        <Button className="w-full" size="lg" disabled={busy} onClick={submit}>{busy ? "Submitting…" : "Submit review"}</Button>
      </div>
    </div>
  );
}
