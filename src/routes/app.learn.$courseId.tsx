import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Lock, Play, Award, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/learn/$courseId")({
  head: () => ({ meta: [{ title: "Course — InTask Learn" }] }),
  component: CourseDetailPage,
});

function CourseDetailPage() {
  const { courseId } = Route.useParams();
  const qc = useQueryClient();
  const [activeLesson, setActiveLesson] = useState<any>(null);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("courses")
        .select("*, instructor:profiles!courses_instructor_id_fkey(id, full_name)")
        .eq("id", courseId)
        .single();
      return data;
    },
  });

  const { data: lessons } = useQuery({
    queryKey: ["course-lessons", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_lessons")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });
      return data ?? [];
    },
  });

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", courseId, me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_enrollments")
        .select("*")
        .eq("course_id", courseId)
        .eq("student_id", me!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: completedLessons } = useQuery({
    queryKey: ["lesson-progress", enrollment?.id],
    enabled: !!enrollment?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_progress")
        .select("lesson_id")
        .eq("enrollment_id", enrollment!.id)
        .eq("completed", true);
      return (data ?? []).map((p: any) => p.lesson_id) as string[];
    },
  });

  const completeLesson = useMutation({
    mutationFn: async (lessonId: string) => {
      if (!enrollment) throw new Error("Not enrolled");
      await (supabase as any)
        .from("course_progress")
        .upsert({ enrollment_id: enrollment.id, lesson_id: lessonId, completed: true, completed_at: new Date().toISOString() }, { onConflict: "enrollment_id,lesson_id" });

      const totalLessons = lessons?.length ?? 1;
      const completedCount = ((completedLessons?.length ?? 0) + 1);
      const progress = Math.round((completedCount / totalLessons) * 100);
      const isCompleted = progress === 100;

      await (supabase as any)
        .from("course_enrollments")
        .update({ progress, completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null })
        .eq("id", enrollment.id);

      if (isCompleted) {
        await supabase.from("notifications").insert({
          user_id: me!.id,
          type: "course_completed",
          message: `Congratulations! You completed "${course?.title}". Your certificate has been added to your profile.`,
          link: "/app/profile/me",
        });
      }
    },
    onSuccess: () => {
      toast.success("Lesson completed!");
      qc.invalidateQueries({ queryKey: ["lesson-progress"] });
      qc.invalidateQueries({ queryKey: ["enrollment"] });
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const isEnrolled = !!enrollment;
  const totalLessons = lessons?.length ?? 0;
  const completedCount = completedLessons?.length ?? 0;
  const progress = enrollment?.progress ?? 0;

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
      </header>

      {activeLesson ? (
        <div className="px-4 pt-4 space-y-4">
          <button onClick={() => setActiveLesson(null)} className="text-sm text-primary hover:underline flex items-center gap-1">
            ← Back to course
          </button>
          <h2 className="text-lg font-semibold">{activeLesson.title}</h2>
          {activeLesson.video_url && (
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              <iframe src={activeLesson.video_url} className="w-full h-full" allowFullScreen />
            </div>
          )}
          {activeLesson.content && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{activeLesson.content}</p>
            </div>
          )}
          {isEnrolled && !(completedLessons ?? []).includes(activeLesson.id) && (
            <Button
              className="w-full gap-2"
              onClick={() => { completeLesson.mutate(activeLesson.id); setActiveLesson(null); }}
              disabled={completeLesson.isPending}
            >
              <CheckCircle2 className="size-4" /> Mark as complete
            </Button>
          )}
          {(completedLessons ?? []).includes(activeLesson.id) && (
            <div className="flex items-center justify-center gap-2 text-success text-sm font-medium">
              <CheckCircle2 className="size-4" /> Lesson completed
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 space-y-4">
          <div>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{course?.category} · {course?.level}</span>
            <h1 className="text-xl font-semibold text-foreground mt-1">{course?.title}</h1>
            <p className="text-sm text-muted-foreground mt-2">{course?.description}</p>
          </div>

          {isEnrolled && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{completedCount}/{totalLessons} lessons</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{progress}% complete</p>
              {enrollment?.completed && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-success/10 p-2">
                  <Award className="size-5 text-success" />
                  <p className="text-sm font-medium text-success">Course completed! Certificate earned.</p>
                </div>
              )}
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Course content ({totalLessons} lessons)
            </h2>
            <div className="space-y-2">
              {lessons?.map((lesson: any, index: number) => {
                const isCompleted = (completedLessons ?? []).includes(lesson.id);
                const canAccess = isEnrolled || lesson.is_free_preview;

                return (
                  <button
                    key={lesson.id}
                    onClick={() => canAccess && setActiveLesson(lesson)}
                    disabled={!canAccess}
                    className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      canAccess ? "border-border bg-card hover:border-primary/50 cursor-pointer" : "border-border bg-muted/30 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div className={`grid size-8 place-items-center rounded-full shrink-0 ${isCompleted ? "bg-success/15" : canAccess ? "bg-primary/10" : "bg-muted"}`}>
                      {isCompleted ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : canAccess ? (
                        <Play className="size-4 text-primary" />
                      ) : (
                        <Lock className="size-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{index + 1}. {lesson.title}</p>
                      <p className="text-xs text-muted-foreground">{lesson.duration_minutes} min{lesson.is_free_preview ? " · Free preview" : ""}</p>
                    </div>
                  </button>
                );
              })}

              {(!lessons || lessons.length === 0) && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <BookOpen className="size-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Lessons coming soon</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}