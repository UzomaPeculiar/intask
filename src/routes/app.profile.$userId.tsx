import { Wallet } from "lucide-react";
import { Award } from "lucide-react";
import { Share2 } from "lucide-react";
import { ReportButton } from "@/components/intask/ReportButton";
import { Link } from "@tanstack/react-router";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { SKILLS, NIGERIAN_UNIVERSITIES, YEARS_OF_STUDY } from "@/lib/constants";
import { ArrowLeft, LogOut, Star, Briefcase, Edit3, Save, Plus, ExternalLink, Trash2, FolderGit2, GraduationCap, Mail, Phone, Building2, MapPin, Globe } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile/$userId")({
  head: () => ({ meta: [{ title: "Profile — InTask" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { userId } = Route.useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  const targetId = userId === "me" ? user?.id : userId;
  const isOwn = !!(user?.id && targetId && user.id === targetId);
  console.log("isOwn:", isOwn, "user:", user?.id, "targetId:", targetId);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  const { data: meData } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });
  const me = meData;

  const { data: skillBadges } = useQuery({
    queryKey: ["skill-badges", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("student_skill_badges")
        .select("skill, score, passed, earned_at")
        .eq("user_id", targetId)
        .eq("passed", true);
      return data ?? [];
    },
  });
  
  const { data, isLoading } = useQuery({
    queryKey: ["profile", targetId],
    enabled: !!targetId,
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, bio, role, email, phone, created_at, updated_at")
        .eq("id", targetId!)
        .maybeSingle();
      if (profileError) throw profileError;

      let student = null;
      let company = null;
      if (profile?.role === "student" || profile?.role === "alumni") {
        const { data, error } = await supabase
          .from("student_profiles")
          .select("user_id, department, portfolio, rating_average, rating_count, skills, tasks_completed, university, verified, year_of_study, verification_method, created_at, updated_at")
          .eq("user_id", targetId!)
          .maybeSingle();
        if (error) throw error;
        student = data as any;
      }
      if (profile?.role === "company") {
        const { data, error } = await supabase
          .from("company_profiles")
          .select("*")
          .eq("user_id", targetId!)
          .maybeSingle();
        if (error) throw error;
        company = data as any;
      }

      const { data: reviews } = await supabase
        .from("reviews")
        .select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name), task:tasks(title)")
        .eq("reviewee_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(20);

      return { profile: profile as any, student, company, reviews: reviews ?? [] };
    },
  });
  const { data: postedTasks } = useQuery({
    queryKey: ["profile-tasks", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, title, budget, budget_negotiable, category, status, created_at")
        .eq("poster_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const { data: alumniProSub } = useQuery({
    queryKey: ["alumni-pro-sub", targetId],
    enabled: !!targetId && data?.profile?.role === "alumni",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("alumni_pro_subscriptions")
        .select("id, status")
        .eq("alumni_id", targetId!)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const [editing, setEditing] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  if (isLoading && !timedOut) {
    return <div className="grid min-h-[60vh] place-items-center text-muted-foreground">Loading profile…</div>;
  }

  const fallbackProfile = {
    id: user?.id ?? "",
    full_name: "",
    avatar_url: null,
    bio: null,
    role: "individual" as const,
    email: null,
    phone: null,
    created_at: null,
    updated_at: null,
  };
  const resolved = data ?? { profile: fallbackProfile, student: null, company: null, reviews: [] };
  const { profile, student, company, reviews } = resolved;
  const isStudent = profile.role === "student";
  const isAlumni = profile.role === "alumni";
  const isStudentOrAlumni = isStudent || isAlumni;
  const isCompany = profile.role === "company";
  const isIndividual = profile.role === "individual";
  const fromBottomNav = userId === "me";

  async function upgradeToAlumni() {
    setUpgrading(true);
    const { error } = await supabase.from("profiles").update({ role: "alumni" }).eq("id", profile.id);
    setUpgrading(false);
    if (error) { toast.error(error.message); return; }
    setUpgradeOpen(false);
    toast.success("Welcome to InTask Alumni. Your profile and history are all still here.");
    qc.invalidateQueries({ queryKey: ["profile", targetId] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center justify-between gap-2 px-4 pt-4">
        {fromBottomNav ? (
          <div />
        ) : (
          <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-border bg-card">
            <ArrowLeft className="size-4" />
          </button>
        )}
        {isOwn && (
          <button onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            <LogOut className="size-4" /> Sign out
          </button>
        )}
      </header>

      <section className="px-4 pt-5">
        <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4 shadow-sm">
          <div className="flex items-center gap-3">
          <InitialsAvatar name={profile.full_name} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold tracking-tight">{profile.full_name}</h1>
            {isStudentOrAlumni && student?.university && (
              <p className="truncate text-sm text-muted-foreground">{student.university} {student.year_of_study ? `· ${student.year_of_study}` : ""}</p>
            )}
            {isCompany && company?.company_name && (
              <p className="truncate text-sm text-muted-foreground">{company.company_name}</p>
            )}
            <div className="mt-1.5"><VerifiedBadge role={profile.role} verified={student?.verified} isPro={!!alumniProSub} /></div>
              {isOwn && profile.role === "student" && student?.verification_method === "id_upload" && !student?.verified && (
                <ReuploadIDSection userId={profile.id} />
              )}
          </div>
          </div>
        </div>
        {isStudentOrAlumni && (
          <div className="mt-3 flex items-center gap-4 text-sm">
            {(student?.rating_count ?? 0) > 0 ? (
              <span className="inline-flex items-center gap-1"><Star className="size-4 fill-warning text-warning" />{Number(student?.rating_average ?? 0).toFixed(1)} ({student?.rating_count ?? 0})</span>
            ) : (
              <span className="text-muted-foreground">No ratings yet</span>
            )}
            <span className="inline-flex items-center gap-1 text-muted-foreground"><Briefcase className="size-4" /> {student?.tasks_completed ?? 0} done</span>
          </div>
        )}

        {profile.bio && !editing && <p className="mt-4 text-sm text-foreground/90">{profile.bio}</p>}

        {/* Details for individual / company */}
        {!editing && (isIndividual || isCompany) && (
          <div className="mt-4 space-y-2 rounded-2xl border border-border/80 bg-card/90 p-3 text-sm shadow-sm">
            {isCompany && company?.company_name && (
              <Row icon={<Building2 className="size-4" />} label="Business" value={company.company_name} />
            )}
            {isCompany && company?.industry && (
              <Row icon={<Briefcase className="size-4" />} label="Industry" value={company.industry} />
            )}
            {isCompany && company?.location && (
              <Row icon={<MapPin className="size-4" />} label="Location" value={company.location} />
            )}
            {isCompany && company?.website && (
              <Row icon={<Globe className="size-4" />} label="Website" value={
                <a href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                  {company.website}
                </a>
              } />
            )}
            {isOwn && profile.email && (
              <Row icon={<Mail className="size-4" />} label="Email" value={profile.email} />
            )}
            {isOwn && profile.phone && (
              <Row icon={<Phone className="size-4" />} label="Phone" value={profile.phone} />
            )}
          </div>
        )}

        {isOwn && !editing && (
          <div className="mt-4 flex flex-col items-start gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1" 
              onClick={() => setEditing(true)}
            >
              <Edit3 className="size-3.5" /> Edit profile
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                const url = `${window.location.origin}/app/profile/${targetId}`;
                navigator.clipboard.writeText(url);
                toast.success("Profile link copied to clipboard");
              }}
            >
              <Share2 className="size-3.5" /> Share profile
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => nav({ to: "/app/assessments" as any })}
            >
              <Award className="size-3.5" /> Take skill assessments
            </Button>
            
            {(profile.role === "student" || profile.role === "alumni") && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => nav({ to: "/app/wallet" as any })}
              >   
                <Wallet className="size-3.5" /> My wallet
              </Button>
            )}
            
            {isStudent && (
              <button 
                onClick={() => setUpgradeOpen(true)} 
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <GraduationCap className="size-3.5" /> 
                Have you graduated? Upgrade to Alumni →
              </button>
            )}
          </div>
        )}
        {!isOwn && !!user && profile && (
          <div className="mt-4">
            <ReportButton reportedId={profile.id} reportedName={profile.full_name ?? "this user"} />
          </div>
        )}
      </section>

      {isOwn && editing && (
        <EditPanel profile={profile} student={student} company={company} onDone={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["profile", targetId] }); }} />
      )}

      {isStudentOrAlumni && student && (student.skills?.length ?? 0) > 0 && (
        <section className="px-4 pt-6">
          <h2 className="text-sm font-semibold">Skills</h2>
          {skillBadges && skillBadges.length > 0 && (
            <div className="mt-2 mb-3">
              <p className="text-xs text-muted-foreground mb-2">Verified badges</p>
              <div className="flex flex-wrap gap-2">
                {skillBadges.map((b: any) => (
                  <span key={b.skill} className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
                    <Award className="size-3" /> {b.skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {isStudentOrAlumni && targetId && (
        <ProjectsSection userId={targetId} isOwn={!!isOwn} />
      )}

      <section className="px-4 pt-6">
        <h2 className="text-sm font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No reviews yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.reviewer?.full_name ?? "Anonymous"}</p>
                  <span className="inline-flex items-center gap-0.5 text-sm">
                    {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-3.5 fill-warning text-warning" />)}
                  </span>
                </div>
                {r.task?.title && <p className="mt-0.5 text-xs text-muted-foreground">{r.task.title}</p>}
                {r.comment && <p className="mt-2 text-sm text-foreground/90">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <PostedTasksSection tasks={postedTasks ?? []} />

      <Sheet open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Upgrade to Alumni</SheetTitle>
            <SheetDescription>
              Upgrading your account to Alumni keeps all your reviews, portfolio, and earnings history. Your badge will change from Verified Student to Alumni and you will gain access to mentorship features. This cannot be undone.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4 flex-col gap-2 sm:flex-col">
            <Button onClick={upgradeToAlumni} disabled={upgrading}>{upgrading ? "Upgrading…" : "Upgrade my account"}</Button>
            <Button variant="ghost" onClick={() => setUpgradeOpen(false)}>Cancel</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <div className="truncate text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

function EditPanel({ profile, student, company, onDone }: any) {
  const isStudentOrAlumni = profile.role === "student" || profile.role === "alumni";
  const isCompany = profile.role === "company";
  const isIndividual = profile.role === "individual";

  const [bio, setBio] = useState(profile.bio ?? "");
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  const [skills, setSkills] = useState<string[]>(student?.skills ?? []);
  const [university, setUniversity] = useState(student?.university ?? "");
  const [year, setYear] = useState(student?.year_of_study ?? "");
  const [department, setDepartment] = useState(student?.department ?? "");

  const [companyName, setCompanyName] = useState(company?.company_name ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [location, setLocation] = useState(company?.location ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");

  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const profileUpdate: any = { bio: bio.slice(0, 200) || null };
    if (isIndividual || isCompany) {
      profileUpdate.full_name = fullName.trim() || profile.full_name;
      profileUpdate.email = email.trim() || null;
      profileUpdate.phone = phone.trim() || null;
    }
    const { error: pErr } = await supabase.from("profiles").update(profileUpdate).eq("id", profile.id);
    if (pErr) { toast.error(pErr.message); setSaving(false); return; }

    if (isStudentOrAlumni) {
      await supabase.from("student_profiles").update({
        skills, university: university || null, year_of_study: year || null, department: department || null,
      }).eq("user_id", profile.id);
    }
    if (isCompany) {
      await supabase.from("company_profiles").upsert({
        user_id: profile.id,
        company_name: companyName.trim() || profile.full_name,
        industry: industry.trim() || null,
        location: location.trim() || null,
        website: website.trim() || null,
      });
    }
    setSaving(false);
    toast.success("Profile saved");
    onDone();
  }

  return (
    <section className="space-y-4 px-4 pt-4">
      {(isIndividual || isCompany) && (
        <>
          {isCompany && (
            <div className="space-y-1.5">
              <Label>Business or organisation name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone number</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          {isCompany && (
            <>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Fintech, Education, Media" />
              </div>
              <div className="space-y-1.5">
                <Label>City and location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lagos, Nigeria" />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
              </div>
            </>
          )}
        </>
      )}

      <div className="space-y-1.5">
        <Label>{isStudentOrAlumni ? "Short bio (max 150 chars)" : "Bio (optional)"}</Label>
        <Textarea
          rows={3}
          maxLength={isStudentOrAlumni ? 150 : 200}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={
            isCompany
              ? "Tell students about your business and the kind of work you typically post."
              : isIndividual
              ? "Tell students a bit about yourself and what you need help with."
              : "Tell posters what you do and what makes you good at it."
          }
        />
      </div>

      {isStudentOrAlumni && (
        <>
          <div className="space-y-1.5">
            <Label>University</Label>
            <select value={university} onChange={(e) => setUniversity(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Select…</option>
              {NIGERIAN_UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Year</Label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">—</option>
                {YEARS_OF_STUDY.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-1.5">
              {SKILLS.map((sk) => {
                const sel = skills.includes(sk);
                return (
                  <button key={sk} type="button" onClick={() => setSkills(sel ? skills.filter((x) => x !== sk) : [...skills, sk])}
                    className={`rounded-full border px-2.5 py-1 text-xs ${sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}>
                    {sk}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
      <div className="flex gap-2">
        <Button className="flex-1 gap-1" onClick={save} disabled={saving}><Save className="size-4" />{saving ? "Saving…" : "Save"}</Button>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
      </div>
    </section>
  );
}

function ProjectsSection({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  const { data: projects } = useQuery({
    queryKey: ["projects", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_projects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function startEdit(p: any) {
    setTitle(p.title);
    setDescription(p.description ?? "");
    setLink(p.link ?? "");
    setEditingProject(p);
    setAdding(true)
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    if (editingProject) {
      const { error } = await supabase
        .from("student_projects")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          link: link.trim() || null,
        })
        .eq("id", editingProject.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Project updated");
    } else {
      const { error } = await supabase.from("student_projects").insert({
        user_id: userId,
        title: title.trim(),
        description: description.trim() || null,
        link: link.trim() || null,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Project added");
    }
    setTitle(""); 
    setDescription(""); 
    setLink(""); setAdding(false);
    setAdding(false);
    setEditingProject(null);
    qc.invalidateQueries({ queryKey: ["projects", userId] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("student_projects").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["projects", userId] });
  }

  return (
    <section className="px-4 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Projects</h2>
        {isOwn && !adding && (
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add project
          </Button>
        )}
      </div>

      {adding && (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="space-y-1.5">
            <Label>Project title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Campus delivery app" />
          </div>
          <div className="space-y-1.5">
            <Label>Short description (max 200 chars)</Label>
            <Textarea rows={3} maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>External link (optional)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="e.g., GitHub or live URL" />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editingProject ? "Update project" : "Save project"}
            </Button>
            <Button variant="outline" onClick={() => { 
              setAdding(false); 
              setTitle(""); 
              setDescription(""); 
              setLink(""); 
              setEditingProject(null);
            }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {(!projects || projects.length === 0) && !adding && (
        <div className="mt-3 rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center">
          <div className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <FolderGit2 className="size-5" />
          </div>
          <p className="mt-3 text-sm font-medium">No projects yet</p>
          {isOwn && (
            <Button size="sm" className="mt-3 gap-1" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> Add project
            </Button>
          )}
        </div>
      )}

      {projects && projects.length > 0 && (
        <ul className="mt-3 space-y-2">
          {projects.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{p.title}</p>
                {isOwn && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(p)}
                      aria-label="Edit project"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Edit3 className="size-4" />
                    </button>
                    <button 
                      onClick={() => remove(p.id)}
                      aria-label="Delete project" 
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                )}
                </div>
                {p.description && <p className="mt-1 text-sm text-foreground/80">{p.description}</p>}
                {p.link && (
                  <a 
                    href={/^https?:\/\//.test(p.link) ? p.link : `https://${p.link}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    <ExternalLink className="size-3" /> View
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
}

function PostedTasksSection({ tasks }: { tasks: any[] }) {
  if (!tasks || tasks.length === 0) return null;
  return (
    <section className="px-4 pt-6">
      <h2 className="text-sm font-semibold">Posted tasks</h2>
      <ul className="mt-3 space-y-2">
        {tasks.map((t) => (
          <li key={t.id}>
            <Link to="/app/tasks/$taskId" params={{ taskId: t.id }} className="block">
              <div className="rounded-xl border border-border bg-card p-3 shadow-card transition-colors active:bg-accent/50">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{t.title}</p>
                  <span className="shrink-0 rounded-md bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                    {t.budget_negotiable ? "Open" : `₦${Number(t.budget).toLocaleString("en-NG")}`}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">{t.category}</span>
                  <span className={`rounded-full px-2 py-0.5 ${
                    t.status === "open" ? "bg-primary/10 text-primary" :
                    t.status === "completed" ? "bg-muted text-muted-foreground" :
                    "bg-success/15 text-success"
                  }`}>
                    {t.status === "open" ? "Open" : t.status === "completed" ? "Completed" : "In progress"}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReuploadIDSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [idFile, setIdFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleReupload() {
    if (!idFile) return;
    setUploading(true);
    const fileExt = idFile.name.split(".").pop();
    const filePath = `${userId}/student-id.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("student-ids")
      .upload(filePath, idFile, { upsert: true });
    if (uploadError) {
      toast.error("Upload failed. Please try again.");
      setUploading(false);
      return;
    }
    const { error: updateError } = await supabase
       .from("student_profiles")
       .update({
         id_upload_path: filePath,
         verification_status: "pending",
       } as any)
       .eq("user_id", userId);
     if (updateError) {
       toast.error("Could not submit for review. Please try again.");
       setUploading(false);
       return;
     }
     toast.success("ID re-submitted for review. We will notify you once verified.");
     setIdFile(null);
     setUploading(false);
     qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <div className="mt-3 rounded-xl border border-warning/30 bg-warning/10 p-4 space-y-3">
       <div>
         <p className="text-sm font-medium text-warning">Verification pending</p>
         <p className="text-xs text-muted-foreground mt-0.5">
           Your student ID is under review. If it was rejected, upload a clearer photo below.
         </p>
       </div>
       <div
         className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-warning/30 bg-background p-4 text-center cursor-pointer hover:border-warning/60 transition-colors"
         onClick={() => document.getElementById("reupload-id-input")?.click()}
       >
         {idFile ? (
           <div className="space-y-1">
             <p className="text-sm font-medium text-success">✓ {idFile.name}</p>
             <p className="text-xs text-muted-foreground">Tap to change</p>
           </div>
         ) : (
           <div className="space-y-1">
             <p className="text-sm text-muted-foreground">Tap to upload a new ID photo</p>
             <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
           </div>
         )}
       </div>
       <input
         id="reupload-id-input"
         type="file"
         accept="image/jpeg,image/png,application/pdf"
         className="hidden"
         onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
       />
       <Button
         className="w-full"
         disabled={!idFile || uploading}
         onClick={handleReupload}
       >
         {uploading ? "Uploading..." : "Submit for review"}
       </Button>
    </div>
  );
}
