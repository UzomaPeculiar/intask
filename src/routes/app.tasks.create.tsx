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
import { TASK_CATEGORIES, getSkillsForTaskCategory } from "@/lib/constants";
import { ArrowLeft, ArrowRight, FileText, ShieldCheck, Wallet, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";
import { getRuntimePlatformSettings } from "@/lib/platform-settings.functions";

export const Route = createFileRoute("/app/tasks/create")({
  head: () => ({
    meta: [{ title: "Post a task — InTask" }],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
  }),
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
  const [step, setStep] = useState(1);
  const [isTeamTask, setIsTeamTask] = useState(false);
  const [teamSize, setTeamSize] = useState(2);
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
    const allowedSkills = new Set(categorySkills);
    setSkills((prev) => prev.filter((skill) => allowedSkills.has(skill)));
  }, [category]);

  async function submit() {
    if (!title.trim()) return toast.error("Add a title");
    if (!category) return toast.error("Pick a category");
    if (!description.trim()) return toast.error("Describe the task");

    if (!negotiable && (!budget || Number(budget) < minTaskBudget)) {
      return toast.error(`Minimum task budget is ₦${minTaskBudget.toLocaleString("en-NG")}.`);
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return toast.error("Not signed in"); }

    const { data: subData } = await (supabase as any)
      .from("company_subscriptions")
      .select("*, plan:subscription_plans(max_active_posts)")
      .eq("company_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    const maxPosts = subData?.plan?.max_active_posts ?? 2;

    if (maxPosts !== 999) {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("poster_id", user.id)
        .eq("status", "open");

      if ((count ?? 0) >= maxPosts) {
        toast.error(`Your current plan allows ${maxPosts} active task${maxPosts === 1 ? "" : "s"}. Upgrade to post more.`);
        setLoading(false);
        return;
      }
    }

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
      is_team_task: isTeamTask,
      team_size: isTeamTask ? teamSize : 1,
    } as any ).select("id").single();
    setLoading(false);
    if (error || !data) return toast.error(error?.message ?? "Couldn't post");
    toast.success("Task posted");
    nav({ to: "/app/tasks/$taskId", params: { taskId: data.id } });
  }

  function validateStepOne() {
    if (!title.trim()) return toast.error("Add a title");
    if (!category) return toast.error("Pick a category");
    if (!description.trim()) return toast.error("Describe the task");
    return true;
  }

  function validateStepTwo() {
    if (!negotiable && (!budget || Number(budget) < minTaskBudget)) {
      toast.error(`Minimum task budget is ₦${minTaskBudget.toLocaleString("en-NG")}.`);
      return false;
    }
    return true;
  }

  function nextStep() {
    if (step === 1 && !validateStepOne()) return;
    if (step === 2 && !validateStepTwo()) return;
    setStep((prev) => Math.min(3, prev + 1));
  }

  function prevStep() {
    if (step === 1) {
      window.history.back();
      return;
    }
    setStep((prev) => Math.max(1, prev - 1));
  }

  const workTypeLabel = workType === "remote" ? "Remote" : workType === "on_campus" ? "On-campus" : "Either";
  const previewCategory = category || "Web Design";
  const previewTitle = title.trim() || "Landing page for fashion brand";
  const previewBudget = negotiable ? "Negotiable" : budget ? `₦${Number(budget).toLocaleString("en-NG")}` : "₦35,000";
  const previewDescription =
    description.trim() ||
    "Need a clean, mobile-first landing page with hero section, product showcase, and contact form.";

  const stepItems = [
    { id: 1, label: "Task details" },
    { id: 2, label: "Budget & deadline" },
    { id: 3, label: "Review & post" },
  ];

  return (
    <div className="min-h-screen bg-[#eff8ea] pb-24 text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_380px]">
        <main className="px-6 py-6 lg:px-12 lg:py-7">
          <button
            onClick={prevStep}
            type="button"
            className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-[#6a8064] hover:text-[#1a1e16]"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>

          <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1a1e16]">Post a task</h1>
          <p className="mb-7 mt-1 text-[0.85rem] text-[#6a8064]">Describe what you need and find the right student for the job.</p>

          <div className="mb-7 flex flex-wrap items-center gap-3">
            {stepItems.map((item, idx) => {
              const active = step === item.id;
              const done = step > item.id;
              return (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-7 w-7 place-items-center rounded-full text-[0.75rem] font-bold ${
                        active
                          ? "bg-[#3dcb6c] text-white"
                          : done
                            ? "bg-[rgba(61,203,108,0.2)] text-[#1a7a42]"
                            : "bg-[#e4efe0] text-[#9eb79c]"
                      }`}
                    >
                      {item.id}
                    </span>
                    <span className={`text-[0.75rem] font-medium ${active ? "text-[#1a1e16]" : "text-[#9eb79c]"}`}>{item.label}</span>
                  </div>
                  {idx < stepItems.length - 1 && <span className="h-px w-8 bg-[#e4efe0]" />}
                </div>
              );
            })}
          </div>

          {step === 1 && (
            <section className="rounded-2xl border border-[#c4deb8] bg-white p-6">
              <h2 className="mb-5 [font-family:'Space_Grotesk',sans-serif] text-base font-semibold text-[#1a1e16]">Task details</h2>

              <div className="mb-[18px]">
                <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">Task title</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Landing page for fashion brand"
                  className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] text-[0.85rem]"
                />
                <p className="mt-1 text-[0.7rem] text-[#9eb79c]">Be specific - a clear title attracts better applicants</p>
              </div>

              <div className="mb-[18px]">
                <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">Description</Label>
                <Textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you need done, any requirements, and deliverables..."
                  className="min-h-[120px] resize-y rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] px-3.5 py-3 text-[0.85rem]"
                />
              </div>

              <div className="mb-[18px] grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">Category</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-11 w-full rounded-[10px] border border-[#c4deb8] bg-[#f9fdf7] px-3.5 text-[0.85rem] outline-none focus:border-[#3dcb6c]"
                  >
                    <option value="">Select a category</option>
                    {TASK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">Work type</Label>
                  <select
                    value={workType}
                    onChange={(e) => setWorkType(e.target.value as "remote" | "on_campus" | "either")}
                    className="h-11 w-full rounded-[10px] border border-[#c4deb8] bg-[#f9fdf7] px-3.5 text-[0.85rem] outline-none focus:border-[#3dcb6c]"
                  >
                    <option value="remote">Remote</option>
                    <option value="on_campus">On-campus</option>
                    <option value="either">Either</option>
                  </select>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">
                  Skills needed <span className="font-normal text-[#9eb79c]">(optional)</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {categorySkills.map((sk) => {
                    const sel = skills.includes(sk);
                    return (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => setSkills(sel ? skills.filter((x) => x !== sk) : [...skills, sk])}
                        className={`rounded-full border px-3 py-1.5 text-[0.75rem] font-medium ${
                          sel ? "border-[#3dcb6c] bg-[#3dcb6c] text-white" : "border-[#c4deb8] bg-white text-[#1a1e16]"
                        }`}
                      >
                        {sk}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="rounded-2xl border border-[#c4deb8] bg-white p-6">
              <h2 className="mb-5 [font-family:'Space_Grotesk',sans-serif] text-base font-semibold text-[#1a1e16]">Budget & deadline</h2>

              <div className="mb-[18px]">
                <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">Budget (₦)</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6a8064]">₦</span>
                  <Input
                    type="number"
                    min={0}
                    value={budget}
                    disabled={negotiable}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 35000"
                    className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] pl-7 text-[0.85rem]"
                  />
                </div>
                <label className="mt-2 flex items-center justify-between rounded-[10px] border border-[#c4deb8] bg-white px-3 py-2.5 text-[0.8rem]">
                  <span>I&apos;m open to negotiation</span>
                  <Switch checked={negotiable} onCheckedChange={setNegotiable} />
                </label>
                {category && !negotiable && (
                  <p className="mt-2 text-[0.7rem] text-[#9eb79c]">
                    Suggested for {category}: ₦{(CATEGORY_MINIMUMS[category] || minTaskBudget).toLocaleString("en-NG")}+
                  </p>
                )}
              </div>

              <div className="mb-[18px]">
                <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">Deadline <span className="font-normal text-[#9eb79c]">(optional)</span></Label>
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="h-11 rounded-[10px] border-[#c4deb8] bg-[#f9fdf7] text-[0.85rem]"
                />
              </div>

              <div className="mb-[18px]">
                <Label className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">Team task <span className="font-normal text-[#9eb79c]">(optional)</span></Label>
                <label className="flex items-center justify-between rounded-[10px] border border-[#c4deb8] bg-white px-3 py-2.5 text-[0.8rem]">
                  <span>Hire multiple students for this task</span>
                  <Switch checked={isTeamTask} onCheckedChange={setIsTeamTask} />
                </label>
                {isTeamTask && (
                  <div className="mt-2">
                    <select
                      value={teamSize}
                      onChange={(e) => setTeamSize(Number(e.target.value))}
                      className="h-11 w-full rounded-[10px] border border-[#c4deb8] bg-[#f9fdf7] px-3.5 text-[0.85rem] outline-none"
                    >
                      {[2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n} students</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <p className="flex items-center gap-1.5 text-[0.7rem] text-[#6a8064]">
                <ShieldCheck className="size-3.5 text-[#1a7a42]" /> Held safely in escrow until work is approved
              </p>
              <div className="mt-3 rounded-[8px] border border-[#e4efe0] bg-[#f4fbf0] px-3 py-2 text-[0.7rem] text-[#6a8064]">
                <span className="font-semibold text-[#1a1e16]">Important:</span> once someone applies, you won&apos;t be able to edit this task. Double-check your details before posting.
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="rounded-2xl border border-[#c4deb8] bg-white p-6">
              <h2 className="mb-3 [font-family:'Space_Grotesk',sans-serif] text-base font-semibold text-[#1a1e16]">Review & post</h2>
              <p className="mb-5 text-[0.8rem] text-[#6a8064]">Confirm your listing details before posting.</p>
              <div className="rounded-xl border border-[#e4efe0] bg-[#f9fdf7] p-4 text-sm text-[#1a1e16]">
                <p><span className="font-semibold">Title:</span> {previewTitle}</p>
                <p className="mt-2"><span className="font-semibold">Category:</span> {previewCategory}</p>
                <p className="mt-2"><span className="font-semibold">Budget:</span> {previewBudget}</p>
                <p className="mt-2"><span className="font-semibold">Work type:</span> {workTypeLabel}</p>
                {deadline && <p className="mt-2"><span className="font-semibold">Deadline:</span> {deadline}</p>}
                {skills.length > 0 && <p className="mt-2"><span className="font-semibold">Skills:</span> {skills.join(", ")}</p>}
              </div>
            </section>
          )}

          <div className="mt-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => (step === 1 ? window.history.back() : prevStep())}
              className="h-12 rounded-[10px] border border-[#c4deb8] bg-white px-6 text-[0.9rem] font-semibold text-[#1a1e16]"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#3dcb6c] px-6 text-[0.9rem] font-semibold text-white"
              >
                Continue <ArrowRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={loading}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[#3dcb6c] px-6 text-[0.9rem] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#c4deb8]"
              >
                {loading ? "Posting..." : "Post task"}
              </button>
            )}
          </div>
        </main>

        <aside className="hidden h-full border-l border-[#c4deb8] bg-white px-6 py-7 lg:block">
          <p className="mb-3.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Live preview</p>
          <div className="rounded-2xl border border-[#c4deb8] bg-[linear-gradient(145deg,#f4fbf0,#eaf3f8)] p-5">
            <p className="text-[0.65rem] text-[#6a8064]">{previewCategory} · {workTypeLabel}</p>
            <h3 className="mt-1 [font-family:'Space_Grotesk',sans-serif] text-base font-semibold text-[#1a1e16]">{previewTitle}</h3>
            <p className="mt-2.5 [font-family:'Space_Grotesk',sans-serif] text-[1.3rem] font-bold text-[#1a7a42]">{previewBudget}</p>
            <p className="mt-2.5 text-[0.75rem] leading-[1.5] text-[#6a8064]">{previewDescription}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {(skills.length ? skills : ["HTML/CSS", "React"]).slice(0, 5).map((sk) => (
                <span key={sk} className="rounded-full bg-[#d8f5e4] px-2.5 py-0.5 text-[0.65rem] font-medium text-[#1a7a42]">
                  {sk}
                </span>
              ))}
            </div>
            <p className="mt-3.5 flex items-center gap-1.5 border-t border-[#e4efe0] pt-3 text-[0.7rem] text-[#6a8064]">
              <ShieldCheck className="size-3.5" /> Held safely in escrow until work is approved
            </p>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#9eb79c]">Tips for a great listing</p>
            <div className="space-y-2">
              <div className="rounded-[10px] border border-[#e4efe0] bg-[#f9fdf7] p-3">
                <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#1a1e16]"><FileText className="size-3.5" /> Be specific</p>
                <p className="mt-1 text-[0.7rem] leading-[1.4] text-[#6a8064]">Clear descriptions attract better applicants and reduce back-and-forth.</p>
              </div>
              <div className="rounded-[10px] border border-[#e4efe0] bg-[#f9fdf7] p-3">
                <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#1a1e16]"><Wallet className="size-3.5" /> Set a fair budget</p>
                <p className="mt-1 text-[0.7rem] leading-[1.4] text-[#6a8064]">Research similar tasks to price competitively. You can mark budget as negotiable.</p>
              </div>
              <div className="rounded-[10px] border border-[#e4efe0] bg-[#f9fdf7] p-3">
                <p className="flex items-center gap-1.5 text-[0.75rem] font-semibold text-[#1a1e16]"><CalendarDays className="size-3.5" /> Set a realistic deadline</p>
                <p className="mt-1 text-[0.7rem] leading-[1.4] text-[#6a8064]">Give students enough time to deliver quality work.</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
