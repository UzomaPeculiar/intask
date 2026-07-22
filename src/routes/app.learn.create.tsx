import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, GripVertical, BookOpen } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/learn/create")({
  head: () => ({ meta: [{ title: "Create Course — InTask Learn" }] }),
  component: CreateCoursePage,
});

const COURSE_CATEGORIES = [
  "Career", "Tech Skills", "Design", "Business",
  "Writing", "Marketing", "Finance", "Personal Development",
];

function CreateCoursePage() {
  const nav = useNavigate();
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Career");
  const [level, setLevel] = useState("beginner");
  const [price, setPrice] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [durationHours, setDurationHours] = useState("1");
  const [lessons, setLessons] = useState<any[]>([
    { title: "", content: "", video_url: "", duration_minutes: 10, is_free_preview: false },
  ]);
  const [saving, setSaving] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("role, is_admin").eq("id", me!.id).maybeSingle() as any;
      return data;
    },
  });

  const canCreate = myProfile?.role === "alumni" || (myProfile as any)?.is_admin;

  function addLesson() {
    setLessons((prev) => [...prev, { title: "", content: "", video_url: "", duration_minutes: 10, is_free_preview: false }]);
  }

  function removeLesson(index: number) {
    setLessons((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLesson(index: number, field: string, value: any) {
    setLessons((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  }

  async function save() {
    if (!title.trim() || !description.trim()) { toast.error("Please fill in course title and description"); return; }
    if (lessons.some((l) => !l.title.trim())) { toast.error("All lessons must have a title"); return; }
    if (!me) { toast.error("Not signed in"); return; }
    setSaving(true);

    const { data: course, error: courseError } = await (supabase as any)
      .from("courses")
      .insert({
        instructor_id: me.id,
        title: title.trim(),
        description: description.trim(),
        category,
        level,
        price: isFree ? 0 : Number(price),
        is_free: isFree,
        duration_hours: Number(durationHours),
        status: "published",
        enrolled_count: 0,
      })
      .select("id")
      .single();

    if (courseError) { toast.error(courseError.message); setSaving(false); return; }

    const lessonInserts = lessons.map((l, i) => ({
      course_id: course.id,
      title: l.title.trim(),
      content: l.content.trim() || null,
      video_url: l.video_url.trim() || null,
      duration_minutes: Number(l.duration_minutes),
      order_index: i + 1,
      is_free_preview: l.is_free_preview,
    }));

    const { error: lessonsError } = await (supabase as any)
      .from("course_lessons")
      .insert(lessonInserts);

    setSaving(false);
    if (lessonsError) { toast.error("Course created but lessons failed. Please add lessons manually."); }
    else { toast.success("Course published successfully!"); }

    qc.invalidateQueries({ queryKey: ["courses"] });
    nav({ to: "/app/learn/$courseId" as any, params: { courseId: course.id } } as any);
  }

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 text-center">
        <BookOpen className="size-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold">Only alumni and admins can create courses</p>
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
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Create</p>
            <h1 className="text-lg font-semibold">Course details</h1>
          </div>
        </div>
        <Button size="sm" disabled={saving} onClick={save} className="rounded-full">
          {saving ? "Publishing..." : "Publish"}
        </Button>
      </header>

      <div className="px-4 pt-4 space-y-5">
        <div className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Course details</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">Ready to publish</span>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to UI/UX Design" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description *</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students learn from this course?" className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {COURSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Level</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Total duration (hours)</label>
            <Input type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} placeholder="e.g. 2" />
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border bg-card p-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Free course</p>
              <p className="text-xs text-muted-foreground">Make this course free for all students</p>
            </div>
            <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="size-4" />
          </label>
          {!isFree && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Price (₦)</label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 5000" />
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Lessons ({lessons.length})</h2>
              <p className="text-xs text-muted-foreground">Break the course into clear, bite-sized lessons.</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1 rounded-full" onClick={addLesson}>
              <Plus className="size-3.5" /> Add lesson
            </Button>
          </div>

          {lessons.map((lesson, index) => (
            <div key={index} className="rounded-2xl border border-border/80 bg-card/90 p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">Lesson {index + 1}</p>
                </div>
                {lessons.length > 1 && (
                  <button onClick={() => removeLesson(index)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Lesson title *</label>
                <Input value={lesson.title} onChange={(e) => updateLesson(index, "title", e.target.value)} placeholder="e.g. Introduction and Overview" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Video URL (YouTube embed or direct)</label>
                <Input value={lesson.video_url} onChange={(e) => updateLesson(index, "video_url", e.target.value)} placeholder="e.g. https://www.youtube.com/embed/..." />
                <p className="text-xs text-muted-foreground">For YouTube: go to Share → Embed → copy the src URL</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Written content</label>
                <textarea rows={4} value={lesson.content} onChange={(e) => updateLesson(index, "content", e.target.value)} placeholder="Write the lesson content here. This appears alongside or instead of a video." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Duration (minutes)</label>
                  <Input type="number" value={lesson.duration_minutes} onChange={(e) => updateLesson(index, "duration_minutes", e.target.value)} />
                </div>
                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={lesson.is_free_preview} onChange={(e) => updateLesson(index, "is_free_preview", e.target.checked)} className="size-3.5" />
                    Free preview
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button className="w-full rounded-xl" size="lg" disabled={saving} onClick={save}>
          {saving ? "Publishing..." : "Publish course"}
        </Button>
      </div>
    </div>
  );
}