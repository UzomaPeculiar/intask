import { AvatarUpload } from "@/components/intask/AvatarUpload";
import { Wallet } from "lucide-react";
import { Award } from "lucide-react";
import { Share2 } from "lucide-react";
import { ReportButton } from "@/components/intask/ReportButton";
import { Link } from "@tanstack/react-router";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MVP_FEATURES } from "@/lib/mvp-features";
import { submitStudentIdUpload, switchStudentVerificationMethod, saveProfileEdits } from "@/lib/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { SKILLS, NIGERIAN_UNIVERSITIES, YEARS_OF_STUDY } from "@/lib/constants";
import { UniversitySelect } from "@/components/intask/UniversitySelect";
import { ArrowLeft, LogOut, Star, Briefcase, Edit3, Save, Plus, ExternalLink, Trash2, FolderGit2, GraduationCap, Mail, Phone, Building2, MapPin, Globe, ImagePlus, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ProfileSkeleton } from "@/components/intask/Skeletons";

const SUPABASE_BASE_URL = import.meta.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_BASE_URL.replace(/\/$/, "")}/functions/v1`;

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
      const profileQuery = isOwn
        ? supabase
            .from("my_profile")
            .select("id, full_name, avatar_url, bio, role, email, phone, created_at, updated_at")
            .maybeSingle()
        : supabase
            .from("profiles")
            .select("id, full_name, avatar_url, bio, role, created_at, updated_at")
            .eq("id", targetId!)
            .maybeSingle();

      const { data: profile, error: profileError } = await profileQuery;
      if (profileError) throw profileError;

      let student = null;
      let company = null;
      let individual = null;
      if (profile?.role === "student" || profile?.role === "alumni") {
        const studentQuery = isOwn
          ? supabase.from("my_student_profile").select("*").maybeSingle()
          : supabase
              .from("student_profiles")
              .select("user_id, department, portfolio, rating_average, rating_count, skills, tasks_completed, university, verified, year_of_study, created_at, updated_at")
              .eq("user_id", targetId!)
              .maybeSingle();

        const { data, error } = await studentQuery;
        if (error) throw error;
        student = data as any;
      }
      if (profile?.role === "company") {
        const companyQuery = isOwn
          ? (supabase as any).from("my_company_profile").select("*").maybeSingle()
          : supabase
              .from("company_profiles")
              .select("user_id, company_name, industry, location, website, verified, created_at, updated_at")
              .eq("user_id", targetId!)
              .maybeSingle();
        const { data, error } = await companyQuery;
        if (error) throw error;
        company = data as any;
      }
      if (profile?.role === "individual") {
        const individualQuery = isOwn
          ? (supabase as any).from("my_individual_profile").select("*").maybeSingle()
          : (supabase as any)
              .from("individual_profiles")
              .select("user_id, verified, created_at, updated_at")
              .eq("user_id", targetId as string)
              .maybeSingle();
        const { data, error } = await individualQuery;
        if (!error) individual = data as any;
      }

      const { data: reviews } = await supabase
        .from("reviews")
        .select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name), task:tasks(title)")
        .eq("reviewee_id", targetId!)
        .order("created_at", { ascending: false })
        .limit(20);

      let responseTimeLabel = "—";
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .or(`poster_id.eq.${targetId},student_id.eq.${targetId}`)
        .limit(50);

      const conversationIds = (conversations ?? []).map((conversation: any) => conversation.id);
      if (conversationIds.length > 0) {
        const { data: messages } = await supabase
          .from("messages")
          .select("conversation_id, sender_id, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
          .limit(1000);

        const samples = computeResponseSamples(messages ?? [], targetId!);
        if (samples.length > 0) {
          responseTimeLabel = formatResponseTime(samples);
        }
      }

      return { profile: profile as any, student, company, individual, reviews: reviews ?? [], responseTimeLabel };
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

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!isOwn || !targetId) {
        throw new Error("Only the task poster can delete this task.");
      }

      const { error } = await supabase.from("tasks").delete().eq("id", taskId).eq("poster_id", targetId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile-tasks", targetId] });
      await qc.invalidateQueries({ queryKey: ["profile", targetId] });
      toast.success("Task deleted");
    },
    onError: (error: any) => {
      toast.error(error?.message ?? "Couldn't delete task");
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
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "activity">("overview");

  if (isLoading && !timedOut) {
    return <ProfileSkeleton />;
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
  const { profile, student, company, individual, reviews } = resolved as any;
  const isStudent = profile.role === "student";
  const isAlumni = profile.role === "alumni";
  const isStudentOrAlumni = isStudent || isAlumni;
  const isCompany = profile.role === "company";
  const isIndividual = profile.role === "individual";
  const fromBottomNav = userId === "me";
  const profileActionButtonClass =
    "inline-flex items-center gap-1 rounded-[8px] border border-[#E2E8F0] bg-white px-3.5 py-1.5 text-[0.75rem] font-medium text-[#1E293B] transition-colors hover:bg-[#f6fbf4]";
  const profileTabButtonBaseClass =
    "rounded-[8px] px-3 py-2 text-[0.8rem] font-semibold transition-colors";

  // ── Company profile: Freeio-style layout ──
  if (isCompany) {
    return (
      <CompanyProfileView
        profile={profile}
        company={company}
        reviews={reviews}
        postedTasks={postedTasks ?? []}
        isOwn={!!isOwn}
        targetId={targetId!}
        nav={nav}
        onEdit={() => setEditing(true)}
        onCancel={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["profile", targetId] }); }}
        user={user}
        editing={editing}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] [font-family:'Inter',sans-serif]">
      <div className="mx-auto grid w-full max-w-[1280px] lg:grid-cols-[1fr_380px]">
        <div className="px-4 pb-10 pt-7 sm:px-8 lg:px-10">
          <header className="mb-4 flex items-center justify-between gap-2">
            {fromBottomNav ? (
              <div />
            ) : (
              <button onClick={() => window.history.back()} aria-label="Back" className="grid size-9 place-items-center rounded-full border border-[#E2E8F0] bg-white">
                <ArrowLeft className="size-4" />
              </button>
            )}
            {isOwn && (
              <button onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }} className="inline-flex items-center gap-1 text-sm text-[#6B7280]">
                <LogOut className="size-4" /> Sign out
              </button>
            )}
          </header>

          <section className="mb-5 rounded-[18px] border border-[#E2E8F0] bg-[linear-gradient(145deg,#F1F3F5,#eaf3f8)] p-7">
            <div className="flex items-start gap-5">
              <div className="shrink-0">
                <InitialsAvatar name={profile.full_name} size={80} avatarUrl={profile.avatar_url} />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="truncate font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1E293B]">{profile.full_name}</h1>
                {isStudentOrAlumni && student?.university && (
                  <p className="mt-0.5 truncate text-[0.8rem] text-[#6B7280]">
                    {student.university}
                    {student.year_of_study ? ` · ${student.year_of_study}` : ""}
                    {student.department ? ` · ${student.department}` : ""}
                  </p>
                )}
                {isCompany && company?.company_name && (
                  <p className="mt-0.5 truncate text-[0.8rem] text-[#6B7280]">{company.company_name}</p>
                )}

                <div className="mt-1.5">
                  <VerifiedBadge role={profile.role} verified={isCompany ? company?.verified : isIndividual ? individual?.verified : student?.verified} isPro={!!alumniProSub} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-5 text-[0.8rem] text-[#6B7280]">
                  {isStudentOrAlumni ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-4 fill-[#F97316] text-[#F97316]" />
                      <span className="font-semibold text-[#1E293B]">{(student?.rating_count ?? 0) > 0 ? Number(student?.rating_average ?? 0).toFixed(1) : "0.0"}</span>
                      <span>({student?.rating_count ?? 0} reviews)</span>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="size-4" />
                    <span className="font-semibold text-[#1E293B]">{student?.tasks_completed ?? 0}</span>
                    <span>tasks done</span>
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className={profileActionButtonClass}
                    >
                      <Edit3 className="size-3.5" /> Edit profile
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/app/profile/${targetId}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Profile link copied to clipboard");
                    }}
                    className={profileActionButtonClass}
                  >
                    <Share2 className="size-3.5" /> Share
                  </button>

                  {(profile.role === "student" || profile.role === "alumni" || profile.role === "individual" || profile.role === "company") && (
                    <button
                      type="button"
                      onClick={() => nav({ to: "/app/wallet" as any })}
                      className={profileActionButtonClass}
                    >
                      <Wallet className="size-3.5" /> Wallet
                    </button>
                  )}

                  {MVP_FEATURES.assessments && isOwn && (
                    <button
                      type="button"
                      onClick={() => nav({ to: "/app/assessments" as any })}
                      className="inline-flex items-center gap-1 rounded-[8px] border border-[#E2E8F0] bg-white px-3.5 py-1.5 text-[0.75rem] font-medium text-[#1E293B]"
                    >
                      <Award className="size-3.5" /> Assessments
                    </button>
                  )}

                  {!isOwn && !!user && profile && (
                    <div>
                      <ReportButton reportedId={profile.id} reportedName={profile.full_name ?? "this user"} />
                    </div>
                  )}
                </div>

                {profile.bio && !editing && <p className="mt-3 text-[0.82rem] leading-[1.6] text-[#1E293B]">{profile.bio}</p>}
              </div>
            </div>

            {isOwn && profile.role === "student" && !student?.verified && (
              <StudentVerificationSection
                userId={profile.id}
                verificationMethod={student?.verification_method}
                universityEmail={student?.university_email}
              />
            )}
            {isOwn && isCompany && !company?.verified && company?.verification_method === "email" && (
              <CompanyEmailVerificationSection userId={profile.id} companyEmail={company?.company_email} />
            )}
            {isOwn && isCompany && !company?.verified && company?.verification_method === "cac_number" && (
              <CompanyDocVerificationSection userId={profile.id} />
            )}
            {isOwn && isIndividual && individual?.verification_status === "pending_review" && (
              <div className="it-note-warning mt-3 rounded-xl border p-4">
                <p className="text-sm font-medium text-warning">ID verification pending</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Your government ID is under review. We will notify you once verified.</p>
              </div>
            )}
            {isOwn && isIndividual && (!individual || individual.verification_status === "rejected") && (
              <IndividualIdVerificationSection userId={profile.id} />
            )}
          </section>

          {isOwn && editing ? (
            <EditPanel profile={profile} student={student} company={company} onDone={() => { setEditing(false); qc.invalidateQueries({ queryKey: ["profile", targetId] }); }} />
          ) : (
            <>
              <div className="mb-6 grid grid-cols-3 gap-[2px] rounded-[10px] bg-[#E2E8F0] p-[3px]">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`${profileTabButtonBaseClass} ${activeTab === "overview" ? "bg-white text-[#1E293B] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-[#6B7280] hover:bg-[#edf5e9]"}`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("reviews")}
                  className={`${profileTabButtonBaseClass} ${activeTab === "reviews" ? "bg-white text-[#1E293B] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-[#6B7280] hover:bg-[#edf5e9]"}`}
                >
                  Reviews
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("activity")}
                  className={`${profileTabButtonBaseClass} ${activeTab === "activity" ? "bg-white text-[#1E293B] shadow-[0_1px_3px_rgba(0,0,0,0.08)]" : "text-[#6B7280] hover:bg-[#edf5e9]"}`}
                >
                  Activities
                </button>
              </div>

              {activeTab === "overview" && (
                <div className="space-y-6">
                  {isStudentOrAlumni && student && (student.skills?.length ?? 0) > 0 && (
                    <section>
                      <h2 className="mb-2.5 font-['Space_Grotesk',sans-serif] text-[0.9rem] font-semibold text-[#1E293B]">Skills</h2>
                      <div className="flex flex-wrap gap-1.5">
                        {student.skills.map((s: string) => (
                          <span key={s} className="rounded-full bg-[#DCFCE7] px-3.5 py-1.5 text-[0.75rem] font-medium text-[#15803D]">{s}</span>
                        ))}
                      </div>
                      {skillBadges && skillBadges.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {skillBadges.map((b: any) => (
                            <span key={b.skill} className="inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[0.7rem] font-medium text-[#1E293B]">
                              <Award className="size-3" /> {b.skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </section>
                  )}

                  {isStudentOrAlumni && targetId && (
                    <ProjectsSection userId={targetId} isOwn={!!isOwn} />
                  )}

                  {!editing && (isIndividual || isCompany) && (
                    <div className="space-y-2 rounded-2xl border border-[#E2E8F0] bg-white p-4 text-sm">
                      {isCompany && company?.company_name && (
                        <Row icon={<Building2 className="size-4" />} label="Business" value={company.company_name} />
                      )}
                      {isOwn && isCompany && company?.cac_number && (
                        <Row icon={<Building2 className="size-4" />} label="CAC No." value={company.cac_number} />
                      )}
                      {isCompany && company?.industry && (
                        <Row icon={<Briefcase className="size-4" />} label="Industry" value={company.industry} />
                      )}
                      {isCompany && company?.location && (
                        <Row icon={<MapPin className="size-4" />} label="Location" value={company.location} />
                      )}
                      {isCompany && company?.website && (
                        <Row icon={<Globe className="size-4" />} label="Website" value={
                          <a href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer" className="text-[#15803D] underline underline-offset-2">
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

                  {isStudent && (
                    <p className="inline-flex items-center gap-1 text-xs text-[#6B7280]">
                      <GraduationCap className="size-3.5" /> Alumni status is handled by support.
                    </p>
                  )}
                </div>
              )}

              {activeTab === "reviews" && (
                <section>
                  {reviews.length === 0 ? (
                    <p className="text-sm text-[#6B7280]">No reviews yet.</p>
                  ) : (
                    <ul className="space-y-2.5">                          {reviews.map((r: any) => (
                        <li key={r.id} className="rounded-[12px] border border-[#E2E8F0] bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[0.85rem] font-semibold text-[#1E293B]">{r.reviewer?.full_name ?? "Anonymous"}</p>
                              {r.task?.title && <p className="mt-0.5 text-[0.7rem] text-[#6B7280]">{r.task.title}</p>}
                            </div>
                            <span className="inline-flex items-center gap-0.5 text-[0.8rem] text-[#F97316]">
                              {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="size-3.5 fill-[#F97316] text-[#F97316]" />)}
                            </span>
                          </div>
                          {r.comment && <p className="mt-2 text-[0.8rem] leading-[1.5] text-[#1E293B]">{r.comment}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {activeTab === "activity" && (
                <PostedTasksSection
                  tasks={postedTasks ?? []}
                  isOwn={isOwn}
                  deletingTaskId={deleteTaskMutation.variables ?? null}
                  onDeleteTask={(taskId) => {
                    if (!window.confirm("Delete this task? This will remove its applications too.")) return;
                    deleteTaskMutation.mutate(taskId);
                  }}
                />
              )}
            </>
          )}
        </div>

        <aside className="hidden border-l border-[#E2E8F0] bg-white px-6 py-7 lg:block">
          <section className="mb-6">
            <p className="mb-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#94A3B8]">Profile stats</p>
            <div className="rounded-[12px] border border-[#E2E8F0] bg-[#FFFFFF] p-3.5">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] py-2">
                <span className="text-[0.8rem] text-[#6B7280]">Rating</span>
                <span className="font-['Space_Grotesk',sans-serif] text-[0.85rem] font-semibold text-[#1E293B]">
                  {(student?.rating_count ?? 0) > 0 ? `${Number(student?.rating_average ?? 0).toFixed(1)} ⭐` : "0.0 ⭐"}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] py-2">
                <span className="text-[0.8rem] text-[#6B7280]">Tasks completed</span>
                <span className="font-['Space_Grotesk',sans-serif] text-[0.85rem] font-semibold text-[#1E293B]">{student?.tasks_completed ?? 0}</span>
              </div>
              <div className="flex items-center justify-between border-b border-[#E2E8F0] py-2">
                <span className="text-[0.8rem] text-[#6B7280]">Member since</span>
                <span className="font-['Space_Grotesk',sans-serif] text-[0.85rem] font-semibold text-[#1E293B]">
                  {profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-NG", { month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-[0.8rem] text-[#6B7280]">Response time</span>
                <span className="font-['Space_Grotesk',sans-serif] text-[0.85rem] font-semibold text-[#1E293B]">{(resolved as any).responseTimeLabel ?? "—"}</span>
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[#94A3B8]">Recent reviews</p>
            {reviews.length === 0 ? (
              <div className="rounded-[12px] border border-[#E2E8F0] bg-[#FFFFFF] p-4 text-[0.8rem] text-[#6B7280]">No reviews yet.</div>
            ) : (
              <div className="space-y-2.5">
                {reviews.slice(0, 2).map((r: any) => (
                  <div key={r.id} className="rounded-[12px] border border-[#E2E8F0] bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.85rem] font-semibold text-[#1E293B]">{r.reviewer?.full_name ?? "Anonymous"}</p>
                      <span className="text-[0.8rem] text-[#F97316]">{"★".repeat(Math.max(1, Math.min(5, r.rating || 0)))}</span>
                    </div>
                    {r.task?.title && <p className="mt-0.5 text-[0.7rem] text-[#6B7280]">{r.task.title}</p>}
                    {r.comment && <p className="mt-2 text-[0.8rem] leading-[1.5] text-[#1E293B]">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
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

function computeResponseSamples(
  rows: Array<{ conversation_id: string; sender_id: string; created_at: string }>,
  userId: string,
) {
  const byConversation = new Map<string, Array<{ sender_id: string; created_at: string }>>();
  for (const row of rows) {
    if (!row?.conversation_id || !row?.sender_id || !row?.created_at) continue;
    if (!byConversation.has(row.conversation_id)) byConversation.set(row.conversation_id, []);
    byConversation.get(row.conversation_id)!.push({ sender_id: row.sender_id, created_at: row.created_at });
  }

  const samples: number[] = [];
  for (const messages of byConversation.values()) {
    let waitingSince: number | null = null;
    for (const message of messages) {
      const ts = new Date(message.created_at).getTime();
      if (!Number.isFinite(ts)) continue;

      if (message.sender_id === userId) {
        if (waitingSince != null && ts > waitingSince) {
          samples.push(ts - waitingSince);
          waitingSince = null;
        }
        continue;
      }

      if (waitingSince == null) {
        waitingSince = ts;
      }
    }
  }

  return samples;
}

function formatResponseTime(samplesMs: number[]) {
  const sorted = [...samplesMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  const minutes = medianMs / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;

  const hours = minutes / 60;
  if (hours < 24) {
    const roundedHours = Math.round(hours * 10) / 10;
    return `${roundedHours % 1 === 0 ? roundedHours.toFixed(0) : roundedHours.toFixed(1)} hrs`;
  }

  const days = hours / 24;
  const roundedDays = Math.round(days * 10) / 10;
  return `${roundedDays % 1 === 0 ? roundedDays.toFixed(0) : roundedDays.toFixed(1)} days`;
}

function CompanyProfileView({ profile, company, reviews, postedTasks, isOwn, targetId, nav, onEdit, onCancel, user, editing }: {
  profile: any;
  company: any;
  reviews: any[];
  postedTasks: any[];
  isOwn: boolean;
  targetId: string;
  nav: any;
  onEdit: () => void;
  onCancel: () => void;
  user: any;
  editing: boolean;
}) {
  const qc = useQueryClient();
  const saveProfile = useServerFn(saveProfileEdits);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Edit form state
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [companyName, setCompanyName] = useState(company?.company_name ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [location, setLocation] = useState(company?.location ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");
  const [logoUrl, setLogoUrl] = useState(profile.avatar_url ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function uploadLogo(file: File) {
    if (!file || !profile.id) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setLogoUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setLogoUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setLogoUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    setLogoUploading(false);
  }

  async function save() {
    setSaving(true);
    const profileUpdate: any = {
      bio: bio.trim() || null,
      avatar_url: logoUrl || null,
      full_name: fullName.trim() || profile.full_name,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    const companyUpdate: any = {
      company_name: companyName.trim() || profile.full_name,
      industry: industry.trim() || null,
      location: location.trim() || null,
      website: website.trim() || null,
    };
    try {
      await saveProfile({ data: { profileUpdate, studentUpdate: undefined, companyUpdate } });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save profile");
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success("Profile saved");
    onCancel();
    qc.invalidateQueries({ queryKey: ["profile", targetId] });
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] [font-family:'Inter',sans-serif]">
      {/* Top bar */}
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-4 sm:px-8 lg:px-10">
        <button onClick={() => window.history.back()} aria-label="Back" className="inline-flex items-center gap-1 text-[0.85rem] text-[#6B7280] hover:text-[#1E293B]">
          <ArrowLeft className="size-4" /> Home / Employers / {company?.company_name || profile.full_name}
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/app/profile/${targetId}`;
              navigator.clipboard.writeText(url);
              toast.success("Profile link copied to clipboard");
            }}
            className="inline-flex items-center gap-1.5 text-[0.85rem] text-[#6B7280] hover:text-[#1E293B]"
          >
            <Share2 className="size-4" /> Share
          </button>
          <span className="inline-flex items-center gap-1.5 text-[0.85rem] text-[#16A34A]">
            <span className="grid size-7 place-items-center rounded-full bg-[#16A34A] text-white"><svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" /></svg></span> Saved
          </span>
          {!isOwn && (
            <ReportButton reportedId={profile.id} reportedName={profile.full_name ?? "this user"} />
          )}
        </div>
      </div>

      {/* Hero section */}
      <section className="mx-auto max-w-[1280px] px-4 sm:px-8 lg:px-10">
        <div className="relative overflow-hidden border border-[#E2E8F0] bg-[linear-gradient(135deg,#fef0f0,#fdf5f0)] p-7 sm:p-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-5">
              <div className="shrink-0">
                <InitialsAvatar name={profile.full_name} size={90} avatarUrl={profile.avatar_url} />
              </div>
              <div>
                <h1 className="font-['Space_Grotesk',sans-serif] text-[1.5rem] font-bold text-[#1E293B]">
                  {company?.company_name || profile.full_name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[0.85rem] text-[#6B7280]">
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-4 fill-[#F97316] text-[#F97316]" />
                    <span className="font-semibold text-[#1E293B]">{(reviews.length > 0 ? (reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1) : "0.0")}</span>
                    <span>{reviews.length} Review{reviews.length !== 1 ? "s" : ""}</span>
                  </span>
                  {company?.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-4" /> {company.location}
                    </span>
                  )}
                  {profile.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-4" /> {profile.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {isOwn ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 border border-[#E2E8F0] bg-white px-5 py-2.5 text-[0.85rem] font-medium text-[#1E293B] transition-colors hover:bg-[#f6fbf4]"
                >
                  <Edit3 className="size-4" /> Edit Profile
                </button>
              ) : (
                !!user && (
                  <button
                    type="button"
                    onClick={() => nav({ to: "/app/messages" })}
                    className="inline-flex items-center gap-1.5 bg-[#16A34A] px-6 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#15803D]"
                  >
                    Message
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Two-column content */}
      <div className="mx-auto grid max-w-[1280px] gap-8 px-4 pt-8 sm:px-8 lg:grid-cols-[1fr_380px] lg:px-10">
        {/* Left column */}
        <div className="space-y-8">
          {editing ? (
            /* ── Edit Form ── */
            <section className="space-y-6">
              <h2 className="font-['Space_Grotesk',sans-serif] text-[1.1rem] font-bold text-[#1E293B]">Edit Profile</h2>

              {/* Logo upload */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <h3 className="mb-4 text-[0.95rem] font-semibold text-[#1E293B]">My Profile</h3>
                <div className="border-t border-[#E2E8F0] pt-4">
                  <p className="mb-3 text-[0.8rem] font-medium text-[#1E293B]">Logo Image</p>
                  <div className="flex items-start gap-4">
                    <div className="relative size-24 shrink-0 overflow-hidden border border-[#E2E8F0] bg-[#FFFFFF]">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Building2 className="size-8 text-[#E2E8F0]" />
                        </div>
                      )}
                      {logoUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <Loader2 className="size-5 animate-spin text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="border border-dashed border-[#E2E8F0] bg-[#fef4f4] px-4 py-2 text-[0.8rem] font-medium text-[#1E293B] transition-colors hover:bg-[#fde8e8]"
                      >
                        Browse
                      </button>
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
                      />
                      <p className="mt-1 text-[0.7rem] text-[#94A3B8]">JPG, PNG or WebP · Max 5MB</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form fields */}
              <div className="border border-[#E2E8F0] bg-white p-6">
                <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[0.8rem] font-medium text-[#1E293B]">Employer name</Label>
                    <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Employer" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[0.8rem] font-medium text-[#1E293B]">Categories</Label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="flex h-10 w-full border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[0.85rem] text-[#1E293B]"
                    >
                      <option value="">Select category</option>
                      <option value="Digital Marketing">Digital Marketing</option>
                      <option value="Technology">Technology</option>
                      <option value="Finance">Finance</option>
                      <option value="Education">Education</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Media">Media</option>
                      <option value="Consulting">Consulting</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[0.8rem] font-medium text-[#1E293B]">Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employer@company.com" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[0.8rem] font-medium text-[#1E293B]">Phone Number</Label>
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(+234)000-000-0000" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[0.8rem] font-medium text-[#1E293B]">Website</Label>
                    <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="envato.com" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[0.8rem] font-medium text-[#1E293B]">Location</Label>
                    <select
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="flex h-10 w-full border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[0.85rem] text-[#1E293B]"
                    >
                      <option value="">Select location</option>
                      <option value="Lagos">Lagos</option>
                      <option value="Abuja">Abuja</option>
                      <option value="Port Harcourt">Port Harcourt</option>
                      <option value="Ibadan">Ibadan</option>
                      <option value="Kano">Kano</option>
                      <option value="Enugu">Enugu</option>
                      <option value="Remote">Remote</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6 space-y-1.5">
                  <Label className="text-[0.8rem] font-medium text-[#1E293B]">Description</Label>
                  <Textarea
                    rows={6}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell students about your business and the kind of work you typically post."
                    className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem] leading-relaxed"
                  />
                </div>
              </div>

              {/* Save / Cancel buttons */}
              <div className="flex gap-3 pb-6">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-[#16A34A] px-7 py-3 text-[0.9rem] font-semibold text-white shadow-[0_4px_14px_rgba(22,163,74,0.3)] transition-all hover:bg-[#15803D] hover:shadow-[0_6px_20px_rgba(22,163,74,0.4)] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Profile"}
                  {!saving && <span className="text-[1.1rem]">↗</span>}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="border border-[#E2E8F0] bg-white px-6 py-3 text-[0.9rem] font-medium text-[#1E293B] transition-colors hover:bg-[#f6fbf4]"
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : (
            /* ── View Mode ── */
            <>
              {/* Bio */}
              {profile.bio && (
                <section>
                  <div className="text-[0.9rem] leading-[1.7] text-[#1E293B]">
                    <p>{profile.bio}</p>
                  </div>
                </section>
              )}

              {/* Open Positions */}
              {postedTasks && postedTasks.length > 0 && (
                <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-['Space_Grotesk',sans-serif] text-[1.1rem] font-bold text-[#1E293B]">Open Position</h2>
                <Link to="/app/my-tasks" className="inline-flex items-center gap-1 text-[0.85rem] font-medium text-[#16A34A] hover:underline">
                  Browse Full List <ExternalLink className="size-3.5" />
                </Link>
              </div>
              <div className="space-y-3">
                {postedTasks.slice(0, 3).map((task: any) => (
                  <Link key={task.id} to="/app/tasks/$taskId" params={{ taskId: task.id }} className="block border border-[#E2E8F0] bg-white p-5 transition-colors hover:border-[#16A34A]/30">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <InitialsAvatar name={company?.company_name || profile.full_name} size={44} avatarUrl={profile.avatar_url} />
                        <div>
                          <h3 className="text-[0.95rem] font-semibold text-[#1E293B]">{task.title}</h3>
                          <p className="mt-0.5 text-[0.8rem] text-[#16A34A]">{company?.company_name || profile.full_name}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.75rem] text-[#6B7280]">
                            <span className="font-semibold text-[#1E293B]">₦{task.budget?.toLocaleString()}</span>
                            <span>·</span>
                            <span>{task.category}</span>
                            <span>·</span>
                            <span>{task.status === "open" ? "Open" : task.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

              {/* Reviews */}
              <section>
                <h2 className="mb-4 font-['Space_Grotesk',sans-serif] text-[1.1rem] font-bold text-[#1E293B]">{reviews.length} Review{reviews.length !== 1 ? "s" : ""}</h2>
            {reviews.length > 0 ? (
              <div className="space-y-6">
                {/* Rating summary */}
                <div className="flex gap-8">
                  <div className="flex flex-col items-center justify-center bg-[#fef4f4] px-8 py-6 text-center">
                    <span className="font-['Space_Grotesk',sans-serif] text-[2.5rem] font-bold text-[#F97316]">
                      {(reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length).toFixed(1)}
                    </span>
                    <div className="mt-1 flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`size-4 ${i < Math.round(reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length) ? "fill-[#F97316] text-[#F97316]" : "text-[#E2E8F0]"}`} />
                      ))}
                    </div>
                    <p className="mt-1 text-[0.8rem] text-[#6B7280]">{reviews.length} rating{reviews.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = reviews.filter((r: any) => Math.round(r.rating) === star).length;
                      const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-3 text-[0.8rem]">
                          <span className="w-12 text-[#6B7280]">{star} Star</span>
                          <div className="h-2 flex-1 overflow-hidden bg-[#E2E8F0]">
                            <div className="h-full bg-[#F97316]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-10 text-right text-[#6B7280]">{Math.round(pct)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual reviews */}
                {reviews.map((r: any) => (
                  <div key={r.id} className="border-t border-[#E2E8F0] pt-5">
                    <div className="flex items-center gap-3">
                      <InitialsAvatar name={r.reviewer?.full_name ?? "Anonymous"} size={40} />
                      <div>
                        <p className="text-[0.9rem] font-semibold text-[#1E293B]">{r.reviewer?.full_name ?? "Anonymous"}</p>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-0.5 text-[0.8rem] text-[#F97316]">
                            <Star className="size-3.5 fill-[#F97316] text-[#F97316]" /> {r.rating}
                          </span>
                          <span className="text-[0.8rem] text-[#6B7280]">{r.created_at ? new Date(r.created_at).toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" }) : ""}</span>
                        </div>
                      </div>
                    </div>
                    {r.comment && <p className="mt-3 text-[0.9rem] leading-[1.6] text-[#1E293B]">{r.comment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.9rem] text-[#6B7280]">No reviews yet.</p>
            )}
          </section>
            </>
          )}
        </div>

        {/* Right sidebar (sticky) */}
        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-5">
            {/* About Me card */}
            <div className="border border-[#E2E8F0] bg-white p-6">
              <h3 className="mb-5 font-['Space_Grotesk',sans-serif] text-[1.1rem] font-bold text-[#1E293B]">About Me</h3>
              <div className="space-y-4">
                {company?.industry && (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[0.85rem] text-[#6B7280]"><FolderGit2 className="size-4" /> Categories</span>
                    <span className="text-[0.85rem] font-semibold text-[#1E293B]">{company.industry}</span>
                  </div>
                )}
                {profile.email && (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[0.85rem] text-[#6B7280]"><Mail className="size-4" /> Email</span>
                    <span className="text-[0.85rem] font-semibold text-[#1E293B]">{profile.email}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[0.85rem] text-[#6B7280]"><Phone className="size-4" /> Phone Number</span>
                    <span className="text-[0.85rem] font-semibold text-[#1E293B]">{profile.phone}</span>
                  </div>
                )}
                {company?.location && (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[0.85rem] text-[#6B7280]"><MapPin className="size-4" /> Location</span>
                    <span className="text-[0.85rem] font-semibold text-[#1E293B]">{company.location}</span>
                  </div>
                )}
                {company?.website && (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-[0.85rem] text-[#6B7280]"><Globe className="size-4" /> Website</span>
                    <a
                      href={/^https?:\/\//.test(company.website) ? company.website : `https://${company.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[0.85rem] font-semibold text-[#16A34A] hover:underline"
                    >
                      {company.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Me button */}
            {!isOwn && !!user && (
              <button
                type="button"
                onClick={() => nav({ to: "/app/messages" })}
                className="w-full border border-[#16A34A] bg-white py-3 text-[0.9rem] font-semibold text-[#16A34A] transition-colors hover:bg-[#16A34A] hover:text-white"
              >
                Contact Me ↗
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EditPanel({ profile, student, company, onDone }: any) {
  const isStudentOrAlumni = profile.role === "student" || profile.role === "alumni";
  const isCompany = profile.role === "company";
  const isIndividual = profile.role === "individual";
  const qc = useQueryClient();
  const saveProfile = useServerFn(saveProfileEdits);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [bio, setBio] = useState(profile.bio ?? "");
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  const [skills, setSkills] = useState<string[]>(student?.skills ?? []);
  const [university, setUniversity] = useState(student?.university ?? "");
  const [year, setYear] = useState(student?.year_of_study ?? "");
  const [department, setDepartment] = useState(student?.department ?? "");
  const [universityEmail, setUniversityEmail] = useState(student?.university_email ?? "");

  const [companyName, setCompanyName] = useState(company?.company_name ?? "");
  const [industry, setIndustry] = useState(company?.industry ?? "");
  const [location, setLocation] = useState(company?.location ?? "");
  const [website, setWebsite] = useState(company?.website ?? "");

  const [logoUrl, setLogoUrl] = useState(profile.avatar_url ?? null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const resolvedUniversity = university.trim() || null;

  async function uploadLogo(file: File) {
    if (!file || !profile.id) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    setLogoUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${profile.id}/logo.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error("Upload failed"); setLogoUploading(false); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    setLogoUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    setLogoUploading(false);
  }

  async function save() {
    setSaving(true);
    const profileUpdate: any = {
      bio: bio.trim() || null,
      avatar_url: logoUrl || null,
    };
    if (isIndividual || isCompany) {
      profileUpdate.full_name = fullName.trim() || profile.full_name;
      profileUpdate.email = email.trim() || null;
      profileUpdate.phone = phone.trim() || null;
    }
    const studentUpdate: any = isStudentOrAlumni ? {
      skills,
      university: resolvedUniversity || null,
      year_of_study: year || null,
      department: department || null,
      university_email: universityEmail.trim() || null,
    } : undefined;
    const companyUpdate: any = isCompany ? {
      company_name: companyName.trim() || profile.full_name,
      industry: industry.trim() || null,
      location: location.trim() || null,
      website: website.trim() || null,

    } : undefined;
    try {
      await saveProfile({ data: { profileUpdate, studentUpdate, companyUpdate } });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save profile");
      setSaving(false);
      return;
    }
    setSaving(false);
    toast.success("Profile saved");
    onDone();
  }

  // ── Company edit: Freeio-style layout ──
  if (isCompany) {
    return (
      <section className="space-y-0">
        <h2 className="px-4 pt-5 font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1E293B]">Edit Profile</h2>

        <div className="mt-4 border border-[#E2E8F0] bg-white p-6">
          <h3 className="mb-4 text-[0.95rem] font-semibold text-[#1E293B]">My Profile</h3>
          <div className="border-t border-[#E2E8F0] pt-4">
            <p className="mb-3 text-[0.8rem] font-medium text-[#1E293B]">Logo Image</p>
            <div className="flex items-start gap-4">
              <div className="relative size-24 shrink-0 overflow-hidden border border-[#E2E8F0] bg-[#FFFFFF]">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Building2 className="size-8 text-[#E2E8F0]" />
                  </div>
                )}
                {logoUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="size-5 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="border border-dashed border-[#E2E8F0] bg-[#fef4f4] px-4 py-2 text-[0.8rem] font-medium text-[#1E293B] transition-colors hover:bg-[#fde8e8]"
                >
                  Browse
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); }}
                />
                <p className="mt-1 text-[0.7rem] text-[#94A3B8]">JPG, PNG or WebP · Max 5MB</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 border border-[#E2E8F0] bg-white p-6">
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Employer name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Employer" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
            </div>
            <div className="space-y-1.5">

            </div>
            <div className="space-y-1.5">
              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Profile url</Label>
              <div className="flex items-center gap-2">
                <span className="text-[0.8rem] text-[#6B7280]">/app/profile/{profile.id?.slice(0, 8)}…</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Categories</Label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="flex h-10 w-full border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[0.85rem] text-[#1E293B]"
              >
                <option value="">Select category</option>
                <option value="Digital Marketing">Digital Marketing</option>
                <option value="Technology">Technology</option>
                <option value="Finance">Finance</option>
                <option value="Education">Education</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Media">Media</option>
                <option value="Consulting">Consulting</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employer@company.com" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
            </div>
            <div className="space-y-1.5">

            </div>
            <div className="space-y-1.5">
              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Website</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="envato.com" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Phone Number</Label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(+234)000-000-0000" className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Location</Label>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="flex h-10 w-full border border-[#E2E8F0] bg-[#FFFFFF] px-3 text-[0.85rem] text-[#1E293B]"
              >
                <option value="">Select location</option>
                <option value="Lagos">Lagos</option>
                <option value="Abuja">Abuja</option>
                <option value="Port Harcourt">Port Harcourt</option>
                <option value="Ibadan">Ibadan</option>
                <option value="Kano">Kano</option>
                <option value="Enugu">Enugu</option>
                <option value="Remote">Remote</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-1.5">              <Label className="text-[0.8rem] font-medium text-[#1E293B]">Description</Label>
            <Textarea
              rows={6}
              maxLength={200}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell students about your business and the kind of work you typically post."
              className="border-[#E2E8F0] bg-[#FFFFFF] text-[0.85rem] leading-relaxed"
            />
            <p className="text-right text-[0.7rem] text-[#94A3B8]">{bio.length}/200</p>
          </div>
        </div>

        <div className="mt-6 pb-6">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-[#16A34A] px-7 py-3 text-[0.9rem] font-semibold text-white shadow-[0_4px_14px_rgba(22,163,74,0.3)] transition-all hover:bg-[#34b85e] hover:shadow-[0_6px_20px_rgba(22,163,74,0.4)] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Profile"}
            {!saving && <span className="text-[1.1rem]">↗</span>}
          </button>
        </div>
      </section>
    );
  }

  // ── Student / Alumni / Individual edit: existing layout ──
  return (
    <section className="space-y-4 px-4 pt-4">
      {(isIndividual) && (
        <>
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
            isIndividual
              ? "Tell students a bit about yourself and what you need help with."
              : "Tell posters what you do and what makes you good at it."
          }
        />
      </div>

      {isStudentOrAlumni && (
        <>
          <div className="space-y-1.5">
            <Label>University</Label>
            <UniversitySelect
              value={university}
              onChange={(val) => {
                setUniversity(val);
                if (val !== "Other") {}
              }}
            />
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
          {profile.role === "student" && !student?.verified && (
            <div className="space-y-1.5">
              <Label>University email</Label>
              <Input
                type="email"
                value={universityEmail}
                onChange={(e) => setUniversityEmail(e.target.value)}
                placeholder="yourname@students.youruni.edu.ng"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-1.5">
              {SKILLS.map((sk) => {
                const sel = skills.includes(sk);
                return (
                  <button key={sk} type="button" onClick={() => setSkills(sel ? skills.filter((x) => x !== sk) : [...skills, sk])}
                    className={`rounded-full border px-2.5 py-1 text-xs ${sel ? "it-chip-active" : "border-border bg-card text-foreground"}`}>
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
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<any>(null);

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
    setCoverUrl(p.cover_url ?? null);
    setEditingProject(p);
    setAdding(true)
  }

  async function uploadCover(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setCoverUploading(true);
    const fileExt = file.name.split(".").pop() ?? "jpg";
    const filePath = `${userId}/projects/${editingProject?.id ?? `temp-${Date.now()}`}/cover.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
    if (uploadError) {
      setCoverUploading(false);
      toast.error("Could not upload cover image");
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    setCoverUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    setCoverUploading(false);
    toast.success("Cover image ready");
  }

  async function save() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);

    const basePayload = {
      title: title.trim(),
      description: description.trim() || null,
      link: link.trim() || null,
      cover_url: coverUrl || null,
    };

    const persistProject = async (payload: Record<string, any>) => {
      if (editingProject) {
        const { error } = await (supabase as any).from("student_projects").update(payload).eq("id", editingProject.id);
        if (error) throw error;
        toast.success("Project updated");
      } else {
        const { error } = await (supabase as any).from("student_projects").insert({ user_id: userId, ...payload });
        if (error) throw error;
        toast.success("Project added");
      }
    };

    try {
      await persistProject(basePayload);
    } catch (error: any) {
      const isMissingCoverColumn = error?.message?.includes("cover_url") || error?.code === "42703";
      if (isMissingCoverColumn) {
        const fallbackPayload = Object.fromEntries(Object.entries(basePayload).filter(([key]) => key !== "cover_url"));
        try {
          await persistProject(fallbackPayload);
          toast.warning("Cover image support is not enabled yet on this project table, so the project was saved without a cover image.");
        } catch (fallbackError: any) {
          toast.error(fallbackError?.message ?? "Couldn't save project");
        }
      } else {
        toast.error(error?.message ?? "Couldn't save project");
      }
    }

    setSaving(false);
    setTitle(""); 
    setDescription(""); 
    setLink("");
    setCoverUrl(null);
    setCoverUploading(false);
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
    <section className="pt-2">
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
            <Label>Description</Label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Write your project description exactly as you want it shown" />
          </div>
          <div className="space-y-1.5">
            <Label>External link (optional)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="e.g., GitHub or live URL" />
          </div>
          <div className="space-y-2">
            <Label>Project cover image (optional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => coverInputRef.current?.click()} disabled={coverUploading}>
                {coverUploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {coverUrl ? "Replace cover" : "Upload cover"}
              </Button>
              {coverUrl && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setCoverUrl(null)}>
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadCover(file);
              }}
            />
            {coverUrl ? (
              <img src={coverUrl} alt="Project cover preview" className="h-32 w-full rounded-xl border border-border object-cover" />
            ) : (
              <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-background/60 text-sm text-muted-foreground">
                No cover image yet
              </div>
            )}
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
              setCoverUrl(null);
              setCoverUploading(false);
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
            <li key={p.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
              <div className="relative">
                <button type="button" onClick={() => setSelectedProject(p)} className="block w-full text-left">
                  <div className="relative h-36 w-full bg-gradient-to-br from-primary/20 to-accent/20">
                    {p.cover_url ? (
                      <img src={p.cover_url} alt={p.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-end bg-gradient-to-br from-primary/20 via-background/80 to-accent/20 p-4">
                        <div className="rounded-full bg-background/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                          Project
                        </div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{p.title}</p>
                      {p.description && <p className="mt-1 line-clamp-2 text-xs text-white/80">{p.description}</p>}
                    </div>
                  </div>
                </button>
                {isOwn && (
                  <div className="absolute right-2 top-2 flex gap-1 rounded-full bg-background/80 p-1 shadow-sm backdrop-blur">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(p);
                      }}
                      aria-label="Edit project"
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(p.id);
                      }}
                      aria-label="Delete project"
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-xs font-medium text-muted-foreground">Tap to read more</span>
                {p.link && (
                  <a
                    href={/^https?:\/\//.test(p.link) ? p.link : `https://${p.link}`}
                    target="_blank"
                    rel="noreferrer"
                    className="it-link-accent inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <ExternalLink className="size-3" /> View
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={!!selectedProject} onOpenChange={(open) => { if (!open) setSelectedProject(null); }}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl px-4 pb-6 sm:px-6">
          <div className="space-y-4">
            {selectedProject?.cover_url && (
              <img src={selectedProject.cover_url} alt={selectedProject.title} className="h-56 w-full rounded-2xl border border-border object-cover" />
            )}
            <SheetHeader className="space-y-2 px-0 text-left">
              <SheetTitle>{selectedProject?.title ?? "Project details"}</SheetTitle>
            </SheetHeader>
            <div className="space-y-3">
              {selectedProject?.description ? (
                <div className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">
                  {selectedProject.description}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">This project has no description yet.</p>
              )}
              {selectedProject?.link && (
                <a
                  href={/^https?:\/\//.test(selectedProject.link) ? selectedProject.link : `https://${selectedProject.link}`}
                  target="_blank"
                  rel="noreferrer"
                  className="it-link-accent inline-flex items-center gap-1 text-sm font-medium"
                >
                  <ExternalLink className="size-3.5" /> Open project link
                </a>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </section>
    );
}

function PostedTasksSection({
  tasks,
  isOwn,
  deletingTaskId,
  onDeleteTask,
}: {
  tasks: any[];
  isOwn: boolean;
  deletingTaskId: string | null;
  onDeleteTask: (taskId: string) => void;
}) {
  if (!tasks || tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">No posted tasks yet.</p>;
  }
  return (
    <section className="pt-2">
      <h2 className="text-sm font-semibold">Posted tasks</h2>
      <ul className="mt-3 space-y-2">
        {tasks.map((t) => (
          <li key={t.id}>
            <div className="relative rounded-xl border border-border bg-card p-3 shadow-card transition-colors active:bg-accent/50">
              <Link to="/app/tasks/$taskId" params={{ taskId: t.id }} className="block pr-10">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{t.title}</p>
                  <span className="shrink-0 rounded-md bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
                    {t.budget_negotiable ? "Open" : `₦${Number(t.budget).toLocaleString("en-NG")}`}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-muted px-2 py-0.5">{t.category}</span>
                  <span className={`rounded-full px-2 py-0.5 ${
                    t.status === "open" ? "it-note-accent" :
                    t.status === "completed" ? "bg-muted text-muted-foreground" :
                    "bg-success/15 text-success"
                  }`}>
                    {t.status === "open" ? "Open" : t.status === "completed" ? "Completed" : "In progress"}
                  </span>
                </div>
              </Link>
              {isOwn && (
                <button
                  type="button"
                  onClick={() => onDeleteTask(t.id)}
                  disabled={deletingTaskId === t.id}
                  aria-label="Delete task"
                  className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#6B7280] shadow-sm transition-colors hover:border-[#efb5b5] hover:bg-[#fff3f3] hover:text-[#d64545] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingTaskId === t.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </button>
              )}
            </div>
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
    // Use a server function with service_role privileges to bypass the
    // student_profiles UPDATE trigger that queries profiles.is_admin
    // (the authenticated role lacks SELECT on that column).
    try {
      await submitStudentIdUpload({ data: { idUploadPath: filePath, switchToId: true } });
    } catch (e: any) {
      toast.error(`Could not submit for review: ${e?.message ?? "Please try again."}`);
      setUploading(false);
      return;
    }
     toast.success("ID submitted for review. We will notify you once verified.");
     setIdFile(null);
     setUploading(false);
     qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <div className="it-note-warning mt-3 rounded-xl border p-4 space-y-3">
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

function StudentVerificationSection({
  userId,
  verificationMethod,
  universityEmail,
}: {
  userId: string;
  verificationMethod?: string | null;
  universityEmail?: string | null;
}) {
  const qc = useQueryClient();

  const switchVerificationMethod = useMutation({
    mutationFn: async (nextMethod: "email" | "id_upload") => {
      await switchStudentVerificationMethod({ data: { method: nextMethod } });
    },
    onSuccess: (_data, nextMethod) => {
      toast.success(nextMethod === "email" ? "Switched to university email verification." : "Switched to student ID verification.");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (error: any) => toast.error(error?.message ?? "Could not switch verification method"),
  });

  const canUseEmail = !!universityEmail?.trim();

  return (
    <div className="space-y-3">
      {verificationMethod === "email" ? (
        <EmailVerificationSection userId={userId} universityEmail={universityEmail} />
      ) : (
        <ReuploadIDSection userId={userId} />
      )}

      <div className="rounded-xl border border-border bg-card/80 p-3 text-sm shadow-sm">
        <p className="font-medium text-foreground">Need a different option?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          You can switch between university email and student ID verification any time before approval.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {verificationMethod !== "email" && canUseEmail && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={switchVerificationMethod.isPending}
              onClick={() => switchVerificationMethod.mutate("email")}
            >
              Use university email instead
            </Button>
          )}
          {verificationMethod !== "id_upload" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={switchVerificationMethod.isPending}
              onClick={() => switchVerificationMethod.mutate("id_upload")}
            >
              Use student ID instead
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CompanyEmailVerificationSection({ userId, companyEmail }: { userId: string; companyEmail?: string | null }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const sendCode = useMutation({
    mutationFn: async () => {
      if (!companyEmail?.trim()) throw new Error("Add a company email in your profile first.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("You are signed out. Please log in again.");

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-company-verification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ company_email: companyEmail.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        if (data?.code === "EMAIL_VERIFICATION_NOT_CONFIGURED") {
          throw new Error("Company email verification is temporarily unavailable. Use CAC number verification from your profile.");
        }
        throw new Error(data?.error ?? "Could not send code");
      }
    },
    onSuccess: () => toast.success("Verification code sent."),
    onError: (e: any) => toast.error(e?.message ?? "Could not send code"),
  });

  const confirmCode = useMutation({
    mutationFn: async () => {
      if (!/^\d{6}$/.test(code.trim())) throw new Error("Enter the 6-digit code sent to your company email.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("You are signed out. Please log in again.");

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/confirm-company-verification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.error ?? "Could not verify code");
    },
    onSuccess: () => {
      toast.success("Company email verified successfully.");
      setCode("");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not verify code"),
  });

  return (
    <div className="it-note-warning mt-3 rounded-xl border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-warning">Email verification pending</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Confirm the 6-digit code sent to {companyEmail || "your company email"}.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Verification code</label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="Enter 6-digit code"
          inputMode="numeric"
          maxLength={6}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={sendCode.isPending || !companyEmail?.trim()}
          onClick={() => sendCode.mutate()}
        >
          {sendCode.isPending ? "Sending..." : "Resend code"}
        </Button>
        <Button
          disabled={confirmCode.isPending || code.length !== 6}
          onClick={() => confirmCode.mutate()}
        >
          {confirmCode.isPending ? "Verifying..." : "Verify"}
        </Button>
      </div>
    </div>
  );
}

function CompanyDocVerificationSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!docFile) return;
    setUploading(true);
    const fileExt = docFile.name.split(".").pop();
    const filePath = `${userId}/cac-cert.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("company-docs")
      .upload(filePath, docFile, { upsert: true });
    if (uploadError) {
      toast.error("Upload failed. Please try again.");
      setUploading(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("company_profiles")
      .update({
        verification_doc_url: filePath,
        verification_status: "pending",
      } as any)
      .eq("user_id", userId);
    if (updateError) {
      toast.error("Could not submit for review. Please try again.");
      setUploading(false);
      return;
    }
    toast.success("Document re-submitted for review. We will notify you once verified.");
    setDocFile(null);
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <div className="it-note-warning mt-3 rounded-xl border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-warning">Verification pending</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Your CAC certificate is under review. If it was rejected, upload a clearer copy below.
        </p>
      </div>
      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-warning/30 bg-background p-4 text-center cursor-pointer hover:border-warning/60 transition-colors"
        onClick={() => document.getElementById("company-doc-reupload-input")?.click()}
      >
        {docFile ? (
          <div className="space-y-1">
            <p className="text-sm font-medium text-success">✓ {docFile.name}</p>
            <p className="text-xs text-muted-foreground">Tap to change</p>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Tap to upload a new document</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
          </div>
        )}
      </div>
      <input
        id="company-doc-reupload-input"
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
      />
      <Button
        className="w-full"
        disabled={!docFile || uploading}
        onClick={handleUpload}
      >
        {uploading ? "Uploading..." : "Submit for review"}
      </Button>
    </div>
  );
}

function IndividualIdVerificationSection({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [idType, setIdType] = useState<"" | "NIN" | "voter_card" | "drivers_license" | "passport">("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit() {
    if (!idFile || !idType) return;
    setUploading(true);
    const fileExt = idFile.name.split(".").pop();
    const filePath = `${userId}/gov-id.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("individual-docs")
      .upload(filePath, idFile, { upsert: true });
    if (uploadError) {
      toast.error("Upload failed. Please try again.");
      setUploading(false);
      return;
    }
    const { error: updateError } = await (supabase as any)
      .from("individual_profiles")
      .upsert({
        user_id: userId,
        verification_method: "id_upload",
        id_type: idType,
        id_upload_path: filePath,
        verification_status: "pending_review",
      }, { onConflict: "user_id" });
    if (updateError) {
      toast.error("Could not submit for review. Please try again.");
      setUploading(false);
      return;
    }
    toast.success("ID submitted for review. We will notify you once verified.");
    setIdFile(null);
    setIdType("");
    setUploading(false);
    qc.invalidateQueries({ queryKey: ["profile", userId] });
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
      <div>
        <p className="text-sm font-medium text-foreground">Upgrade to Verified Individual</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload a government-issued ID to earn a Verified badge. Accepted: NIN slip, voter's card, driver's license, or international passport.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">ID type</Label>
        <select
          value={idType}
          onChange={(e) => setIdType(e.target.value as any)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Select ID type</option>
          <option value="NIN">NIN slip</option>
          <option value="voter_card">Voter's card</option>
          <option value="drivers_license">Driver's license</option>
          <option value="passport">International passport</option>
        </select>
      </div>
      <div
        className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => document.getElementById("individual-id-upload-input")?.click()}
      >
        {idFile ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-success">✓ {idFile.name}</p>
            <p className="text-xs text-muted-foreground">Tap to change</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="size-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Tap to upload your government ID</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or PDF · Max 5MB</p>
          </div>
        )}
      </div>
      <input
        id="individual-id-upload-input"
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
      />
      <Button
        className="w-full"
        disabled={!idFile || !idType || uploading}
        onClick={handleSubmit}
      >
        {uploading ? "Uploading..." : "Submit for review"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Your ID is stored securely and only used for verification.</p>
    </div>
  );
}

function EmailVerificationSection({ userId, universityEmail }: { userId: string; universityEmail?: string | null }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");

  const sendCode = useMutation({
    mutationFn: async () => {
      if (!universityEmail?.trim()) throw new Error("Add a university email in your profile first.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("You are signed out. Please log in again.");

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-student-verification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ university_email: universityEmail.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        if (data?.code === "EMAIL_VERIFICATION_NOT_CONFIGURED") {
          throw new Error("Student email verification is temporarily unavailable. Use student ID upload verification for now.");
        }
        throw new Error(data?.error ?? "Could not send code");
      }
    },
    onSuccess: () => toast.success("Verification code sent."),
    onError: (e: any) => toast.error(e?.message ?? "Could not send code"),
  });

  const confirmCode = useMutation({
    mutationFn: async () => {
      if (!/^\d{6}$/.test(code.trim())) throw new Error("Enter the 6-digit code sent to your university email.");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("You are signed out. Please log in again.");

      const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/confirm-student-verification-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) throw new Error(data?.error ?? "Could not verify code");
    },
    onSuccess: () => {
      toast.success("University email verified successfully.");
      setCode("");
      qc.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not verify code"),
  });

  return (
    <div className="it-note-warning mt-3 rounded-xl border p-4 space-y-3">
      <div>
        <p className="text-sm font-medium text-warning">Email verification pending</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Confirm the 6-digit code sent to {universityEmail || "your university email"}.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Verification code</label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="Enter 6-digit code"
          inputMode="numeric"
          maxLength={6}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          disabled={sendCode.isPending || !universityEmail?.trim()}
          onClick={() => sendCode.mutate()}
        >
          {sendCode.isPending ? "Sending..." : "Resend code"}
        </Button>
        <Button
          disabled={confirmCode.isPending || code.length !== 6}
          onClick={() => confirmCode.mutate()}
        >
          {confirmCode.isPending ? "Verifying..." : "Verify"}
        </Button>
      </div>
    </div>
  );
}
