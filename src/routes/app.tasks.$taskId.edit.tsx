import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TASK_CATEGORIES, getSkillsForTaskCategory } from "@/lib/constants";
import { ArrowLeft, ShieldCheck, ChevronDown, ChevronUp, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";

export const Route = createFileRoute("/app/tasks/$taskId/edit")({
  head: () => ({
    meta: [{ title: "Edit task — InTask" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
  }),
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
  const loadRuntimePlatformSettings = useServerFn(getRuntimePlatformSettings);
  const { data: minTaskBudgetSetting } = useQuery({
    queryKey: ["runtime-platform-settings"],
    queryFn: async () => await loadRuntimePlatformSettings(),
    staleTime: 30_000,
  });
  const minTaskBudget = Math.max(
    0,
    Number(minTaskBudgetSetting?.min_task_budget ?? PLATFORM_SETTING_DEFAULTS.min_task_budget),
  );
  const categorySkills = getSkillsForTaskCategory(category);

  useEffect(() => {
    void loadTask();
  }, [taskId]);

  useEffect(() => {
    const allowedSkills = new Set(categorySkills);
    setSkills((prev) => prev.filter((skill) => allowedSkills.has(skill)));
  }, [category]);

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

    const { count: applicantCount } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId)
      .eq("status", "pending");

    const txLocked = !!txData?.status && LOCKED_TRANSACTION_STATUSES.has(txData.status);
    const taskIsEditableState = (task.status === "open" || task.status === "matched") && !txLocked && (applicantCount ?? 0) === 0;

    if (!taskIsEditableState) {
      setLoading(false);
      setEditable(false);
      setErrorMessage((applicantCount ?? 0) > 0
        ? "This task can no longer be edited once someone has applied."
        : "This task can no longer be edited once escrow has started.");
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

    if (!negotiable && (!budget || Number(budget) < minTaskBudget)) {
      return toast.error(`Minimum task budget is ₦${minTaskBudget.toLocaleString("en-NG")}.`);
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

    const { count: applicantCount } = await supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("task_id", taskId)
      .eq("status", "pending");

    const txLocked = !!txData?.status && LOCKED_TRANSACTION_STATUSES.has(txData.status);
    const taskIsEditableState = (task.status === "open" || task.status === "matched") && !txLocked && (applicantCount ?? 0) === 0;

    if (!taskIsEditableState) {
      setSaving(false);
      return toast.error((applicantCount ?? 0) > 0
        ? "This task can no longer be edited once someone has applied."
        : "This task can no longer be edited once escrow has started.");
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
      <div className="grid min-h-screen place-items-center bg-[#eff8ea] text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-[#1a7a42]" />
      </div>
    );
  }

  if (!editable) {
    return (
      <div className="min-h-screen bg-[#eff8ea] px-6 py-7 [font-family:'Inter',sans-serif]">
        <div className="mx-auto w-full max-w-[640px]">
          <button onClick={() => window.history.back()} aria-label="Back" className="mb-4 inline-flex size-9 items-center justify-center rounded-full border border-[#c4deb8] bg-white text-[#1a1e16] shadow-sm transition-transform duration-150 hover:-translate-y-0.5">
            <ArrowLeft className="size-4" />
          </button>

          <section className="rounded-[18px] border border-[#c4deb8] bg-[linear-gradient(145deg,#f4fbf0,#eaf3f8)] p-4 shadow-sm">
            <h1 className="flex items-center gap-2 font-['Space_Grotesk',sans-serif] text-[1.5rem] font-bold text-[#1a1e16]">
              <FileText className="size-5 text-[#1a7a42]" /> Edit task
            </h1>
            <p className="mt-2 text-[0.85rem] text-[#6a8064]">You can change the task details while it is still awaiting escrow funding.</p>
          </section>

          <section className="mt-4 rounded-[14px] border border-[#c4deb8] bg-white p-4 shadow-sm">
            <p className="text-sm text-[#6a8064]">{errorMessage}</p>
            <Button className="mt-4 w-full rounded-[10px] bg-[#3dcb6c] text-white hover:bg-[#36ba61]" onClick={() => nav({ to: "/app/tasks/$taskId", params: { taskId } })}>
              Back to task
            </Button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#eff8ea] pb-24 text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="mx-auto min-h-screen w-full max-w-[640px] px-6 py-7">
        <button onClick={() => window.history.back()} aria-label="Back" className="mb-4 inline-flex size-9 items-center justify-center rounded-full border border-[#c4deb8] bg-white text-[#1a1e16] shadow-sm transition-transform duration-150 hover:-translate-y-0.5">
          <ArrowLeft className="size-4" />
        </button>

        <section className="rounded-[18px] border border-[#c4deb8] bg-[linear-gradient(145deg,#f4fbf0,#eaf3f8)] p-5 shadow-sm">
          <h1 className="flex items-center gap-2 font-['Space_Grotesk',sans-serif] text-[1.5rem] font-bold text-[#1a1e16]">
            <FileText className="size-5 text-[#1a7a42]" /> Edit task
          </h1>
          <p className="mt-2 text-[0.85rem] text-[#6a8064]">You can change the task details while it is still awaiting escrow funding.</p>
        </section>

        <div className="mt-4 rounded-[14px] border border-[#c4deb8] bg-white p-5 shadow-sm">
          <div className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[#9eb79c]">Update task details</div>
          <p className="mt-1 text-[0.85rem] text-[#6a8064]">You can change the task details while it is still awaiting escrow funding.</p>
        </div>

        <div className="mt-3 space-y-3">
          <section className="rounded-[14px] border border-[#c4deb8] bg-white p-5 shadow-sm">
            <Field label="Task title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Design a logo for my clothing brand" className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] text-[0.85rem]" />
            </Field>

            <Field label="Category">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex h-11 w-full rounded-[10px] border border-[#c4deb8] bg-[#f9fdf7] px-3.5 text-[0.85rem] outline-none focus:border-[#3dcb6c]">
                <option value="">Select a category</option>
                {TASK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            <Field label="Description">
              <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what you need done, what the deliverable looks like, and any specific requirements." className="min-h-[100px] resize-y rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] px-3.5 py-3 text-[0.85rem]" />
            </Field>
          </section>

          <section className="rounded-[14px] border border-[#c4deb8] bg-white p-5 shadow-sm">
            <Field label="Budget (₦)">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6a8064]">₦</span>
                <Input type="number" min={0} value={budget} disabled={negotiable} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 15000" className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] pl-7 text-[0.85rem]" />
              </div>
              <label className="mt-2 flex items-center justify-between rounded-[10px] border border-[#c4deb8] bg-white px-3 py-2.5 text-[0.8rem]">
                <span>I&apos;m open to negotiation</span>
                <Switch checked={negotiable} onCheckedChange={setNegotiable} />
              </label>
              {category && !negotiable && (
                <div className="mt-2 rounded-[8px] border border-[#e4efe0] bg-[#f4fbf0] px-3 py-2 text-[0.7rem] text-[#6a8064]">
                  {CATEGORY_MINIMUMS[category] ? (
                    <>
                      <span className="font-semibold text-[#1a1e16]">Suggested range for {category}:</span>{" "}
                      ₦{CATEGORY_MINIMUMS[category].toLocaleString("en-NG")} – ₦{(CATEGORY_MINIMUMS[category] * 8).toLocaleString("en-NG")}
                      {" · "}Minimum: ₦{CATEGORY_MINIMUMS[category].toLocaleString("en-NG")}
                    </>
                  ) : (
                    <span>Set a fair budget — students depend on this income.</span>
                  )}
                </div>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-[0.7rem] text-[#6a8064]">
                <ShieldCheck className="size-3.5 text-[#1a7a42]" /> Funds are held safely in escrow until you approve the work.
              </p>
            </Field>
          </section>

          <section className="rounded-[14px] border border-[#c4deb8] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[0.9rem] font-semibold text-[#1a1e16]">Additional details</p>
                <p className="text-[0.75rem] text-[#6a8064]">Deadline, format, team setup, and skills</p>
              </div>
              <button type="button" className="text-[0.75rem] font-medium text-[#3dcb6c]" onClick={() => setShowAdvanced((value) => !value)}>
                {showAdvanced ? "Hide ▴" : "Show ▾"}
              </button>
            </div>

            <div className={showAdvanced ? "space-y-3" : "space-y-3"}>
              <Field label="Deadline">
                <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] text-[0.85rem]" />
              </Field>

              <Field label="Work type">
                <div className="grid grid-cols-3 gap-2">
                  {(["remote", "on_campus", "either"] as const).map((w) => {
                    const active = workType === w;
                    return (
                      <button key={w} type="button" onClick={() => setWorkType(w)} className={`rounded-[8px] border px-2 py-2 text-[0.8rem] font-medium transition-all duration-150 ${active ? "border-[#3dcb6c] bg-[#d8f5e4] text-[#1a7a42]" : "border-[#c4deb8] bg-white text-[#1a1e16]"}`}>
                        {w === "remote" ? "Remote" : w === "on_campus" ? "On-campus" : "Either"}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Team task">
                <label className="flex items-center justify-between rounded-[10px] border border-[#e4efe0] bg-white px-3 py-2.5 text-[0.8rem]">
                  <div>
                    <p className="font-medium text-[#1a1e16]">This is a team task</p>
                    <p className="mt-0.5 text-[0.7rem] text-[#6a8064]">Hire multiple students to work together</p>
                  </div>
                  <Switch checked={isTeamTask} onCheckedChange={setIsTeamTask} />
                </label>
                {isTeamTask && (
                  <div className="mt-2 space-y-1.5">
                    <label className="text-[0.75rem] font-medium text-[#6a8064]">Number of students needed</label>
                    <select
                      value={teamSize}
                      onChange={(e) => setTeamSize(Number(e.target.value))}
                      className="flex h-11 w-full rounded-[10px] border border-[#c4deb8] bg-[#f9fdf7] px-3.5 text-[0.85rem] outline-none focus:border-[#3dcb6c]"
                    >
                      {[2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n} students</option>
                      ))}
                    </select>
                    <p className="text-[0.7rem] text-[#6a8064]">
                      Budget of ₦{budget ? Number(budget).toLocaleString("en-NG") : "0"} will be split equally - ₦{budget && teamSize ? Math.floor(Number(budget) / teamSize).toLocaleString("en-NG") : "0"} per student
                    </p>
                  </div>
                )}
              </Field>

              <Field label="Skills needed">
                <div className="flex flex-wrap gap-1.5">
                  {categorySkills.map((sk) => {
                    const sel = skills.includes(sk);
                    return (
                      <button key={sk} type="button" onClick={() => setSkills(sel ? skills.filter((x) => x !== sk) : [...skills, sk])} className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-medium ${sel ? "border-[#3dcb6c] bg-[#3dcb6c] text-white" : "border-[#c4deb8] bg-white text-[#1a1e16]"}`}>
                        {sk}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </section>

          <section className="rounded-[14px] border border-[#c4deb8] bg-white p-4 shadow-sm">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-[#9eb79c]">Warning</p>
            <p className="mt-1 text-[0.85rem] text-[#6a8064]">Once someone applies, this task can no longer be edited. Double-check your details before saving.</p>
          </section>

          <button type="button" onClick={submit} disabled={saving} className="mt-2 flex h-12 w-full items-center justify-center rounded-[10px] bg-[#3dcb6c] px-6 text-[0.9rem] font-semibold text-white transition-colors duration-150 hover:bg-[#36ba61] disabled:cursor-not-allowed disabled:bg-[#c4deb8]">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="block text-[0.8rem] font-semibold text-[#1a1e16]">{label}</Label>
      {children}
    </div>
  );
}
