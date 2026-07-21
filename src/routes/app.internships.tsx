import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { EmptyState } from "@/components/intask/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowLeft, Briefcase, Search, Clock, MapPin, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/internships")({
  head: () => ({ meta: [{ title: "Internships — InTask" }] }),
  component: InternshipsPage,
});

const INTERNSHIP_CATEGORIES = [
  "All", "Tech", "Design", "Business", "Finance", "Marketing",
  "Engineering", "Media", "Health", "Education", "Other",
];

function InternshipsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("All");
  const [showPost, setShowPost] = useState(false);

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

  const { data: internships, isLoading, refetch } = useQuery({
    queryKey: ["internships", q, category],
    queryFn: async () => {
      let query = (supabase as any)
        .from("internships")
        .select("*, poster:profiles!internships_poster_id_fkey(id, full_name)")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myApplications } = useQuery({
    queryKey: ["my-internship-apps", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("internship_applications")
        .select("internship_id, status")
        .eq("student_id", me!.id);
      const map: Record<string, string> = {};
      for (const a of data ?? []) map[a.internship_id] = a.status;
      return map;
    },
  });

  const canPost = myProfile?.role === "company" || myProfile?.role === "individual" || myProfile?.role === "alumni";
  const canApply = myProfile?.role === "student" || myProfile?.role === "alumni";

  const apply = useMutation({
    mutationFn: async ({ internshipId, coverLetter, resumeUrl }: { internshipId: string; coverLetter: string; resumeUrl?: string }) => {
      if (!me) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("internship_applications")
        .insert({ internship_id: internshipId, student_id: me.id, cover_letter: coverLetter, resume_url: resumeUrl ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application submitted successfully");
      qc.invalidateQueries({ queryKey: ["my-internship-apps"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not submit application"),
  });

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-lg font-semibold">Internships</h1>
        </div>
        {canPost && (
          <Button size="sm" className="gap-1" onClick={() => setShowPost(true)}>
            <Plus className="size-3.5" /> Post
          </Button>
        )}
      </header>

      <div className="px-4 pt-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search internships..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {INTERNSHIP_CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        )}

        {!isLoading && (internships?.length ?? 0) === 0 && (
          <EmptyState icon={Briefcase} title="No internships yet" description={canPost ? "Be the first to post an internship opportunity." : "Check back soon for new opportunities."} action={canPost ? <Button onClick={() => setShowPost(true)} className="gap-1"><Plus className="size-3.5" /> Post internship</Button> : undefined} />
        )}

        <div className="space-y-4">
          {internships?.map((i: any) => {
            const appStatus = myApplications?.[i.id];
            return (
              <div key={i.id} className="rounded-xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground line-clamp-2">{i.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{i.company_name}</p>
                  </div>
                  {i.paid && (
                    <span className="shrink-0 rounded-md bg-success/15 px-2 py-0.5 text-sm font-semibold text-success">
                      {i.stipend_negotiable ? "Negotiable" : i.stipend > 0 ? `₦${Number(i.stipend).toLocaleString("en-NG")}/mo` : "Paid"}
                    </span>
                  )}
                  {!i.paid && (
                    <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-sm text-muted-foreground">Unpaid</span>
                  )}
                </div>

                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{i.description}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="size-3" /> {i.location}</span>
                  <span className="flex items-center gap-1"><Clock className="size-3" /> {i.duration}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5">{i.work_type}</span>
                </div>

                {i.skills_needed?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {i.skills_needed.slice(0, 3).map((s: string) => (
                      <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <InitialsAvatar name={i.poster?.full_name} size={24} />
                    <span className="text-xs text-muted-foreground">{i.company_name}</span>
                  </div>
                  {canApply && (
                    appStatus ? (
                      <span className="text-xs font-medium text-success">Applied ✓</span>
                    ) : (
                      <ApplyInternshipSheet internshipId={i.id} title={i.title} onApply={(coverLetter, resumeUrl) => apply.mutate({ internshipId: i.id, coverLetter, resumeUrl })} isPending={apply.isPending} />
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {canPost && <PostInternshipSheet open={showPost} onClose={() => setShowPost(false)} posterId={me?.id ?? ""} onSuccess={() => { setShowPost(false); refetch(); }} />}
    </div>
  );
}

function ApplyInternshipSheet({ internshipId, title, onApply, isPending }: { internshipId: string; title: string; onApply: (coverLetter: string, resumeUrl?: string) => void; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false)

  async function handleSubmit() {
    if (!coverLetter.trim()) {
      toast.error("Please write a cover letter");
      return;
    }
    let finalResumeUrl = resumeUrl.trim() || undefined;
    if (resumeFile) {
      setUploading(true);
      const { data: me } = await supabase.auth.getUser();
      const fileExt = resumeFile.name.split(".").pop();
      const filePath = `${me.user?.id}/resume.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(filePath, resumeFile, { upsert: true });
      setUploading(false);
      if (uploadError) {
        toast.error("Resume upload failed. Please try again.");
        return;
      }
      const { data: signedData } = await supabase.storage
        .from("resumes")
        .createSignedUrl(filePath, 60 * 60 * 24 * 7);
      finalResumeUrl = signedData?.signedUrl;
    }
    onApply(coverLetter, finalResumeUrl);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">Apply</Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Apply for internship</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6 pt-2">
          <p className="text-sm text-muted-foreground">{title}</p>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Cover letter</label>
            <textarea 
              rows={5} 
              value={coverLetter} 
              onChange={(e) => setCoverLetter(e.target.value)} 
              placeholder="Tell them why you are a great fit for this internship. Mention relevant skills, projects, and what you hope to learn..." 
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" 
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Resume</label>
            <div className="space-y-2">
              <div
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => document.getElementById("resume-upload")?.click()}
              >
                {resumeFile ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-success">✓ {resumeFile.name}</p>
                    <p className="text-xs text-muted-foreground">Tap to change</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Upload your resume</p>
                    <p className="text-xs text-muted-foreground">PDF or Word · Max 5MB</p>
                  </div>
                )}
              </div>
              <input
                id="resume-upload"
                type="file"
                accept=".pdf,.doc,.docx"
                className="hidden"
                onChange={(e) => { setResumeFile(e.target.files?.[0] ?? null); setResumeUrl(""); }}
              />
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or paste a link</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <Input
                value={resumeUrl}
                onChange={(e) => { setResumeUrl(e.target.value); setResumeFile(null); }}
                placeholder="e.g. https://drive.google.com/your-resume"
              />
            </div>
          </div>

          <p className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg bg-muted/50 p-3">
            <ShieldCheck className="size-4 text-success shrink-0" />
            Your InTask profile will be shared with the employer alongside your application.
          </p>

          <Button className="w-full" size="lg" disabled={!coverLetter.trim() || isPending || uploading} onClick={handleSubmit}>
            {uploading ? "Uploading resume..." : isPending ? "Submitting..." : "Submit application"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PostInternshipSheet({ open, onClose, posterId, onSuccess }: { open: boolean; onClose: () => void; posterId: string; onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [location, setLocation] = useState("");
  const [workType, setWorkType] = useState("remote");
  const [duration, setDuration] = useState("");
  const [paid, setPaid] = useState(true);
  const [stipend, setStipend] = useState("");
  const [stipendNegotiable, setStipendNegotiable] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!title.trim() || !companyName.trim() || !description.trim() || !location.trim() || !duration.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("internships").insert({
      poster_id: posterId,
      title: title.trim(),
      company_name: companyName.trim(),
      description: description.trim(),
      requirements: requirements.trim() || null,
      location: location.trim(),
      work_type: workType,
      duration: duration.trim(),
      paid,
      stipend: paid && stipend ? Number(stipend) : 0,
      stipend_negotiable: stipendNegotiable,
      deadline: deadline || null,
      status: "open",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Internship posted successfully");
    onSuccess();
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle>Post an internship</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Internship title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Frontend Developer Intern" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Company name *</label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. TechStartup Lagos" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Description *</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the internship role and responsibilities..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Requirements (optional)</label>
            <textarea rows={2} value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="Skills, tools, or qualifications needed..." className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Location *</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lagos, Nigeria" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Duration *</label>
              <Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 3 months" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Work type</label>
            <select value={workType} onChange={(e) => setWorkType(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="remote">Remote</option>
              <option value="on-site">On-site</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <label className="flex items-center justify-between rounded-lg border border-border bg-card p-3 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Paid internship</p>
              <p className="text-xs text-muted-foreground">Does this internship offer a stipend?</p>
            </div>
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="size-4" />
          </label>
          {paid && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Monthly stipend (₦)</label>
                <Input type="number" value={stipend} onChange={(e) => setStipend(e.target.value)} placeholder="e.g. 30000" />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={stipendNegotiable} onChange={(e) => setStipendNegotiable(e.target.checked)} className="size-3.5" />
                  Negotiable
                </label>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Application deadline (optional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <Button className="w-full" size="lg" disabled={saving} onClick={submit}>
            {saving ? "Posting..." : "Post internship"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}