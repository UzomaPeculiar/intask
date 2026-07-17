import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TASK_CATEGORIES, SKILLS } from "@/lib/constants";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tasks/create")({
  head: () => ({ meta: [{ title: "Post a task — InTask" }] }),
  component: CreateTaskPage,
});

const CATEGORY_MINIMUMS: Record<string, number> = {
  "Web Design": 10000,
  "Mobile App Dev": 20000,
  "UI/UX Design": 10000,
  "Graphic Design": 5000,
  "Content Writing": 3000,
  "Copywriting": 3000,
  "Video Editing": 8000,
  "Photography": 5000,
  "Data Analysis": 8000,
  "Research": 5000,
  "Python": 10000,
  "JavaScript": 10000,
  "Social Media": 5000,
  "Math Tutoring": 3000,
  "Science Tutoring": 3000,
  "English Tutoring": 3000,
  "Business Analysis": 8000,
  "Product Management": 10000,
  "Virtual Assistant": 5000,
  "Excel/Spreadsheets": 5000,
};

function CreateTaskPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [workType, setWorkType] = useState<"remote" | "on_campus" | "either">("either");
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!title.trim()) return toast.error("Add a title");
    if (!category) return toast.error("Pick a category");
    if (!description.trim()) return toast.error("Describe the task");

  const minForCategory = CATEGORY_MINIMUMS[category] ?? 3000;
  if (!negotiable && (!budget || Number(budget) < minForCategory)) {
    return toast.error(`Minimum budget for ${category || "this category"} is ₦${minForCategory.toLocaleString("en-NG")}. This ensures fair pay for students.`);
  }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return toast.error("Not signed in"); }
    const { data, error } = await supabase.from("tasks").insert({
      poster_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      budget: negotiable ? 0 : Number(budget),
      budget_negotiable: negotiable,
      deadline: deadline || null,
      work_type: workType,
      skills_needed: skills,
      status: "open",
    }).select("id").single();
    setLoading(false);
    if (error || !data) return toast.error(error?.message ?? "Couldn't post");
    toast.success("Task posted");
    nav({ to: "/app/tasks/$taskId", params: { taskId: data.id } });
  }

  return (
    <div className="mx-auto max-w-md pb-28">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">Post a task</h1>
      </header>

      <div className="space-y-5 px-4 pt-6">
        <Field label="Task title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design a logo for my clothing brand" />
        </Field>

        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Select a category</option>
            {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Description">
          <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you need done, what the deliverable looks like, and any specific requirements." />
        </Field>

        <Field label="Budget (₦)">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
            <Input type="number" min={0} value={budget} disabled={negotiable} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 15000" className="pl-7" />
          </div>
          <label className="mt-2 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5 text-sm">
            <span>I'm open to negotiation</span>
            <Switch checked={negotiable} onCheckedChange={setNegotiable} />
          </label>
        {category && !negotiable && (
          <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
            {CATEGORY_MINIMUMS[category] ? (
              <>
                <span className="font-medium text-foreground">Suggested range for {category}:</span>{" "}
                ₦{CATEGORY_MINIMUMS[category].toLocaleString("en-NG")} – ₦{(CATEGORY_MINIMUMS[category] * 8).toLocaleString("en-NG")}
                {" · "}Minimum: ₦{CATEGORY_MINIMUMS[category].toLocaleString("en-NG")}
              </>
            ) : (
              <span>Set a fair budget — students depend on this income.</span>
            )}
          </div>
        )}
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3 text-success" /> Funds are held safely in escrow until you approve the work.
          </p>
        </Field>

        <Field label="Deadline">
          <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </Field>

        <Field label="Work type">
          <div className="grid grid-cols-3 gap-2 text-sm">
            {(["remote", "on_campus", "either"] as const).map((w) => (
              <button key={w} type="button" onClick={() => setWorkType(w)}
                className={`rounded-md border px-2 py-2 ${workType === w ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
                {w === "remote" ? "Remote" : w === "on_campus" ? "On-campus" : "Either"}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Skills needed">
          <div className="flex flex-wrap gap-1.5">
            {SKILLS.map((sk) => {
              const sel = skills.includes(sk);
              return (
                <button key={sk} type="button"
                  onClick={() => setSkills(sel ? skills.filter((x) => x !== sk) : [...skills, sk])}
                  className={`rounded-full border px-2.5 py-1 text-xs ${sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
                  {sk}
                </button>
              );
            })}
          </div>
        </Field>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button className="w-full" size="lg" onClick={submit} disabled={loading}>
            {loading ? "Posting…" : "Post task"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
