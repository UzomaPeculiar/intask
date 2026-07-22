import { Plus } from "lucide-react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/intask/EmptyState";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BookOpen, Search, Clock, Star, Users, CheckCircle2, Lock, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/learn")({
  head: () => ({ meta: [{ title: "InTask Learn — InTask" }] }),
  component: LearnPage,
});

const COURSE_CATEGORIES = [
  "All", "Career", "Tech Skills", "Design", "Business",
  "Writing", "Marketing", "Finance", "Personal Development",
];

const LEVELS = ["All levels", "beginner", "intermediate", "advanced"];

function LearnPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [level, setLevel] = useState("All levels");

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("role").eq("id", me!.id).maybeSingle();
      return data;
    },
  });

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", q, category, level],
    queryFn: async () => {
      let query = (supabase as any)
        .from("courses")
        .select("*, instructor:profiles!courses_instructor_id_fkey(id, full_name)")
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      if (category !== "All") query = query.eq("category", category);
      if (level !== "All levels") query = query.eq("level", level);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ["my-enrollments", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("course_enrollments")
        .select("course_id, progress, completed")
        .eq("student_id", me!.id);
      const map: Record<string, any> = {};
      for (const e of data ?? []) map[e.course_id] = e;
      return map;
    },
  });

  const enroll = useMutation({
    mutationFn: async ({ courseId, price }: { courseId: string; price: number }) => {
      if (!me) throw new Error("Not signed in");
      if (price === 0) {
        const { error } = await (supabase as any)
          .from("course_enrollments")
          .insert({ course_id: courseId, student_id: me.id, progress: 0 });
        if (error && error.code !== "23505") throw error;
        return { free: true };
      }

      if (!(window as any).PaystackPop) throw new Error("Paystack not loaded. Please refresh.");

      return new Promise<any>((resolve, reject) => {
        const handler = (window as any).PaystackPop.setup({
          key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
          email: me.email ?? "",
          amount: price * 100,
          currency: "NGN",
          ref: `course_${courseId}_${me.id}_${Date.now()}`,
          callback: function(response: any) {
            (supabase as any)
              .from("course_enrollments")
              .insert({ course_id: courseId, student_id: me.id, progress: 0, paystack_reference: response.reference })
              .then(({ error }: any) => {
                if (error && error.code !== "23505") reject(error);
                else resolve(response);
              });
          },
          onClose: function() { toast.error("Payment cancelled"); },
        });
        handler.openIframe();
      });
    },
    onSuccess: (result: any) => {
      toast.success(result?.free ? "Enrolled successfully!" : "Payment successful. You are now enrolled!");
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not enroll"),
  });

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">InTask Learn</h1>
      </header>

      <div className="px-4 pt-4 space-y-4">
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Learn and earn more</p>
              <p className="text-xs text-muted-foreground">Practical courses from verified alumni and pros</p>
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            Short, focused modules that help you build real-world skills and add more proof to your profile.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-border bg-card/80 px-2 py-2">
              <p className="text-sm font-semibold text-foreground">Fast</p>
              <p className="text-[11px] text-muted-foreground">bite-sized</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 px-2 py-2">
              <p className="text-sm font-semibold text-foreground">Trusted</p>
              <p className="text-[11px] text-muted-foreground">verified experts</p>
            </div>
            <div className="rounded-xl border border-border bg-card/80 px-2 py-2">
              <p className="text-sm font-semibold text-foreground">Practical</p>
              <p className="text-[11px] text-muted-foreground">career-ready</p>
            </div>
          </div>
        </div>

        {myEnrollments && Object.keys(myEnrollments).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Continue learning</h2>
            <div className="space-y-2">
              {courses?.filter((c: any) => myEnrollments[c.id] && !myEnrollments[c.id].completed).slice(0, 2).map((c: any) => {
                const enrollment = myEnrollments[c.id];
                return (
                  <Link key={c.id} to="/app/learn/$courseId" params={{ courseId: c.id }} className="block">
                    <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
                      <div className="grid size-12 place-items-center rounded-lg bg-primary/10 shrink-0">
                        <Play className="size-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground line-clamp-1">{c.title}</p>
                        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${enrollment.progress}%` }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{enrollment.progress}% complete</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search courses..." className="pl-9 h-11 rounded-xl border-border bg-card/80" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Explore</p>
            <h1 className="text-2xl font-semibold tracking-tight">InTask Learn</h1>
          </div>
          {myProfile?.role === "alumni" && (
            <Button size="sm" className="gap-1 rounded-full" onClick={() => nav({ to: "/app/learn/create" as any })}>
              <Plus className="size-3.5" /> Create course
            </Button>
          )}
        </div>
        
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {COURSE_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-all ${category === c ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-foreground hover:border-primary/50"}`}>
              {c}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {LEVELS.map((l) => (
            <button key={l} onClick={() => setLevel(l)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs capitalize transition-all ${level === l ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}>
              {l}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        )}

        {!isLoading && (courses?.length ?? 0) === 0 && (
          <EmptyState icon={BookOpen} title="No courses yet" description="Courses are being added. Check back soon." />
        )}

        <div className="space-y-4">
          {courses?.map((c: any) => {
            const enrollment = myEnrollments?.[c.id];
            const isEnrolled = !!enrollment;
            const isCompleted = enrollment?.completed;

            return (
              <div key={c.id} className="rounded-2xl border border-border/80 bg-card/90 overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="h-32 bg-gradient-to-br from-primary/20 via-primary/5 to-accent/20 flex items-center justify-center">
                  <div className="grid size-14 place-items-center rounded-2xl bg-background/80 ring-1 ring-border/70">
                    <BookOpen className="size-7 text-primary/70" />
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.18em]">{c.category} · {c.level}</span>
                      <p className="font-semibold text-foreground mt-1 line-clamp-2 leading-6">{c.title}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${c.is_free ? "bg-success/15 text-success" : "bg-muted text-foreground"}`}>
                      {c.is_free ? "Free" : `₦${Number(c.price).toLocaleString("en-NG")}`}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground line-clamp-2">{c.description}</p>

                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock className="size-3" /> {c.duration_hours}h</span>
                    <span className="flex items-center gap-1"><Users className="size-3" /> {c.enrolled_count} enrolled</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <InitialsAvatar name={c.instructor?.full_name} size={16} />
                      <span className="truncate">{c.instructor?.full_name}</span>
                    </div>
                  </div>

                  {isEnrolled && (
                    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-2.5">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{enrollment.progress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${enrollment.progress}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    {me?.id === c.instructor_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mb-2 rounded-xl"
                        onClick={(e) => {
                          e.preventDefault();
                          nav({ to: "/app/learn/$courseId/manage" as any, params: { courseId: c.id } } as any);
                        }}
                      >
                        Manage course
                      </Button>
                    )}

                    {isCompleted ? (
                      <Button variant="outline" className="w-full gap-1 text-success border-success/30 rounded-xl" disabled>
                        <CheckCircle2 className="size-4" /> Completed
                      </Button>
                    ) : isEnrolled ? (
                      <Link to="/app/learn/$courseId" params={{ courseId: c.id }} className="block">
                        <Button className="w-full gap-1 rounded-xl">
                          <Play className="size-4" /> Continue learning
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        className="w-full rounded-xl"
                        disabled={enroll.isPending}
                        onClick={() => enroll.mutate({ courseId: c.id, price: c.is_free ? 0 : c.price })}
                      >
                        {c.is_free ? "Enroll for free" : `Enroll for ₦${Number(c.price).toLocaleString("en-NG")}`}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}