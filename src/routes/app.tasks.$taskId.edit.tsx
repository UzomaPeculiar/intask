import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TASK_CATEGORIES, SKILLS } from "@/lib/constants";
import { ArrowLeft, ShieldCheck, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/tasks/$taskId/edit")({
  head: () => ({ meta: [{ title: "Edit task — InTask" }] }),
  component: EditTaskPage,
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

const LOCKED_TRANSACTION_STATUSES = new Set(["pending", "in_escrow", "released", "refunded"]);

function EditTaskPage() {
  const { taskId } = Route.useParams();
  const nav = useNavigate();

  const [isTeamTask, setIsTeamTask] = useState(false);
  const [teamSize, setTeamSize] = useState(2);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [workType, setWorkType] = useState<"remote" | "on_campus" | "either">("either");
  const [skills, setSkills] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editable, setEditable] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  async function loadTask() {
    setLoading(true);
    setEditable(true);
    setErrorMessage("");

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;

    if (!user) {
      setLoading(false);
      setEditable(false);
      setErrorMessage("Please sign in to edit this task.");
      return;
    }

    const { data: task, error } = await supabase.from("tasks").select("*").eq("id", taskId).single();
    if (error || !task) {
      setLoading(false);
      setEditable(false);
      setErrorMessage("This task could not be loaded.");
      return;
    }

    if (task.poster_id !== user.id) {
      setLoading(false);
      setEditable(false);
      setErrorMessage("Only the task poster can edit this task.");
      return;
    }

    const { data: txData } = await supabase
      .from("transactions")
      .select("status")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const txLocked = !!txData?.status && LOCKED_TRANSACTION_STATUSES.has(txData.status);
    const taskIsEditableState = (task.status === "open" || task.status === "matched") && !txLocked;

    if (!taskIsEditableState) {
      setLoading(false);
      setEditable(false);
      setErrorMessage("This task can no longer be edited once escrow has started.");
      return;
    }

    setTitle(task.title ?? "");
    setCategory(task.category ?? "");
    setDescription(task.description ?? "");
    setBudget(task.budget != null ? String(task.budget) : "");
    setNegotiable(Boolean(task.budget_negotiable));
    setDeadline(task.deadline ? String(task.deadline).slice(0, 10) : "");
    setWorkType((task.work_type as "remote" | "on_campus" | "either") ?? "either");
    setSkills(task.skills_needed ?? []);
    setIsTeamTask(Boolean(task.is_team_task));
    setTeamSize(Number(task.team_size ?? 2));
    setLoading(false);
  }

  async function submit() {
    if (!title.trim()) return toast.error("Add a title");
    if (!category) return toast.error("Pick a category");
    if (!description.trim()) return toast.error("Describe the task");

    const minForCategory = CATEGORY_MINIMUMS[category] ?? 3000;
    if (!negotiable && (!budget || Number(budget) < minForCategory)) {
      return toast.error(`Minimum budget for ${category || "this category"} is ₦${minForCategory.toLocaleString("en-NG")}.`);
    }

    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;

    if (!user) {
      setSaving(false);
      return toast.error("Please sign in to continue.");
    }

    const { data: task, error: taskError } = await supabase.from("tasks").select("id, poster_id, status").eq("id", taskId).single();
    if (taskError || !task) {
      setSaving(false);
      return toast.error("This task could not be updated.");
    }

    if (task.poster_id !== user.id) {
      setSaving(false);
      return toast.error("Only the task poster can edit this task.");
    }

    const { data: txData } = await supabase
      .from("transactions")
      .select("status")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const txLocked = !!txData?.status && LOCKED_TRANSACTION_STATUSES.has(txData.status);
    const taskIsEditableState = (task.status === "open" || task.status === "matched") && !txLocked;

    if (!taskIsEditableState) {
      setSaving(false);
      return toast.error("This task can no longer be edited once escrow has started.");
    }

    const { error } = await supabase
      .from("tasks")
      .update({
        title: title.trim(),
        description: description.trim(),
        category,
        budget: negotiable ? 0 : Number(budget),
        budget_negotiable: negotiable,
        deadline: deadline || null,
        work_type: workType,
        skills_needed: skills,
        is_team_task: isTeamTask,
        team_size: isTeamTask ? teamSize : 1,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", taskId)
      .eq("poster_id", user.id);

    setSaving(false);

    if (error) {
      return toast.error(error.message ?? "Couldn't update task");
    }

    toast.success("Task updated");
    nav({ to: "/app/tasks/$taskId", params: { taskId } });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  if (!editable) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <header className="flex items-center gap-2">
          <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm">
            <ArrowLeft className="size-4" />
          </button>
          <div className="it-hero-surface rounded-2xl border px-4 py-3 shadow-sm">
            <h1 className="text-lg font-semibold">Edit task</h1>
          </div>
        </header>

        <div className="mt-6 rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <Button className="mt-4 w-full" onClick={() => nav({ to: "/app/tasks/$taskId", params: { taskId } })}>
            Back to task
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl pb-28">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card shadow-sm">
          <ArrowLeft className="size-4" />
        </button>
        <div className="it-hero-surface rounded-2xl border px-4 py-3 shadow-sm">
          <h1 className="text-lg font-semibold">Edit task</h1>
        </div>
      </header>

      <div className="rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm mx-4 mt-4">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Update the task details</p>
        <p className="mt-1 text-sm text-muted-foreground">You can change the task details while it is still awaiting escrow funding.</p>
      </div>

      <div className="space-y-3 px-4 pt-4">
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
            <span>I&apos;m open to negotiation</span>
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

        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <div className="rounded-2xl border border-border/80 bg-card/70 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Additional details</p>
                <p className="text-xs text-muted-foreground">Deadline, format, team setup, and skills</p>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  {showAdvanced ? "Hide" : "Show"}
                  {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          <CollapsibleContent className="space-y-3 pt-3">
            <Field label="Deadline">
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Field>

            <Field label="Work type">
              <div className="grid grid-cols-3 gap-2 text-sm">
                {(["remote", "on_campus", "either"] as const).map((w) => (
                  <button key={w} type="button" onClick={() => setWorkType(w)} className={`rounded-md border px-2 py-2 ${workType === w ? "it-chip-active" : "border-border bg-card text-foreground"}`}>
                    {w === "remote" ? "Remote" : w === "on_campus" ? "On-campus" : "Either"}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Team task">
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border bg-card p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">This is a team task</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Hire multiple students to work together</p>
                </div>
                <Switch checked={isTeamTask} onCheckedChange={setIsTeamTask} />
              </label>
              {isTeamTask && (
                <div className="mt-3 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Number of students needed</label>
                  <select
                    value={teamSize}
                    onChange={(e) => setTeamSize(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {[2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} students</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Budget of ₦{budget ? Number(budget).toLocaleString("en-NG") : "0"} will be split equally - ₦{budget && teamSize ? Math.floor(Number(budget) / teamSize).toLocaleString("en-NG") : "0"} per student
                  </p>
                </div>
              )}
            </Field>

            <Field label="Skills needed">
              <div className="flex flex-wrap gap-1.5">
                {SKILLS.map((sk) => {
                  const sel = skills.includes(sk);
                  return (
                    <button key={sk} type="button" onClick={() => setSkills(sel ? skills.filter((x) => x !== sk) : [...skills, sk])} className={`rounded-full border px-2.5 py-1 text-xs ${sel ? "it-chip-active" : "border-border bg-card text-foreground"}`}>
                      {sk}
                    </button>
                  );
                })}
              </div>
            </Field>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <Button className="w-full" size="lg" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-4 shadow-sm space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
