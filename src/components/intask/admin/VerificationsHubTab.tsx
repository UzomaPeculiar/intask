import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminUserProfileSheet } from "@/components/intask/admin/shared";
import { CheckCircle2, Clock, Eye, XCircle } from "lucide-react";

export function VerificationsHubTab() {
  const [subTab, setSubTab] = useState<"students" | "companies" | "individuals" | "alumni">("students");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-verifications-hub"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [studentsRes, companiesRes, individualsRes, profilesRes] = await Promise.all([
        (supabase as any).from("admin_student_profiles").select("user_id, verified, verification_status, verification_method, created_at, updated_at"),
        (supabase as any).from("admin_company_profiles").select("user_id, verified, verification_status, created_at, verified_at, updated_at"),
        (supabase as any).from("admin_individual_profiles").select("user_id, verified, verification_status, created_at, verified_at, updated_at"),
        (supabase as any).from("profiles").select("id, role"),
      ]);

      if (studentsRes.error) throw studentsRes.error;
      if (companiesRes.error) throw companiesRes.error;
      if (individualsRes.error) throw individualsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const students = studentsRes.data ?? [];
      const companies = companiesRes.data ?? [];
      const individuals = individualsRes.data ?? [];
      const profiles = profilesRes.data ?? [];

      const alumniIds = new Set(profiles.filter((p: any) => p.role === "alumni").map((p: any) => p.id));
      const alumniRows = students.filter((s: any) => alumniIds.has(s.user_id));

      const pendingStudent = students.filter((s: any) => !s.verified && (s.verification_method === "id_upload" || s.verification_status === "pending" || s.verification_status === "pending_review")).length;
      const pendingCompany = companies.filter((c: any) => !c.verified && c.verification_status !== "rejected").length;
      const pendingIndividual = individuals.filter((i: any) => i.verification_status === "pending_review").length;
      const pendingAlumni = alumniRows.filter((a: any) => !a.verified).length;

      const rejectedCount =
        students.filter((s: any) => s.verification_status === "rejected").length +
        companies.filter((c: any) => c.verification_status === "rejected").length +
        individuals.filter((i: any) => i.verification_status === "rejected").length;

      const approvedCount =
        students.filter((s: any) => s.verified).length +
        companies.filter((c: any) => c.verified).length +
        individuals.filter((i: any) => i.verified).length;

      const processedCount = approvedCount + rejectedCount;
      const rejectionRate = processedCount > 0 ? (rejectedCount / processedCount) * 100 : 0;

      const durationHours: number[] = [];
      for (const c of companies) {
        if (!c.verified || !c.created_at) continue;
        const verifiedAt = c.verified_at ?? c.updated_at;
        if (!verifiedAt) continue;
        durationHours.push((new Date(verifiedAt).getTime() - new Date(c.created_at).getTime()) / (1000 * 60 * 60));
      }
      for (const i of individuals) {
        if (!i.verified || !i.created_at) continue;
        const verifiedAt = i.verified_at ?? i.updated_at;
        if (!verifiedAt) continue;
        durationHours.push((new Date(verifiedAt).getTime() - new Date(i.created_at).getTime()) / (1000 * 60 * 60));
      }
      for (const s of students) {
        if (!s.verified || !s.created_at || !s.updated_at) continue;
        durationHours.push((new Date(s.updated_at).getTime() - new Date(s.created_at).getTime()) / (1000 * 60 * 60));
      }
      const avgHours = durationHours.length > 0 ? durationHours.reduce((a, b) => a + b, 0) / durationHours.length : null;

      return { stats: { avgHours, queueDepth: pendingStudent + pendingCompany + pendingIndividual + pendingAlumni, rejectionRate, pendingStudent, pendingCompany, pendingIndividual, pendingAlumni } };
    },
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Verifications Hub</h2>
            <p className="text-xs text-muted-foreground">Consolidated review queue for student, company, individual, and alumni verification paths.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Avg verify time</p><p className="mt-1 text-xl font-semibold text-foreground">{isLoading ? "..." : data?.stats.avgHours == null ? "N/A" : `${Math.round(data.stats.avgHours)}h`}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Pending queue depth</p><p className="mt-1 text-xl font-semibold text-foreground">{data?.stats.queueDepth ?? 0}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Rejection rate</p><p className="mt-1 text-xl font-semibold text-foreground">{(data?.stats.rejectionRate ?? 0).toFixed(1)}%</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Student pending</p><p className="mt-1 text-xl font-semibold text-foreground">{data?.stats.pendingStudent ?? 0}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Company pending</p><p className="mt-1 text-xl font-semibold text-foreground">{data?.stats.pendingCompany ?? 0}</p></div>
        <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Individual pending</p><p className="mt-1 text-xl font-semibold text-foreground">{data?.stats.pendingIndividual ?? 0}</p></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([ ["students", "Student ID verifications"], ["companies", "Company verifications"], ["individuals", "Individual verifications"], ["alumni", "Alumni verification"] ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)} className={`rounded-lg px-4 py-2 text-sm font-medium ${subTab === key ? "bg-primary text-primary-foreground" : "border border-border bg-card text-foreground hover:bg-accent"}`}>{label}</button>
        ))}
      </div>

      {subTab === "students" && <StudentVerificationsTab />}
      {subTab === "companies" && <CompanyVerificationsTab />}
      {subTab === "individuals" && <IndividualVerificationsTab />}
      {subTab === "alumni" && <div className="rounded-xl border border-border bg-card p-6"><h3 className="text-sm font-semibold text-foreground">Alumni verification</h3><p className="mt-2 text-sm text-muted-foreground">Alumni currently inherit student verification records. If you later require separate alumni proof, this tab is ready for that workflow.</p><p className="mt-2 text-xs text-muted-foreground">Pending alumni count: {data?.stats.pendingAlumni ?? 0}</p></div>}
    </div>
  );
}

function StudentVerificationsTab() {
  const qc = useQueryClient();
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const { data: pending, isLoading, refetch } = useQuery({ queryKey: ["pending-students"], queryFn: async () => { const { data: rows, error } = await (supabase as any).from("admin_student_profiles").select("*").eq("verified", false).eq("verification_method", "id_upload").order("created_at", { ascending: true }); if (error) throw error; const userIds = (rows ?? []).map((r: any) => r.user_id).filter(Boolean); const { data: profiles, error: profileErr } = userIds.length > 0 ? await (supabase as any).from("admin_profiles").select("id, full_name, email").in("id", userIds) : { data: [], error: null }; if (profileErr) throw profileErr; const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p])); return (rows ?? []).map((r: any) => ({ ...r, profile: r.user_id && profileMap.has(r.user_id) ? profileMap.get(r.user_id) : null })); } });
  const approve = useMutation({ mutationFn: async (userId: string) => { const { error } = await supabase.from("student_profiles").update({ verified: true, verification_status: "approved" } as any).eq("user_id", userId); if (error) throw error; await supabase.from("notifications").insert({ user_id: userId, type: "verification_approved", message: "Your student ID has been verified. Your Verified Student badge is now active.", link: "/app/profile/me" }); }, onSuccess: () => { toast.success("Student verified successfully"); refetch(); qc.invalidateQueries({ queryKey: ["admin-command-center"] }); qc.invalidateQueries({ queryKey: ["admin-verifications-hub"] }); qc.invalidateQueries({ queryKey: ["admin-users-management"] }); }, onError: (e: any) => toast.error(e.message ?? "Could not approve") });
  const reject = useMutation({ mutationFn: async (userId: string) => { const { error } = await supabase.from("student_profiles").update({ verification_status: "rejected" } as any).eq("user_id", userId); if (error) throw error; await supabase.from("notifications").insert({ user_id: userId, type: "verification_rejected", message: "Your student ID could not be verified. Please upload a clearer photo of your valid student ID card.", link: "/app" }); }, onSuccess: () => { toast.success("Student rejected and notified"); refetch(); qc.invalidateQueries({ queryKey: ["admin-command-center"] }); qc.invalidateQueries({ queryKey: ["admin-verifications-hub"] }); qc.invalidateQueries({ queryKey: ["admin-users-management"] }); }, onError: (e: any) => toast.error(e.message ?? "Could not reject") });
  async function viewID(path: string) { const { data } = await supabase.storage.from("student-ids").createSignedUrl(path, 60); if (data?.signedUrl) setViewingImage(data.signedUrl); else toast.error("Could not load ID image"); }
  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;
  if (!pending || pending.length === 0) return <div className="rounded-xl border border-border bg-card p-10 text-center"><CheckCircle2 className="size-8 text-success mx-auto mb-3" /><p className="font-medium text-foreground">All caught up</p><p className="text-sm text-muted-foreground mt-1">No pending student ID verifications</p></div>;
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">{pending.length} pending verification{pending.length === 1 ? "" : "s"}</p><AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />{viewingImage && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingImage(null)}><div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}><img src={viewingImage} alt="Student ID" className="w-full rounded-xl" /><button onClick={() => setViewingImage(null)} className="absolute -top-3 -right-3 grid size-8 place-items-center rounded-full bg-card border border-border text-foreground">✕</button></div></div>}{pending.map((s: any) => <div key={s.user_id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3 mb-3"><div><button onClick={() => setViewingProfile(s.user_id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{s.profile?.full_name ?? "Unknown"}</button><p className="text-xs text-muted-foreground">{s.profile?.email}</p><p className="text-xs text-muted-foreground mt-0.5">{s.university} {s.year_of_study ? `· ${s.year_of_study}` : ""} {s.department ? `· ${s.department}` : ""}</p></div><span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning flex items-center gap-1"><Clock className="size-3" /> Pending</span></div><div className="flex gap-2 flex-wrap">{s.id_upload_path ? <Button variant="outline" size="sm" className="gap-1" onClick={() => viewID(s.id_upload_path)}><Eye className="size-3.5" /> View ID</Button> : <span className="text-xs text-muted-foreground italic">No ID uploaded — manual verification needed</span>}<Button size="sm" className="gap-1 bg-success text-success-foreground hover:bg-success/90" disabled={approve.isPending} onClick={() => approve.mutate(s.user_id)}><CheckCircle2 className="size-3.5" /> Approve</Button><Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={reject.isPending} onClick={() => reject.mutate(s.user_id)}><XCircle className="size-3.5" /> Reject</Button></div></div>)}</div>;
}

function IndividualVerificationsTab() {
  const qc = useQueryClient();
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const { data: pending, isLoading } = useQuery({ queryKey: ["pending-individuals"], queryFn: async () => { const { data: rows, error } = await (supabase as any).from("admin_individual_profiles").select("*").eq("verification_status", "pending_review").order("created_at", { ascending: true }); if (error) throw error; const userIds = (rows ?? []).map((r: any) => r.user_id).filter(Boolean); const { data: profiles, error: profileErr } = userIds.length > 0 ? await (supabase as any).from("admin_profiles").select("id, full_name, email").in("id", userIds) : { data: [], error: null }; if (profileErr) throw profileErr; const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p])); return (rows ?? []).map((r: any) => ({ ...r, profile: r.user_id && profileMap.has(r.user_id) ? profileMap.get(r.user_id) : null })); } });
  const approve = useMutation({ mutationFn: async (userId: string) => { const { error } = await (supabase as any).from("individual_profiles").update({ verified: true, verification_status: "approved", verified_at: new Date().toISOString() }).eq("user_id", userId); if (error) throw error; await supabase.from("notifications").insert({ user_id: userId, type: "verification_approved", message: "Your government ID has been verified. Your Verified Individual badge is now active.", link: "/app/profile/me" }); }, onSuccess: () => { toast.success("Individual verified successfully"); qc.invalidateQueries({ queryKey: ["pending-individuals"] }); qc.invalidateQueries({ queryKey: ["admin-command-center"] }); qc.invalidateQueries({ queryKey: ["admin-verifications-hub"] }); qc.invalidateQueries({ queryKey: ["admin-users-management"] }); qc.invalidateQueries({ queryKey: ["profile-details"] }); }, onError: (e: any) => toast.error(e.message ?? "Could not approve") });
  const reject = useMutation({ mutationFn: async (userId: string) => { const { error } = await (supabase as any).from("individual_profiles").update({ verification_status: "rejected" }).eq("user_id", userId); if (error) throw error; await supabase.from("notifications").insert({ user_id: userId, type: "verification_rejected", message: "Your government ID could not be verified. Please upload a clearer photo of a valid ID.", link: "/app" }); }, onSuccess: () => { toast.success("Individual rejected and notified"); qc.invalidateQueries({ queryKey: ["pending-individuals"] }); qc.invalidateQueries({ queryKey: ["admin-command-center"] }); qc.invalidateQueries({ queryKey: ["admin-verifications-hub"] }); qc.invalidateQueries({ queryKey: ["admin-users-management"] }); qc.invalidateQueries({ queryKey: ["profile-details"] }); }, onError: (e: any) => toast.error(e.message ?? "Could not reject") });
  async function viewID(path: string) { const { data } = await supabase.storage.from("individual-docs").createSignedUrl(path, 60); if (data?.signedUrl) setViewingImage(data.signedUrl); else toast.error("Could not load ID image"); }
  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;
  if (!pending || pending.length === 0) return <div className="rounded-xl border border-border bg-card p-10 text-center"><CheckCircle2 className="size-8 text-success mx-auto mb-3" /><p className="font-medium text-foreground">All caught up</p><p className="text-sm text-muted-foreground mt-1">No pending individual ID verifications</p></div>;
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">{pending.length} pending verification{pending.length === 1 ? "" : "s"}</p>{viewingImage && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingImage(null)}><div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}><img src={viewingImage} alt="Government ID" className="w-full rounded-xl" /><button onClick={() => setViewingImage(null)} className="absolute -top-3 -right-3 grid size-8 place-items-center rounded-full bg-card border border-border text-foreground">✕</button></div></div>}<AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />{pending.map((ind: any) => <div key={ind.user_id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3 mb-3"><div><button onClick={() => setViewingProfile(ind.user_id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{ind.profile?.full_name ?? "Unknown"}</button><p className="text-xs text-muted-foreground">{ind.profile?.email}</p>{ind.id_type && <p className="text-xs text-muted-foreground mt-1">ID type: {ind.id_type === "NIN" ? "National ID (NIN)" : ind.id_type === "voter_card" ? "Voter's card" : ind.id_type === "drivers_license" ? "Driver's license" : "International passport"}</p>}</div><span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning flex items-center gap-1"><Clock className="size-3" /> Pending</span></div><div className="flex gap-2 flex-wrap">{ind.id_upload_path ? <Button variant="outline" size="sm" className="gap-1" onClick={() => viewID(ind.id_upload_path)}><Eye className="size-3.5" /> View ID</Button> : <span className="text-xs text-muted-foreground italic">No ID uploaded</span>}<Button size="sm" className="gap-1 bg-success text-success-foreground hover:bg-success/90" disabled={approve.isPending} onClick={() => approve.mutate(ind.user_id)}><CheckCircle2 className="size-3.5" /> Approve</Button><Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={reject.isPending} onClick={() => reject.mutate(ind.user_id)}><XCircle className="size-3.5" /> Reject</Button></div></div>)}</div>;
}

function CompanyVerificationsTab() {
  const qc = useQueryClient();
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const { data: pending, isLoading, refetch } = useQuery({ queryKey: ["pending-companies"], queryFn: async () => { const { data, error } = await (supabase as any).from("admin_company_profiles").select("*").eq("verified", false).order("created_at", { ascending: true }); if (error) throw error; return data ?? []; } });
  const approve = useMutation({ mutationFn: async (userId: string) => { const { error } = await supabase.from("company_profiles").update({ verified: true, verification_status: "approved", verified_at: new Date().toISOString() } as any).eq("user_id", userId); if (error) throw error; await supabase.from("notifications").insert({ user_id: userId, type: "verification_approved", message: "Your business account has been verified. Your Verified Business badge is now active.", link: "/app/profile/me" }); }, onSuccess: () => { toast.success("Company verified successfully"); refetch(); qc.invalidateQueries({ queryKey: ["pending-companies"] }); qc.invalidateQueries({ queryKey: ["admin-command-center"] }); qc.invalidateQueries({ queryKey: ["admin-verifications-hub"] }); qc.invalidateQueries({ queryKey: ["admin-users-management"] }); qc.invalidateQueries({ queryKey: ["profile-details"] }); }, onError: (e: any) => toast.error(e.message ?? "Could not approve") });
  const reject = useMutation({ mutationFn: async (userId: string) => { const { error } = await supabase.from("company_profiles").update({ verification_status: "rejected" } as any).eq("user_id", userId); if (error) throw error; await supabase.from("notifications").insert({ user_id: userId, type: "verification_rejected", message: "Your business account could not be verified. Please contact support for assistance.", link: "/app" }); }, onSuccess: () => { toast.success("Company rejected and notified"); refetch(); qc.invalidateQueries({ queryKey: ["pending-companies"] }); qc.invalidateQueries({ queryKey: ["admin-command-center"] }); qc.invalidateQueries({ queryKey: ["admin-verifications-hub"] }); qc.invalidateQueries({ queryKey: ["admin-users-management"] }); qc.invalidateQueries({ queryKey: ["profile-details"] }); }, onError: (e: any) => toast.error(e.message ?? "Could not reject") });
  async function viewDoc(path: string) { const { data } = await supabase.storage.from("company-docs").createSignedUrl(path, 60); if (data?.signedUrl) setViewingImage(data.signedUrl); else toast.error("Could not load document image"); }
  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading...</div>;
  if (!pending || pending.length === 0) return <div className="rounded-xl border border-border bg-card p-10 text-center"><CheckCircle2 className="size-8 text-success mx-auto mb-3" /><p className="font-medium text-foreground">All caught up</p><p className="text-sm text-muted-foreground mt-1">No pending company verifications</p></div>;
  return <div className="space-y-4"><p className="text-sm text-muted-foreground">{pending.length} pending verification{pending.length === 1 ? "" : "s"}</p>{viewingImage && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setViewingImage(null)}><div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}><img src={viewingImage} alt="Company document" className="w-full rounded-xl" /><button onClick={() => setViewingImage(null)} className="absolute -top-3 -right-3 grid size-8 place-items-center rounded-full bg-card border border-border text-foreground">✕</button></div></div>}<AdminUserProfileSheet userId={viewingProfile} open={!!viewingProfile} onOpenChange={(open) => { if (!open) setViewingProfile(null); }} />{pending.map((c: any) => <div key={c.user_id} className="rounded-xl border border-border bg-card p-4"><div className="flex items-start justify-between gap-3 mb-3"><div><button onClick={() => setViewingProfile(c.user_id)} className="font-medium text-foreground hover:text-primary hover:underline text-left">{c.company_name ?? c.full_name}</button><p className="text-xs text-muted-foreground">{c.email}</p><p className="text-xs text-muted-foreground mt-0.5">{c.industry ? `${c.industry} ·` : ""} {c.location ?? ""} {c.website ? `· ${c.website}` : ""}</p>{c.verification_method && <p className="text-xs text-muted-foreground mt-1">Method: {c.verification_method === "email" ? "Company email" : "CAC certificate"}{c.company_email ? ` (${c.company_email})` : ""}{c.cac_number ? ` · CAC: ${c.cac_number}` : ""}</p>}</div><span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning flex items-center gap-1"><Clock className="size-3" /> Pending</span></div><div className="flex gap-2 flex-wrap">{c.verification_doc_url ? <Button variant="outline" size="sm" className="gap-1" onClick={() => viewDoc(c.verification_doc_url)}><Eye className="size-3.5" /> View document</Button> : c.verification_method === "email" ? <span className="text-xs text-muted-foreground italic">Awaiting email verification</span> : <span className="text-xs text-muted-foreground italic">No document uploaded</span>}<Button size="sm" className="gap-1 bg-success text-success-foreground hover:bg-success/90" disabled={approve.isPending} onClick={() => approve.mutate(c.user_id)}><CheckCircle2 className="size-3.5" /> Approve</Button><Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" disabled={reject.isPending} onClick={() => reject.mutate(c.user_id)}><XCircle className="size-3.5" /> Reject</Button></div></div>)}</div>;
}
