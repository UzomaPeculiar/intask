import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTaskForViewer } from "@/lib/task.functions";

export const Route = createFileRoute("/app/tasks/$taskId/rate")({
  head: () => ({ meta: [{ title: "Leave a review — InTask" }] }),
  component: RatePage,
});

function RatePage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const loadTaskForViewer = useServerFn(getTaskForViewer);
  const [meId, setMeId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMeId(data.user?.id ?? null)); }, []);

  const { data: task, isLoading: loadingTask, error: taskError } = useQuery({
    queryKey: ["task-viewer", taskId],
    queryFn: async () => await loadTaskForViewer({ data: { taskId } }),
  });
  const { data: teamMembers } = useQuery({
    queryKey: ["rate-team-members", taskId],
    enabled: !!task?.is_team_task,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("task_team_members")
        .select("student_id, student:profiles!task_team_members_student_id_fkey(id, full_name)")
        .eq("task_id", taskId)
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: myExistingReviews } = useQuery({
    queryKey: ["my-existing-reviews", taskId, meId],
    enabled: !!taskId && !!meId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("reviewee_id")
        .eq("task_id", taskId)
        .eq("reviewer_id", meId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit() {
    if (!task || !meId) return;
    setBusy(true);
    const revieweeIds = meId === task.poster_id && task.is_team_task
      ? (teamMembers ?? []).map((member: any) => member.student_id).filter(Boolean)
      : [meId === task.poster_id ? task.matched_student_id : task.poster_id].filter(Boolean);
    if (revieweeIds.length === 0) { toast.error("Nothing to review"); setBusy(false); return; }
    const reviewedIds = new Set((myExistingReviews ?? []).map((review: any) => review.reviewee_id).filter(Boolean));
    const pendingRevieweeIds = revieweeIds.filter((revieweeId: string) => !reviewedIds.has(revieweeId));
    if (pendingRevieweeIds.length === 0) {
      toast.info("You already reviewed this task.");
      nav({ to: "/app/tasks/$taskId", params: { taskId }, replace: true });
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("reviews").insert(
      pendingRevieweeIds.map((revieweeId: string) => ({
        task_id: taskId,
        reviewer_id: meId,
        reviewee_id: revieweeId,
        rating,
        comment: comment.trim() || null,
      })) as any,
    );
    if (error) { toast.error(error.message); setBusy(false); return; }
    for (const revieweeId of revieweeIds) {
      const { data: rows } = await supabase.from("reviews").select("rating").eq("reviewee_id", revieweeId);
      if (rows && rows.length) {
        const avg = rows.reduce((s, r) => s + (r.rating as number), 0) / rows.length;
        await supabase.from("student_profiles").update({
          rating_average: Math.round(avg * 100) / 100,
          rating_count: rows.length,
        }).eq("user_id", revieweeId);
      }
    }
    toast.success("Thanks for your review");
    qc.invalidateQueries({ queryKey: ["profile"] });
    nav({ to: "/app/tasks/$taskId", params: { taskId }, replace: true });
  }

  if (loadingTask) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-5 animate-spin" /></div>;

  if (taskError || !task) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div className="space-y-3">
          <p className="text-base font-medium text-foreground">Task not found</p>
          <p className="text-sm text-muted-foreground">You may no longer have access to this task.</p>
          <Button variant="outline" onClick={() => nav({ to: "/app" as any })}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#eff8ea] text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <button
        onClick={() => {
          if (window.history.length > 1) window.history.back();
          else nav({ to: "/app/tasks/$taskId", params: { taskId } });
        }}
        aria-label="Back"
        className="absolute left-6 top-7 z-10 grid size-9 place-items-center rounded-full border border-[#c4deb8] bg-white sm:left-10"
      >
        <ArrowLeft className="size-4" />
      </button>

      <div className="mx-auto flex min-h-screen w-full max-w-[640px] items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[440px] rounded-[20px] border border-[#c4deb8] bg-white p-10 text-center">
          <div className="text-[2.5rem] leading-none">⭐</div>
          <h1 className="mt-4 font-['Space_Grotesk',sans-serif] text-[1.5rem] font-bold text-[#1a1e16]">Leave a review</h1>
          <p className="mt-1.5 text-[0.85rem] text-[#6a8064]">{task.title}</p>

          <div className="mt-7 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRating(n)}
                aria-label={`${n} stars`}
                className="transition-transform duration-150 hover:scale-110"
              >
                <Star className={`size-10 ${n <= rating ? "fill-[#b5771a] text-[#b5771a]" : "text-[#e4efe0]"}`} />
              </button>
            ))}
          </div>

          <p className="mt-5 text-left text-[0.9rem] font-semibold text-[#1a1e16]">
            Comment <span className="font-normal text-[#9eb79c]">(optional)</span>
          </p>
          <Textarea
            className="mt-2 min-h-[100px] rounded-[12px] border-[#c4deb8] bg-[#f9fdf7] px-3.5 py-3.5 text-[0.85rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]/20"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="How did it go?"
          />

          {meId === task.poster_id && task.is_team_task && (teamMembers?.length ?? 0) > 0 && (
            <p className="mt-2 text-left text-[0.75rem] text-[#9eb79c]">This review will be applied to all accepted team members.</p>
          )}

          <Button
            className="mt-5 h-12 w-full rounded-[10px] bg-[#3dcb6c] text-[0.9rem] font-semibold text-white hover:bg-[#34b35d] disabled:bg-[#c4deb8]"
            disabled={busy}
            onClick={submit}
          >
            {busy ? "Submitting..." : "Submit review"}
          </Button>
          <p className="mt-2.5 text-[0.75rem] text-[#9eb79c]">Your review helps other students and posters make informed decisions.</p>
        </div>
      </div>
    </div>
  );
}
