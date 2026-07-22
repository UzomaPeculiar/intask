import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/intask/EmptyState";
import { ArrowLeft, Plus, Trash2, Pencil, BookOpen, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/learn/$courseId/manage")({
  head: () => ({ meta: [{ title: "Manage Course — InTask Learn" }] }),
  component: ManageCoursePage,
});

function ManageCoursePage() {
  const { courseId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [addingLesson, setAddingLesson] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonContent, setLessonContent] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonDuration, setLessonDuration] = useState("10");
  const [isFreePreview, setIsFreePreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("courses")
        .select("*")
        .eq("id", courseId)
        .single();
      return data;
    },
  });

  const { data: lessons, refetch } = useQuery({
    queryKey: ["course-lessons-manage", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_lessons")
        .select("*")
        .eq("course_id", courseId)
        .order("order_index", { ascending: true });
      return data ?? [];
    },
  });

  const isOwner = me?.id === course?.instructor_id;

  function startEdit(lesson: any) {
    setEditingLesson(lesson);
    setLessonTitle(lesson.title);
    setLessonContent(lesson.content ?? "");
    setLessonVideoUrl(lesson.video_url ?? "");
    setLessonDuration(String(lesson.duration_minutes));
    setIsFreePreview(lesson.is_free_preview);
    setAddingLesson(true);
  }

  function resetForm() {
    setAddingLesson(false);
    setEditingLesson(null);
    setLessonTitle("");
    setLessonContent("");
    setLessonVideoUrl("");
    setLessonDuration("10");
    setIsFreePreview(false);
  }

  async function saveLesson() {
    if (!lessonTitle.trim()) { toast.error("Lesson title is required"); return; }
    setSaving(true);

    if (editingLesson) {
      const { error } = await (supabase as any)
        .from("course_lessons")
        .update({
          title: lessonTitle.trim(),
          content: lessonContent.trim() || null,
          video_url: lessonVideoUrl.trim() || null,
          duration_minutes: Number(lessonDuration),
          is_free_preview: isFreePreview,
        })
        .eq("id", editingLesson.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Lesson updated");
    } else {
      const nextOrder = (lessons?.length ?? 0) + 1;
      const { error } = await (supabase as any)
        .from("course_lessons")
        .insert({
          course_id: courseId,
          title: lessonTitle.trim(),
          content: lessonContent.trim() || null,
          video_url: lessonVideoUrl.trim() || null,
          duration_minutes: Number(lessonDuration),
          order_index: nextOrder,
          is_free_preview: isFreePreview,
        });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success("Lesson added");
    }

    setSaving(false);
    resetForm();
    refetch();
    qc.invalidateQueries({ queryKey: ["course-lessons"] });
  }

  async function deleteLesson(lessonId: string) {
    await (supabase as any).from("course_lessons").delete().eq("id", lessonId);
    toast.success("Lesson deleted");
    refetch();
    qc.invalidateQueries({ queryKey: ["course-lessons"] });
  }

  if (!isOwner && me) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center">
        <BookOpen className="size-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold">You don't have access to manage this course</p>
        <Button className="mt-4" onClick={() => window.history.back()}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Instructor</p>
            <h1 className="text-base font-semibold">Manage course</h1>
            <p className="text-xs text-muted-foreground line-clamp-1">{course?.title}</p>
          </div>
        </div>
        {!addingLesson && (
          <Button size="sm" className="gap-1 rounded-full" onClick={() => setAddingLesson(true)}>
            <Plus className="size-3.5" /> Add lesson
          </Button>
        )}
      </header>

      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-3.5 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-sm font-semibold">{lessons?.length ?? 0} lessons</p>
            <p className="text-xs text-muted-foreground">{course?.enrolled_count ?? 0} students enrolled</p>
          </div>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => nav({ to: "/app/learn/$courseId" as any, params: { courseId } } as any)}>
            Preview
          </Button>
        </div>

        {addingLesson && (
          <div className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{editingLesson ? "Edit lesson" : "New lesson"}</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Lesson builder</span>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Title *</label>
              <Input value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="e.g. Introduction and Overview" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Video URL</label>
              <Input value={lessonVideoUrl} onChange={(e) => setLessonVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/..." />
              <p className="text-xs text-muted-foreground">For YouTube: Share → Embed → copy the src URL</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Written content</label>
              <textarea rows={4} value={lessonContent} onChange={(e) => setLessonContent(e.target.value)} placeholder="Write lesson content here..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                <Input type="number" value={lessonDuration} onChange={(e) => setLessonDuration(e.target.value)} />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={isFreePreview} onChange={(e) => setIsFreePreview(e.target.checked)} className="size-3.5" />
                  Free preview
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 rounded-xl" disabled={saving} onClick={saveLesson}>
                {saving ? "Saving..." : editingLesson ? "Update lesson" : "Add lesson"}
              </Button>
              <Button variant="outline" className="rounded-xl" onClick={resetForm}>Cancel</Button>
            </div>
          </div>
        )}

        {(!lessons || lessons.length === 0) && !addingLesson && (
          <EmptyState icon={BookOpen} title="No lessons yet" description="Add your first lesson to get started." action={<Button onClick={() => setAddingLesson(true)} className="gap-1"><Plus className="size-3.5" /> Add lesson</Button>} />
        )}

        {lessons && lessons.length > 0 && (
          <div className="space-y-2">
            {lessons.map((lesson: any, index: number) => (
              <div key={lesson.id} className="rounded-2xl border border-border/80 bg-card/90 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{index + 1}. {lesson.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-muted-foreground">{lesson.duration_minutes} min</p>
                      {lesson.is_free_preview && (
                        <span className="text-[10px] font-medium text-success bg-success/10 px-1.5 py-0.5 rounded-full">Free preview</span>
                      )}
                      {lesson.video_url && (
                        <span className="text-[10px] text-muted-foreground">Video</span>
                      )}
                      {lesson.content && (
                        <span className="text-[10px] text-muted-foreground">Text</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(lesson)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-foreground">
                      <Pencil className="size-3.5" />
                    </button>
                    <button onClick={() => deleteLesson(lesson.id)} className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}