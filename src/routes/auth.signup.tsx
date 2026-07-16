import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, GraduationCap, Briefcase, User, CheckCircle2, Upload, ArrowRight, ArrowLeft, Award } from "lucide-react";
import { NIGERIAN_UNIVERSITIES, YEARS_OF_STUDY, SKILLS, NG_PHONE_REGEX } from "@/lib/constants";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Sign up — InTask" }] }),
  component: SignupPage,
});

type Role = "student" | "alumni" | "company" | "individual";

interface SignupState {
  role: Role | null;
  // account
  full_name: string;
  email: string;
  phone: string;
  password: string;
  // student / alumni
  university: string;
  department: string;
  year_of_study: string;
  university_email: string;
  graduation_year: string;
  verification_method: "email" | "id_upload" | null;
  skills: string[];
  // company
  company_name: string;
  industry: string;
  city: string;
  website: string;
}

function Stepper({ current, total }: { current: number; total: number }) {
  if (!current || current < 1) return null;
  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const active = i + 1 === current;
        const done = i + 1 < current;
        return (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              active ? "w-8 bg-primary" : done ? "w-2 bg-primary/60" : "w-2 bg-muted"
            }`}
          />
        );
      })}
    </div>
  );
}

function SignupPage() {
  const nav = useNavigate();
  const [idFile, setIdFile] = useState<File | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState<SignupState>({
    role: null,
    full_name: "",
    email: "",
    phone: "",
    password: "",
    university: "",
    department: "",
    year_of_study: "",
    university_email: "",
    graduation_year: "",
    verification_method: null,
    skills: [],
    company_name: "",
    industry: "",
    city: "",
    website: "",
  });

  const isStudent = s.role === "student";
  const isAlumni = s.role === "alumni";
  const isCompany = s.role === "company";
  const isIndividual = s.role === "individual";

  // Per-role stepper config. Welcome screen is hidden from stepper.
  function stepInfo(): { current: number | null; total: number } {
    if (s.role === "student") {
      // 1=role(hide), 2=account, 3=uni, 4=verify, 5=skills, 6=welcome(hide)
      if (step === 1 || step === 6) return { current: null, total: 4 };
      return { current: step - 1, total: 4 };
    }
    if (s.role === "alumni") {
      // 1=role(hide), 2=account, 3=grad, 4=skills, 5=welcome
      if (step === 1) return { current: null, total: 4 };
      return { current: step - 1, total: 4 };
    }
    if (s.role === "individual") return { current: step, total: 2 };
    if (s.role === "company") return { current: step, total: 3 };
    return { current: null, total: 1 };
  }
  const sinfo = stepInfo();

  function set<K extends keyof SignupState>(k: K, v: SignupState[K]) {
    setS((p) => ({ ...p, [k]: v }));
  }

  function next() { setStep((n) => n + 1); }
  function back() { setStep((n) => Math.max(1, n - 1)); }

  function validAccount() {
    if (!s.full_name.trim()) return isCompany ? "Enter your business name" : "Enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return "Enter a valid email";
    if (!NG_PHONE_REGEX.test(s.phone.replace(/\s+/g, ""))) return "Enter a valid Nigerian phone number";
    if (s.password.length < 8) return "Password must be at least 8 characters";
    return null;
  }

  async function createAccount() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: s.email,
      password: s.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { full_name: s.full_name },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return false; }
    if (!data.user) { toast.error("Couldn't create account"); return false; }
    return true;
  }

  async function finalizeProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const role = s.role ?? "student";
    await supabase.from("profiles").upsert({
      id: user.id,
      full_name: s.full_name,
      email: s.email,
      phone: s.phone,
      role,
    });
    if (isStudent) {
      let idUploadPath = null;

      if (s.verification_method === "id_upload" && idFile) {
        const fileExt = idFile.name.split(".").pop();
        const filePath = `${user.id}/student-id.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("student-ids")
          .upload(filePath, idFile, { upsert: true });
        if (!uploadError) {
          idUploadPath = filePath;
        }
      }

      await supabase.from("student_profiles").upsert({
        user_id: user.id,
        university: s.university || null,
        department: s.department || null,
        year_of_study: s.year_of_study || null,
        university_email: s.university_email || null,
        skills: s.skills,
        verification_method: s.verification_method ?? "email",
        verified: s.verification_method === "email",
        verification_status: s.verification_method === "email" ? "approved" : "pending",
        id_upload_path: idUploadPath,
        rating_average: 0,
        rating_count: 0,
        tasks_completed: 0,
      });
    } else if (isAlumni) {
      await supabase.from("student_profiles").upsert({
        user_id: user.id,
        university: s.university || null,
        department: s.department || null,
        year_of_study: s.graduation_year ? `Class of ${s.graduation_year}` : "Alumni",
        skills: s.skills,
        verification_method: "id_upload",
        verified: false, // alumni unverified — pending review
        rating_average: 0,
        rating_count: 0,
        tasks_completed: 0,
      });
    } else if (isCompany) {
      await supabase.from("company_profiles").upsert({
        user_id: user.id,
        company_name: s.company_name || s.full_name,
        industry: s.industry || null,
        location: s.city || null,
        website: s.website || null,
        verified: false,
      });
    }
  }

  async function handleAccountSubmit() {
    const err = validAccount();
    if (err) return toast.error(err);
    const ok = await createAccount();
    if (!ok) return;
    if (isIndividual) {
      setLoading(true);
      await finalizeProfile();
      setLoading(false);
      toast.success("Welcome! Post your first task to get started.");
      nav({ to: "/app" });
      return;
    }
    next();
  }

  async function handleStudentFinish() {
    setLoading(true);
    await finalizeProfile();
    setLoading(false);
    next(); // welcome
  }

  async function handleAlumniFinish() {
    setLoading(true);
    await finalizeProfile();
    setLoading(false);
    next(); // welcome
  }

  async function handleCompanyFinish() {
    if (!s.company_name.trim()) return toast.error("Enter your company or organization name");
    setLoading(true);
    await finalizeProfile();
    setLoading(false);
    toast.success("Account created — verification pending");
    nav({ to: "/app" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><Sparkles className="size-4" /></span>
            InTask
          </Link>
          {step > 1 && (
            <button onClick={back} aria-label="Back" className="text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /></button>
          )}
        </div>
        {sinfo.current && (
          <div className="mx-auto max-w-md px-4 pb-4">
            <Stepper current={sinfo.current} total={sinfo.total} />
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        {/* STEP 1 — Role selection (4 roles) */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">How will you use InTask?</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pick the option that fits you best.</p>
            <div className="mt-6 space-y-3">
              <RoleCard icon={GraduationCap} title="I'm a student" desc="I want to find work and get paid for my skills." selected={s.role === "student"} onClick={() => set("role", "student")} />
              <RoleCard icon={User} title="I want to post a task" desc="I need help from a student with a project." selected={s.role === "individual"} onClick={() => set("role", "individual")} />
              <RoleCard icon={Award} title="I'm alumni" desc="I graduated and want to keep working and earning." selected={s.role === "alumni"} onClick={() => set("role", "alumni")} />
              <RoleCard icon={Briefcase} title="I'm a company or business" desc="I want to hire verified students for tasks." selected={s.role === "company"} onClick={() => set("role", "company")} />
            </div>
            <Button size="lg" className="mt-6 w-full" disabled={!s.role} onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Already have an account? <Link to="/auth/login" className="font-medium text-primary hover:underline">Log in</Link>
            </p>
          </div>
        )}

        {/* STEP 2 — Account creation */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{isCompany ? "Create your business account" : "Create your account"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Start in less than a minute.</p>

            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">{isCompany ? "Business name" : "Full name"}</Label>
                <Input id="name" value={isCompany ? s.company_name : s.full_name} onChange={(e) => {
                  if (isCompany) { set("company_name", e.target.value); set("full_name", e.target.value); }
                  else set("full_name", e.target.value);
                }} placeholder={isCompany ? "e.g. Paystack" : "e.g. Ada Lovelace"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em">Email address</Label>
                <Input id="em" type="email" value={s.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ph">Phone number</Label>
                <Input id="ph" type="tel" value={s.phone} onChange={(e) => set("phone", e.target.value)} placeholder="08012345678" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" value={s.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 8 characters" />
              </div>
              <Button size="lg" className="w-full" onClick={handleAccountSubmit} disabled={loading}>
                {loading ? "Creating..." : "Continue"} <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STUDENT — university details */}
        {step === 3 && isStudent && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">University details</h1>
            <p className="mt-1 text-sm text-muted-foreground">Helps posters find you nearby.</p>
            <div className="mt-6 space-y-4">
              <UniSelect value={s.university} onChange={(v) => set("university", v)} />
              <div className="space-y-1.5">
                <Label htmlFor="dept">Department / Faculty</Label>
                <Input id="dept" value={s.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Computer Science" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="yr">Year of study</Label>
                <select id="yr" value={s.year_of_study} onChange={(e) => set("year_of_study", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Select your level</option>
                  {YEARS_OF_STUDY.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="uemail">University email (optional)</Label>
                <Input id="uemail" type="email" value={s.university_email} onChange={(e) => set("university_email", e.target.value)} placeholder="yourname@students.youruni.edu.ng" />
              </div>
              <Button size="lg" className="w-full" disabled={!s.university || !s.year_of_study} onClick={next}>Continue <ArrowRight className="size-4" /></Button>
            </div>
          </div>
        )}

        {/* STUDENT — verification */}
        {step === 4 && isStudent && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Verify your student status</h1>
            <p className="mt-1 text-sm text-muted-foreground">Pick how you'd like to verify.</p>
            <div className="mt-6 space-y-3">
              <RoleCard icon={CheckCircle2} title="University email" desc="We'll send a 4-digit code to your .edu.ng address — faster." selected={s.verification_method === "email"} onClick={() => set("verification_method", "email")} />
              <RoleCard icon={Upload} title="Upload student ID" desc="Photo of your valid student ID card — reviewed in 24 hours." selected={s.verification_method === "id_upload"} onClick={() => set("verification_method", "id_upload")} />
            </div>

            {s.verification_method === "id_upload" && (
              <div className="mt-4 space-y-3">
                <label className="text-sm font-medium text-foreground">Upload your student ID</label>
                <div
                  className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => document.getElementById("id-upload-input")?.click()}
                >
                  {idFile ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-success">✓ {idFile.name}</p>
                      <p className="text-xs text-muted-foreground">Tap to change</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="size-8 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Tap to upload your student ID</p>
                      <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  id="id-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}

            <Button size="lg" className="mt-6 w-full" disabled={!s.verification_method || (s.verification_method === "id_upload" && !idFile)} onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Your ID is stored securely and only used for verification.</p>
          </div>
        )}

        {/* STUDENT — skills */}
        {step === 5 && isStudent && (
          <SkillsPicker s={s} setS={setS} loading={loading} onFinish={handleStudentFinish} />
        )}

        {/* ALUMNI — graduation details */}
        {step === 3 && isAlumni && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Where did you graduate from?</h1>
            <p className="mt-1 text-sm text-muted-foreground">We'll display this on your profile.</p>
            <div className="mt-6 space-y-4">
              <UniSelect value={s.university} onChange={(v) => set("university", v)} label="University" />
              <div className="space-y-1.5">
                <Label htmlFor="gy">Year of graduation</Label>
                <Input id="gy" inputMode="numeric" maxLength={4} value={s.graduation_year} onChange={(e) => set("graduation_year", e.target.value.replace(/[^0-9]/g, ""))} placeholder="e.g. 2022" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adept">Department / Faculty</Label>
                <Input id="adept" value={s.department} onChange={(e) => set("department", e.target.value)} placeholder="e.g. Mechanical Engineering" />
              </div>
              <Button size="lg" className="w-full" disabled={!s.university || s.graduation_year.length !== 4 || !s.department.trim()} onClick={next}>
                Continue <ArrowRight className="size-4" />
              </Button>
              <p className="text-center text-xs text-muted-foreground">Your profile will show an "Alumni — unverified" badge until we confirm.</p>
            </div>
          </div>
        )}

        {/* ALUMNI — skills */}
        {step === 4 && isAlumni && (
          <SkillsPicker s={s} setS={setS} loading={loading} onFinish={handleAlumniFinish} />
        )}

        {/* COMPANY — step 3 business details */}
        {step === 3 && isCompany && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Business details</h1>
            <p className="mt-1 text-sm text-muted-foreground">Tell us about your organization.</p>
            <div className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ind">Industry</Label>
                <Input id="ind" value={s.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. Fintech, Education, Media" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={s.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Lagos" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="web">Website (optional)</Label>
                <Input id="web" value={s.website} onChange={(e) => set("website", e.target.value)} placeholder="https://yourcompany.com" />
              </div>
              <Button size="lg" className="w-full" disabled={loading || !s.industry.trim() || !s.city.trim()} onClick={handleCompanyFinish}>
                {loading ? "Saving..." : "Finish setup"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Your account will show a "Verification pending" badge until reviewed.</p>
            </div>
          </div>
        )}

        {/* WELCOME — student (step 6) & alumni (step 5) */}
        {((step === 6 && isStudent) || (step === 5 && isAlumni)) && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">You're all set 🎉</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome to InTask, {s.full_name.split(" ")[0]}.</p>

            <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-card">
              <div className="flex items-center gap-3">
                <InitialsAvatar name={s.full_name} size={48} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{s.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.university}{isAlumni && s.graduation_year ? ` · Class of ${s.graduation_year}` : s.year_of_study ? ` · ${s.year_of_study}` : ""}
                  </p>
                  <div className="mt-1">
                    <VerifiedBadge
                      role={s.role ?? "student"}
                      verified={s.role === "student" ? s.verification_method === "email" : undefined} />
                  </div>
                </div>
              </div>
              {s.skills.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {s.skills.map((sk) => (
                    <span key={sk} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{sk}</span>
                  ))}
                </div>
              )}
              {isAlumni && (
                <p className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                  Alumni status unverified — we'll confirm this shortly.
                </p>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <Button size="lg" className="w-full" onClick={() => nav({ to: "/app" })}>
                {isAlumni ? "Go to dashboard" : "Browse open tasks"}
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => nav({ to: "/app/profile/$userId", params: { userId: "me" } })}>
                Complete my profile first
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function UniSelect({ value, onChange, label = "University" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="uni">{label}</Label>
      <select id="uni" value={value} onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
        <option value="">Select your university</option>
        {NIGERIAN_UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  );
}

function SkillsPicker({
  s, setS, loading, onFinish,
}: { s: SignupState; setS: React.Dispatch<React.SetStateAction<SignupState>>; loading: boolean; onFinish: () => void }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">What can you do?</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pick up to 5 skills — you can update these later.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {SKILLS.map((sk) => {
          const sel = s.skills.includes(sk);
          return (
            <button
              key={sk}
              type="button"
              onClick={() => {
                setS((p) => {
                  if (p.skills.includes(sk)) return { ...p, skills: p.skills.filter((x) => x !== sk) };
                  if (p.skills.length >= 5) { toast.message("You can pick up to 5 skills"); return p; }
                  return { ...p, skills: [...p.skills, sk] };
                });
              }}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                sel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-accent"
              }`}
            >
              {sk}
            </button>
          );
        })}
      </div>
      <Button size="lg" className="mt-6 w-full" disabled={s.skills.length === 0 || loading} onClick={onFinish}>
        {loading ? "Saving..." : "Finish setup"}
      </Button>
    </div>
  );
}

function RoleCard({
  icon: Icon, title, desc, selected, onClick,
}: { icon: typeof GraduationCap; title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        selected ? "border-primary bg-accent" : "border-border bg-card hover:bg-accent/50"
      }`}
    >
      <div className={`grid size-9 place-items-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}
