import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { applyReferralCode } from "@/lib/referral.functions";
import { finalizeSignupProfile } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GraduationCap, Briefcase, User, CheckCircle2, Upload, ArrowRight, ArrowLeft, Award, Loader2 } from "lucide-react";
import { NIGERIAN_UNIVERSITIES, YEARS_OF_STUDY, SKILLS, NG_PHONE_REGEX } from "@/lib/constants";
import { UniversitySelect } from "@/components/intask/UniversitySelect";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";

const SUPABASE_BASE_URL = import.meta.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_BASE_URL.replace(/\/$/, "")}/functions/v1`;

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Sign up — InTask" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    ref: (search.ref as string) || "",
  }),
  component: SignupPage,
});

type Intent = "find_work" | "hire_talent" | null;
type Role = "student" | "alumni" | "company" | "individual";

interface SignupState {
  intent: Intent;
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
  company_verification_method: "email" | "cac_number" | null;
  company_email: string;
  cac_number: string;
  company_doc_file: File | null;
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
            className={`h-1.5 rounded-full transition-all ${
              active ? "w-8 bg-[#3dcb6c]" : done ? "w-1.5 bg-[rgba(61,203,108,0.5)]" : "w-1.5 bg-[#e4efe0]"
            }`}
          />
        );
      })}
    </div>
  );
}

function SignupPage() {
  const nav = useNavigate();
  const { ref: referralCodeParam } = Route.useSearch();
  const [referralCodeManual, setReferralCodeManual] = useState("");
  const effectiveReferralCode = referralCodeParam || referralCodeManual || "";
  const [idFile, setIdFile] = useState<File | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState<SignupState>({
    intent: null,
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
    company_verification_method: null,
    company_email: "",
    cac_number: "",
    company_doc_file: null,
  });

  const isStudent = s.role === "student";
  const isAlumni = s.role === "alumni";
  const isCompany = s.role === "company";
  const isIndividual = s.role === "individual";

  // Per-role stepper config. Welcome screen is hidden from stepper.
  // Steps: 1=intent, 2=sub-role, 3=account, then role-specific
  function stepInfo(): { current: number; total: number } {
    if (s.role === "student") {
      // 1=intent, 2=sub-role, 3=account, 4=uni, 5=verify, 6=skills, 7=welcome
      return { current: Math.min(step, 6), total: 6 };
    }
    if (s.role === "alumni") {
      // 1=intent, 2=sub-role, 3=account, 4=grad, 5=skills, 6=welcome
      return { current: Math.min(step, 5), total: 5 };
    }
    if (s.role === "individual") {
      // 1=intent, 2=sub-role, 3=account
      return { current: Math.min(step, 3), total: 3 };
    }
    if (s.role === "company") {
      // 1=intent, 2=sub-role, 3=account, 4=business, 5=verify, 6=welcome
      return { current: Math.min(step, 5), total: 5 };
    }
    return { current: 1, total: 2 };
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
        data: { full_name: s.full_name, role: s.role ?? "student" },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return false; }
    if (!data.user) { toast.error("Couldn't create account"); return false; }
    return true;
  }

  const finalizeSignup = useServerFn(finalizeSignupProfile);

  async function finalizeProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const role = s.role ?? "student";

    // Upload files to storage first (client-side — storage doesn't have the trigger issue)
    let idUploadPath: string | null = null;
    let docUploadPath: string | null = null;

    if (isStudent && s.verification_method === "id_upload" && idFile) {
      const fileExt = idFile.name.split(".").pop();
      const filePath = `${user.id}/student-id.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("student-ids")
        .upload(filePath, idFile, { upsert: true });
      if (!uploadError) {
        idUploadPath = filePath;
      }
    }

    if (isCompany && s.company_verification_method === "cac_number" && s.company_doc_file) {
      const fileExt = s.company_doc_file.name.split(".").pop();
      const filePath = `${user.id}/cac-cert.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("company-docs")
        .upload(filePath, s.company_doc_file, { upsert: true });
      if (!uploadError) {
        docUploadPath = filePath;
      }
    }

    // Use server function with supabaseAdmin to bypass the trigger permission issue
    const roleData: Record<string, any> = {};
    if (isStudent) {
      roleData.studentProfile = {
        university: s.university || null,
        department: s.department || null,
        year_of_study: s.year_of_study || null,
        university_email: s.university_email || null,
        skills: s.skills,
        verification_method: s.verification_method ?? "email",
        verified: false,
        verification_status: "pending",
        id_upload_path: idUploadPath,
        rating_average: 0,
        rating_count: 0,
        tasks_completed: 0,
      };
    } else if (isAlumni) {
      roleData.alumniProfile = {
        university: s.university || null,
        department: s.department || null,
        year_of_study: s.graduation_year ? `Class of ${s.graduation_year}` : "Alumni",
        skills: s.skills,
        verification_method: "id_upload",
        verified: false,
      };
    } else if (isIndividual) {
      roleData.individualProfile = {
        verified: true,
        verification_method: "auto",
        verification_status: "auto_verified",
        verified_at: new Date().toISOString(),
      };
    } else if (isCompany) {
      roleData.companyProfile = {
        company_name: s.company_name || s.full_name,
        industry: s.industry || null,
        verification_method: s.company_verification_method ?? null,
        verified: false,
        verification_status: "pending",
        verification_doc_url: docUploadPath,
      };
    }

    try {
      await finalizeSignup({
        data: {
          profile: {
            id: user.id,
            full_name: s.full_name,
            email: s.email,
            phone: s.phone,
            role,
          },
          ...roleData,
        },
      });
    } catch (e: any) {
      toast.error(`Profile creation failed: ${e?.message ?? "Please try again."}`);
      return;
    }

    // Send verification emails (unchanged — these are external API calls)
    if (isStudent && s.verification_method === "email" && s.university_email.trim()) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken && SUPABASE_FUNCTIONS_URL) {
        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-student-verification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ university_email: s.university_email.trim() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.success === false) {
          if (result?.code === "EMAIL_VERIFICATION_NOT_CONFIGURED") {
            toast.error("Student email verification is temporarily unavailable. Your account is active, and you can upload a student ID from your profile to complete verification.");
          } else {
            toast.error(result?.error ?? "Could not send verification code. You can retry from your profile.");
          }
        } else {
          toast.success("Verification code sent to your university email.");
        }
      }
    } else if (isCompany && s.company_verification_method === "email" && s.company_email.trim()) {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (accessToken && SUPABASE_FUNCTIONS_URL) {
        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-company-verification-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ company_email: s.company_email.trim() }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result?.success === false) {
          if (result?.code === "EMAIL_VERIFICATION_NOT_CONFIGURED") {
            toast.error("Company email verification is temporarily unavailable. Your account is active, and you can complete verification from your profile.");
          } else {
            toast.error(result?.error ?? "Could not send verification code. You can retry from your profile.");
          }
        } else {
          toast.success("Verification code sent to your company email.");
        }
      }
    }
  }

  /** After signup/profile creation, check admin status and route accordingly. */
  async function redirectToApp() {
    try {
      const { data: me } = await supabase.auth.getUser();
      if (me.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", me.user.id)
          .maybeSingle();
        // Admin users go to /admin; everyone else to /app.
        const { data: fullProfile } = await (supabase as any)
          .from("my_profile")
          .select("is_admin")
          .maybeSingle();
        if (fullProfile?.is_admin) {
          nav({ to: "/admin" });
          return;
        }
      }
    } catch {
      // Fall through to default route
    }
    nav({ to: "/app" });
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
      await redirectToApp();
      return;
    }
    next();
  }

  async function handleStudentFinish() {
    setLoading(true);
    await finalizeProfile();
    setLoading(false);
    // Apply referral code if present.
    if (effectiveReferralCode) {
      try {
        await applyReferralCode({ data: { code: effectiveReferralCode } });
        toast.success("Referral bonus applied! Check your wallet.");
      } catch {
        // Non-critical — don't block signup.
      }
    }
    next(); // welcome
  }

  async function handleAlumniFinish() {
    setLoading(true);
    await finalizeProfile();
    setLoading(false);
    // Apply referral code if present.
    if (effectiveReferralCode) {
      try {
        await applyReferralCode({ data: { code: effectiveReferralCode } });
        toast.success("Referral bonus applied! Check your wallet.");
      } catch {
        // Non-critical — don't block signup.
      }
    }
    next(); // welcome
  }

  async function handleCompanyFinish() {
    if (!s.company_name.trim()) return toast.error("Enter your company or organization name");
    setLoading(true);
    await finalizeProfile();
    setLoading(false);
    // Apply referral code if present.
    if (effectiveReferralCode) {
      try {
        await applyReferralCode({ data: { code: effectiveReferralCode } });
        toast.success("Referral bonus applied! Check your wallet.");
      } catch {
        // Non-critical — don't block signup.
      }
    }
    next(); // go to welcome
  }

  async function handleCompanyVerify() {
    setLoading(true);
    await finalizeProfile();
    setLoading(false);
    // Apply referral code if present.
    if (effectiveReferralCode) {
      try {
        await applyReferralCode({ data: { code: effectiveReferralCode } });
        toast.success("Referral bonus applied! Check your wallet.");
      } catch {
        // Non-critical — don't block signup.
      }
    }
    next(); // go to welcome
  }

  return (
    <div className="min-h-screen bg-[#eff8ea] text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,#0d2818_0%,#1a3a2a_60%,#2d5a3d_100%)] px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(61,203,108,0.12)_0%,transparent_50%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(181,119,26,0.06)_0%,transparent_40%)]" />

          <div className="relative z-10 flex h-full flex-col justify-center">
            <Link to="/" className="mb-12 flex w-fit items-center gap-2.5 no-underline">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3dcb6c] text-base text-white">✦</span>
              <span className="[font-family:'Space_Grotesk',sans-serif] text-[1.3rem] font-bold text-white">InTask</span>
            </Link>

            <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[2.2rem] leading-[1.1] font-bold tracking-[-0.03em] text-white md:text-[2.8rem]">
              Start earning in <span className="text-[#3dcb6c]">minutes.</span>
            </h1>
            <p className="mt-5 max-w-[400px] text-[1.05rem] leading-[1.6] text-white/60">
              Create your account, verify your student status, and start finding paid tasks that match your skills.
            </p>
          </div>
        </section>

        <section className="flex flex-col justify-center bg-white px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-12">
          {step > 1 && (
            <button onClick={back} aria-label="Back" className="mb-4 inline-flex w-fit items-center gap-1 text-[0.8rem] font-medium text-[#6a8064] hover:text-[#1a1e16]">
              <ArrowLeft className="size-4" />
              Back
            </button>
          )}

          <div className="mb-7">
            <Stepper current={sinfo.current} total={sinfo.total} />
          </div>

          {/* Loading overlay during form submission */}
          {loading && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="size-8 animate-spin text-[#3dcb6c]" />
                <p className="text-sm font-medium text-[#1a1e16]">Setting up your account...</p>
              </div>
            </div>
          )}

          <div>
        {/* STEP 1 — Intent selection */}
        {step === 1 && (
          <div>
            <div className="mb-7">
              <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[1.6rem] font-bold tracking-[-0.02em] text-[#1a1e16]">Welcome to InTask</h1>
              <p className="mt-1 text-[0.85rem] text-[#6a8064]">What brings you here?</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => { set("intent", "find_work"); set("role", null); }}
                className={`flex items-center gap-4 rounded-[14px] border p-5 text-left transition-all ${
                  s.intent === "find_work"
                    ? "border-[#3dcb6c] bg-[rgba(61,203,108,0.06)] shadow-[0_0_0_3px_rgba(61,203,108,0.1)]"
                    : "border-[#c4deb8] bg-white hover:border-[#3dcb6c] hover:bg-[#f9fdf7]"
                }`}
              >
                <div className="grid h-12 w-12 place-items-center rounded-[10px] bg-[rgba(61,203,108,0.12)] text-[#1a7a42]">
                  <GraduationCap className="size-6" />
                </div>
                <div>
                  <p className="text-[1rem] font-semibold text-[#1a1e16]">Find work</p>
                  <p className="text-[0.8rem] text-[#6a8064]">I'm a student or graduate looking for paid tasks.</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { set("intent", "hire_talent"); set("role", null); }}
                className={`flex items-center gap-4 rounded-[14px] border p-5 text-left transition-all ${
                  s.intent === "hire_talent"
                    ? "border-[#3dcb6c] bg-[rgba(61,203,108,0.06)] shadow-[0_0_0_3px_rgba(61,203,108,0.1)]"
                    : "border-[#c4deb8] bg-white hover:border-[#3dcb6c] hover:bg-[#f9fdf7]"
                }`}
              >
                <div className="grid h-12 w-12 place-items-center rounded-[10px] bg-[rgba(37,99,235,0.10)] text-[#2563eb]">
                  <Briefcase className="size-6" />
                </div>
                <div>
                  <p className="text-[1rem] font-semibold text-[#1a1e16]">Hire talent</p>
                  <p className="text-[0.8rem] text-[#6a8064]">I need skilled students or graduates for a project.</p>
                </div>
              </button>
            </div>
            <Button size="lg" className="mt-6 h-12 w-full rounded-[10px] bg-[#3dcb6c] text-[0.95rem] font-semibold text-white hover:bg-[#35b860]" disabled={!s.intent} onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
            <p className="mt-5 text-center text-[0.85rem] text-[#6a8064]">
              Already have an account? <Link to="/auth/login" search={{ redirect: "" }} className="font-semibold text-[#3dcb6c] no-underline">Log in</Link>
            </p>
          </div>
        )}

        {/* STEP 2 — Sub-role selection */}
        {step === 2 && (
          <div>
            <div className="mb-7">
              <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[1.6rem] font-bold tracking-[-0.02em] text-[#1a1e16]">
                {s.intent === "find_work" ? "Are you currently a student?" : "How will you use InTask?"}
              </h1>
              <p className="mt-1 text-[0.85rem] text-[#6a8064]">Pick the option that fits you best.</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {s.intent === "find_work" ? (
                <>
                  <RoleCard icon={GraduationCap} title="I'm a student" desc="I want to find work and get paid for my skills." selected={s.role === "student"} onClick={() => set("role", "student")} />
                  <RoleCard icon={Award} title="I'm alumni" desc="I graduated and want to keep working and earning." selected={s.role === "alumni"} onClick={() => set("role", "alumni")} />
                </>
              ) : (
                <>
                  <RoleCard icon={User} title="I want to post a task" desc="I need help from a student with a one-off project." selected={s.role === "individual"} onClick={() => set("role", "individual")} />
                  <RoleCard icon={Briefcase} title="I'm a company" desc="I want to hire verified students for ongoing work." selected={s.role === "company"} onClick={() => set("role", "company")} />
                </>
              )}
            </div>
            <Button size="lg" className="mt-6 h-12 w-full rounded-[10px] bg-[#3dcb6c] text-[0.95rem] font-semibold text-white hover:bg-[#35b860]" disabled={!s.role} onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* STEP 3 — Account creation */}
        {step === 3 && (
          <div>
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">{isCompany ? "Create your business account" : "Create your account"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Start in less than a minute.</p>
            </div>

            <div className="mt-6 space-y-4 rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
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
              {!referralCodeParam && (
                <div className="space-y-1.5">
                  <Label htmlFor="ref">Referral code <span className="text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="ref"
                    value={referralCodeManual}
                    onChange={(e) => setReferralCodeManual(e.target.value.toUpperCase())}
                    placeholder="e.g. ABCD1234"
                    className="uppercase"
                    maxLength={8}
                  />
                </div>
              )}
              {referralCodeParam && (
                <div className="rounded-lg bg-success/10 px-3 py-2 text-xs text-success">
                  ✓ Referral code <span className="font-mono font-bold">{referralCodeParam}</span> applied — you&apos;ll both earn a bonus!
                </div>
              )}
              <Button size="lg" className="w-full" onClick={handleAccountSubmit} disabled={loading}>
                {loading ? "Creating..." : "Continue"} <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* STUDENT — university details */}
        {step === 4 && isStudent && (
          <div>
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">University details</h1>
              <p className="mt-1 text-sm text-muted-foreground">Helps posters find you nearby.</p>
            </div>
            <div className="mt-6 space-y-4 rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
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
        {step === 5 && isStudent && (
          <div>
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Verify your student status</h1>
              <p className="mt-1 text-sm text-muted-foreground">Pick how you'd like to verify.</p>
            </div>
            <div className="mt-6 space-y-3">
              <RoleCard
                icon={CheckCircle2}
                title="University email"
                desc="We'll send a 4-digit code to your .edu.ng address — faster."
                selected={s.verification_method === "email"}
                onClick={() => {
                  set("verification_method", "email");
                  if (!s.university_email.trim() && s.email.trim()) set("university_email", s.email.trim());
                }}
              />
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

            <Button size="lg" className="mt-6 w-full" disabled={!s.verification_method || (s.verification_method === "id_upload" && !idFile) || (s.verification_method === "email" && !s.university_email.trim())} onClick={next}>
              Continue <ArrowRight className="size-4" />
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Your ID is stored securely and only used for verification.</p>
          </div>
        )}

        {/* STUDENT — skills */}
        {step === 6 && isStudent && (
          <SkillsPicker s={s} setS={setS} loading={loading} onFinish={handleStudentFinish} />
        )}

        {/* ALUMNI — graduation details */}
        {step === 4 && isAlumni && (
          <div>
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Where did you graduate from?</h1>
              <p className="mt-1 text-sm text-muted-foreground">We'll display this on your profile.</p>
            </div>
            <div className="mt-6 space-y-4 rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
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
        {step === 5 && isAlumni && (
          <SkillsPicker s={s} setS={setS} loading={loading} onFinish={handleAlumniFinish} />
        )}

        {/* COMPANY — business details */}
        {step === 4 && isCompany && (
          <div>
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Business details</h1>
              <p className="mt-1 text-sm text-muted-foreground">Tell us about your organization.</p>
            </div>
            <div className="mt-6 space-y-4 rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
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
                {loading ? "Saving..." : "Continue"} <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {/* COMPANY — verification */}
        {step === 5 && isCompany && (
          <div>
            <div className="rounded-3xl border border-border/80 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5 shadow-sm">
              <h1 className="text-2xl font-semibold tracking-tight">Verify your business</h1>
              <p className="mt-1 text-sm text-muted-foreground">Choose how you'd like to verify your company.</p>
            </div>
            <div className="mt-6 space-y-3">
              <RoleCard
                icon={CheckCircle2}
                title="Company email"
                desc="We'll send a 6-digit code to your business email address."
                selected={s.company_verification_method === "email"}
                onClick={() => {
                  set("company_verification_method", "email");
                  if (!s.company_email.trim() && s.email.trim()) set("company_email", s.email.trim());
                }}
              />
              <RoleCard icon={Upload} title="CAC registration" desc="Upload your CAC certificate — reviewed within 24 hours." selected={s.company_verification_method === "cac_number"} onClick={() => set("company_verification_method", "cac_number")} />
            </div>

            {s.company_verification_method === "email" && (
              <div className="mt-4 space-y-3 rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="cemail">Company email address</Label>
                  <Input id="cemail" type="email" value={s.company_email} onChange={(e) => set("company_email", e.target.value)} placeholder="hr@yourcompany.com" />
                </div>
                <p className="text-xs text-muted-foreground">Use an email address at your company domain (e.g. name@yourcompany.com).</p>
              </div>
            )}

            {s.company_verification_method === "cac_number" && (
              <div className="mt-4 space-y-3 rounded-3xl border border-border/80 bg-card/90 p-4 shadow-sm">
                <div className="space-y-1.5">
                  <Label htmlFor="cac">CAC Registration Number</Label>
                  <Input id="cac" value={s.cac_number} onChange={(e) => set("cac_number", e.target.value)} placeholder="e.g. RC1234567" />
                </div>
                <div className="space-y-1.5">
                  <Label>Upload CAC Certificate</Label>
                  <div
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => document.getElementById("cac-upload-input")?.click()}
                  >
                    {s.company_doc_file ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-success">✓ {s.company_doc_file.name}</p>
                        <p className="text-xs text-muted-foreground">Tap to change</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="size-8 text-muted-foreground mx-auto" />
                        <p className="text-sm text-muted-foreground">Tap to upload your CAC certificate</p>
                        <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    id="cac-upload-input"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    onChange={(e) => set("company_doc_file", e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
            )}

            <Button size="lg" className="mt-6 w-full" disabled={!s.company_verification_method || loading || (s.company_verification_method === "email" && !(s.company_email || s.email).trim()) || (s.company_verification_method === "cac_number" && (!s.cac_number.trim() || !s.company_doc_file))} onClick={handleCompanyVerify}>
              {loading ? "Saving..." : "Finish setup"} <ArrowRight className="size-4" />
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">Your documents are stored securely and only used for verification.</p>
          </div>
        )}

        {/* WELCOME — student (step 7), alumni (step 6), company (step 6) */}
        {((step === 7 && isStudent) || (step === 6 && isAlumni) || (step === 6 && isCompany)) && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">You're all set 🎉</h1>
            <p className="mt-1 text-sm text-muted-foreground">Welcome to InTask, {s.full_name.split(" ")[0]}.</p>

            <div className="mt-6 rounded-3xl border border-border/80 bg-card/90 p-5 shadow-sm">
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
                      verified={false} />
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
              {isCompany && (
                <p className="mt-4 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                  Business verification pending — we'll review your submission shortly.
                </p>
              )}
            </div>

            <div className="mt-6 space-y-2">
              <Button size="lg" className="w-full" onClick={async () => await redirectToApp()}>
                {isAlumni ? "Go to dashboard" : "Browse open tasks"}
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => nav({ to: "/app/profile/$userId", params: { userId: "me" } })}>
                Complete my profile first
              </Button>
            </div>
          </div>
        )}
          </div>
        </section>
      </div>
    </div>
  );
}

function UniSelect({ value, onChange, label = "University" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <UniversitySelect value={value} onChange={onChange} />
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
  const iconTone =
    title.includes("student")
      ? "bg-[rgba(61,203,108,0.12)] text-[#1a7a42]"
      : title.includes("post a task")
        ? "bg-[rgba(37,99,235,0.10)] text-[#2563eb]"
        : title.includes("alumni")
          ? "bg-[rgba(181,119,26,0.12)] text-[#b5771a]"
          : "bg-[rgba(26,122,66,0.12)] text-[#1a7a42]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3.5 rounded-[14px] border p-[18px] text-left transition-all ${
        selected
          ? "border-[#3dcb6c] bg-[rgba(61,203,108,0.06)] shadow-[0_0_0_3px_rgba(61,203,108,0.1)]"
          : "border-[#c4deb8] bg-white hover:border-[#3dcb6c] hover:bg-[#f9fdf7]"
      }`}
    >
      <div className={`grid h-10 w-10 place-items-center rounded-[10px] ${iconTone}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-[0.9rem] font-semibold text-[#1a1e16]">{title}</p>
        <p className="text-[0.75rem] leading-[1.4] text-[#6a8064]">{desc}</p>
      </div>
    </button>
  );
}
