import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const SUPABASE_BASE_URL = import.meta.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_FUNCTIONS_URL = `${SUPABASE_BASE_URL.replace(/\/$/, "")}/functions/v1`;

export const Route = createFileRoute("/app/verify")({
  head: () => ({ meta: [{ title: "Verification Details — InTask" }] }),
  component: VerifyPage,
} as any);

function VerifyPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["verify-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["verify-company", user?.id],
    enabled: !!user?.id && profile?.role === "company",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_profiles")
        .select("verified, verification_method, company_email, verification_status, verification_doc_url")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ["verify-student", user?.id],
    enabled: !!user?.id && (profile?.role === "student" || profile?.role === "alumni"),
    queryFn: async () => {
      const { data } = await supabase
        .from("student_profiles")
        .select("verified, verification_method, university_email, verification_status")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: individual, isLoading: individualLoading } = useQuery({
    queryKey: ["verify-individual", user?.id],
    enabled: !!user?.id && profile?.role === "individual",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("individual_profiles")
        .select("verified, verification_status")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const isLoading = profileLoading || companyLoading || studentLoading || individualLoading;
  const role = profile?.role;

  // Determine verification status
  const isVerified = role === "company" ? company?.verified : role === "student" || role === "alumni" ? student?.verified : role === "individual" ? individual?.verified : false;

  const hasSubmitted = role === "company"
    ? !!(company?.verification_status === "pending" || company?.verification_doc_url)
    : role === "student" || role === "alumni"
    ? !!(student as any)?.verification_status || !!(student as any)?.university_email
    : role === "individual"
    ? (individual as any)?.verification_status === "pending_review"
    : false;

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [revoking, setRevoking] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="size-5 animate-spin text-[#6B7280]" />
      </div>
    );
  }

  // Already verified
  if (isVerified) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-[700px]">
          <h1 className="mb-6 font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1E293B]">Verification Details</h1>
          <div className="border border-[#E2E8F0] bg-white p-6">
            <p className="text-[0.9rem] text-[#6B7280]">
              Your account has been verified. Your profile now displays a verified badge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Already submitted, pending review
  if (hasSubmitted) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-[700px]">
          <h1 className="mb-6 font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1E293B]">Verification Details</h1>
          <div className="border border-[#E2E8F0] bg-white p-6">
            <p className="mb-5 text-[0.9rem] text-[#6B7280]">
              You have already sent the verification document. Please revoke verification to send again.
            </p>
            <button
              type="button"
              onClick={async () => {
                setRevoking(true);
                try {
                  if (role === "company") {
                    await (supabase as any).from("company_profiles").update({ verification_status: null, verification_doc_url: null } as any).eq("user_id", user!.id);
                  } else if (role === "student" || role === "alumni") {
                    await supabase.from("student_profiles").update({ verification_method: null } as any).eq("user_id", user!.id);
                  }
                  toast.success("Verification revoked. You can now submit again.");
                  qc.invalidateQueries({ queryKey: ["verify-company", user?.id] });
                  qc.invalidateQueries({ queryKey: ["verify-student", user?.id] });
                  qc.invalidateQueries({ queryKey: ["verify-individual", user?.id] });
                } catch {
                  toast.error("Could not revoke verification.");
                }
                setRevoking(false);
              }}
              disabled={revoking}
              className="inline-flex items-center gap-2 bg-[#16A34A] px-6 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
            >
              {revoking ? "Revoking..." : "Revoke Verification"} <ExternalLink className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No submission yet - show verification form
  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-[700px]">
        <h1 className="mb-6 font-['Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1E293B]">Verification Details</h1>

        {/* Company: email or CAC */}
        {role === "company" && (
          <div className="border border-[#E2E8F0] bg-white p-6 space-y-5">
            <p className="text-[0.9rem] text-[#6B7280]">
              Verify your company to build trust with students. Choose a verification method below.
            </p>

            {/* Email verification */}
            {company?.verification_method === "email" || (!company?.verification_method && company?.company_email) ? (
              <div className="space-y-4">
                <p className="text-[0.85rem] text-[#6B7280]">
                  A verification code will be sent to <span className="font-medium text-[#1E293B]">{company?.company_email}</span>.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[0.8rem] font-medium text-[#1E293B]">Verification code</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    className="border-[#E2E8F0] text-[0.85rem]"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!company?.company_email) { toast.error("Add a company email in your profile first."); return; }
                      setSending(true);
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const token = sessionData.session?.access_token;
                        if (!token) throw new Error("Signed out.");
                        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-company-verification-email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ company_email: company.company_email }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data?.success === false) throw new Error(data?.error ?? "Could not send code");
                        toast.success("Verification code sent.");
                      } catch (e: any) { toast.error(e?.message ?? "Could not send code"); }
                      setSending(false);
                    }}
                    disabled={sending}
                    className="border border-[#E2E8F0] bg-white px-5 py-2.5 text-[0.85rem] font-medium text-[#1E293B] transition-colors hover:bg-[#f6fbf4] disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Send Code"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!/^\d{6}$/.test(code.trim())) { toast.error("Enter the 6-digit code."); return; }
                      setVerifying(true);
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const token = sessionData.session?.access_token;
                        if (!token) throw new Error("Signed out.");
                        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/confirm-company-verification-email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ code: code.trim() }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data?.success === false) throw new Error(data?.error ?? "Could not verify");
                        toast.success("Company verified successfully.");
                        setCode("");
                        qc.invalidateQueries({ queryKey: ["verify-company", user?.id] });
                        qc.invalidateQueries({ queryKey: ["profile", user?.id] });
                      } catch (e: any) { toast.error(e?.message ?? "Could not verify"); }
                      setVerifying(false);
                    }}
                    disabled={verifying || code.length !== 6}
                    className="inline-flex items-center gap-2 bg-[#16A34A] px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
                  >
                    {verifying ? "Verifying..." : "Verify"} <ExternalLink className="size-4" />
                  </button>
                </div>
              </div>
            ) : company?.verification_method === "cac_number" ? (
              <div className="space-y-4">
                <p className="text-[0.85rem] text-[#6B7280]">Upload your CAC certificate for review.</p>
                <div
                  className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center cursor-pointer hover:border-[#16A34A]/40 transition-colors"
                  onClick={() => document.getElementById("verify-doc-input")?.click()}
                >
                  {docFile ? (
                    <p className="text-[0.85rem] font-medium text-[#16A34A]">✓ {docFile.name}</p>
                  ) : (
                    <>
                      <p className="text-[0.85rem] text-[#6B7280]">Tap to upload CAC certificate</p>
                      <p className="mt-1 text-[0.75rem] text-[#94A3B8]">JPG, PNG or PDF · Max 5MB</p>
                    </>
                  )}
                </div>
                <input id="verify-doc-input" type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                <button
                  type="button"
                  onClick={async () => {
                    if (!docFile) return;
                    setUploading(true);
                    const ext = docFile.name.split(".").pop();
                    const path = `${user!.id}/cac-cert.${ext}`;
                    const { error: upErr } = await supabase.storage.from("company-docs").upload(path, docFile, { upsert: true });
                    if (upErr) { toast.error("Upload failed."); setUploading(false); return; }
                    const { error: dbErr } = await (supabase as any).from("company_profiles").update({ verification_doc_url: path, verification_status: "pending" }).eq("user_id", user!.id);
                    if (dbErr) { toast.error("Could not submit."); setUploading(false); return; }
                    toast.success("Document submitted for review.");
                    setDocFile(null);
                    setUploading(false);
                    qc.invalidateQueries({ queryKey: ["verify-company", user?.id] });
                  }}
                  disabled={!docFile || uploading}
                  className="inline-flex items-center gap-2 bg-[#16A34A] px-6 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Submit for Review"} <ExternalLink className="size-4" />
                </button>
              </div>
            ) : (
              <CompanySetup userId={user!.id} onDone={() => qc.invalidateQueries({ queryKey: ["verify-company", user?.id] })} />
            )}
          </div>
        )}

        {/* Student/Alumni */}
        {(role === "student" || role === "alumni") && (
          <div className="border border-[#E2E8F0] bg-white p-6 space-y-5">
            <p className="text-[0.9rem] text-[#6B7280]">
              Verify your student status using your university email.
            </p>

            {(student as any)?.university_email ? (
              <div className="space-y-4">
                <p className="text-[0.85rem] text-[#6B7280]">
                  A verification code will be sent to <span className="font-medium text-[#1E293B]">{(student as any).university_email}</span>.
                </p>
                <div className="space-y-1.5">
                  <label className="text-[0.8rem] font-medium text-[#1E293B]">Verification code</label>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                    className="border-[#E2E8F0] text-[0.85rem]"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setSending(true);
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const token = sessionData.session?.access_token;
                        if (!token) throw new Error("Signed out.");
                        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/send-student-verification-email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ university_email: (student as any).university_email }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data?.success === false) throw new Error(data?.error ?? "Could not send code");
                        toast.success("Verification code sent.");
                      } catch (e: any) { toast.error(e?.message ?? "Could not send code"); }
                      setSending(false);
                    }}
                    disabled={sending}
                    className="border border-[#E2E8F0] bg-white px-5 py-2.5 text-[0.85rem] font-medium text-[#1E293B] transition-colors hover:bg-[#f6fbf4] disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Send Code"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!/^\d{6}$/.test(code.trim())) { toast.error("Enter the 6-digit code."); return; }
                      setVerifying(true);
                      try {
                        const { data: sessionData } = await supabase.auth.getSession();
                        const token = sessionData.session?.access_token;
                        if (!token) throw new Error("Signed out.");
                        const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/confirm-student-verification-email`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ code: code.trim() }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok || data?.success === false) throw new Error(data?.error ?? "Could not verify");
                        toast.success("Student email verified successfully.");
                        setCode("");
                        qc.invalidateQueries({ queryKey: ["verify-student", user?.id] });
                        qc.invalidateQueries({ queryKey: ["profile", user?.id] });
                      } catch (e: any) { toast.error(e?.message ?? "Could not verify"); }
                      setVerifying(false);
                    }}
                    disabled={verifying || code.length !== 6}
                    className="inline-flex items-center gap-2 bg-[#16A34A] px-5 py-2.5 text-[0.85rem] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
                  >
                    {verifying ? "Verifying..." : "Verify"} <ExternalLink className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              <StudentSetup userId={user!.id} onDone={() => qc.invalidateQueries({ queryKey: ["verify-student", user?.id] })} />
            )}
          </div>
        )}

        {/* Individual */}
        {role === "individual" && (
          <IndividualSetup userId={user!.id} onDone={() => qc.invalidateQueries({ queryKey: ["verify-individual", user?.id] })} />
        )}
      </div>
    </div>
  );
}

function CompanySetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [method, setMethod] = useState<"" | "email" | "cac">("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [cacNumber, setCacNumber] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const update: any = { verification_method: method };
    if (method === "email") update.company_email = companyEmail.trim() || null;
    if (method === "cac") update.cac_number = cacNumber.trim() || null;
    const { error } = await (supabase as any).from("company_profiles").update(update).eq("user_id", userId);
    if (error) { toast.error("Could not save."); setSaving(false); return; }
    toast.success("Verification method saved.");
    setSaving(false);
    onDone();
  }

  return (
    <div className="border border-[#E2E8F0] bg-white p-6 space-y-5">
      <p className="text-[0.9rem] text-[#6B7280]">Choose a verification method for your company.</p>

      <div className="space-y-3">
        <label className="flex items-center gap-3 border border-[#E2E8F0] bg-[#F8FAFC] p-4 cursor-pointer transition-colors hover:border-[#16A34A]/40 has-[:checked]:border-[#16A34A] has-[:checked]:bg-[#DCFCE7]">
          <input type="radio" name="verify-method" value="email" checked={method === "email"} onChange={() => setMethod("email")} className="accent-[#16A34A]" />
          <div>
            <p className="text-[0.85rem] font-semibold text-[#1E293B]">Verify via Company Email</p>
            <p className="text-[0.75rem] text-[#6B7280]">Receive a verification code at your company email</p>
          </div>
        </label>
        <label className="flex items-center gap-3 border border-[#E2E8F0] bg-[#F8FAFC] p-4 cursor-pointer transition-colors hover:border-[#16A34A]/40 has-[:checked]:border-[#16A34A] has-[:checked]:bg-[#DCFCE7]">
          <input type="radio" name="verify-method" value="cac" checked={method === "cac"} onChange={() => setMethod("cac")} className="accent-[#16A34A]" />
          <div>
            <p className="text-[0.85rem] font-semibold text-[#1E293B]">Verify via CAC Document</p>
            <p className="text-[0.75rem] text-[#6B7280]">Upload your CAC certificate for review</p>
          </div>
        </label>
      </div>

      {method === "email" && (
        <div className="space-y-1.5">
          <label className="text-[0.8rem] font-medium text-[#1E293B]">Company email</label>
          <Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="hr@company.com" className="border-[#E2E8F0] text-[0.85rem]" />
        </div>
      )}
      {method === "cac" && (
        <div className="space-y-1.5">
          <label className="text-[0.8rem] font-medium text-[#1E293B]">CAC Number</label>
          <Input value={cacNumber} onChange={(e) => setCacNumber(e.target.value)} placeholder="Enter your CAC number" className="border-[#E2E8F0] text-[0.85rem]" />
        </div>
      )}

      {method && (
        <button
          type="button"
          onClick={save}
          disabled={saving || (method === "email" && !companyEmail.trim()) || (method === "cac" && !cacNumber.trim())}
          className="inline-flex items-center gap-2 bg-[#16A34A] px-6 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Continue"} <ExternalLink className="size-4" />
        </button>
      )}
    </div>
  );
}

function StudentSetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [universityEmail, setUniversityEmail] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!universityEmail.trim()) { toast.error("Enter your university email."); return; }
    setSaving(true);
    const { error } = await supabase.from("student_profiles").update({ university_email: universityEmail.trim(), verification_method: "email" } as any).eq("user_id", userId);
    if (error) { toast.error("Could not save."); setSaving(false); return; }
    toast.success("University email saved.");
    setSaving(false);
    onDone();
  }

  return (
    <div className="border border-[#E2E8F0] bg-white p-6 space-y-5">
      <p className="text-[0.9rem] text-[#6B7280]">Enter your university email to verify your student status.</p>
      <div className="space-y-1.5">
        <label className="text-[0.8rem] font-medium text-[#1E293B]">University email</label>
        <Input type="email" value={universityEmail} onChange={(e) => setUniversityEmail(e.target.value)} placeholder="yourname@students.youruni.edu.ng" className="border-[#E2E8F0] text-[0.85rem]" />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={saving || !universityEmail.trim()}
        className="inline-flex items-center gap-2 bg-[#16A34A] px-6 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
      >
        {saving ? "Saving..." : "Continue"} <ExternalLink className="size-4" />
      </button>
    </div>
  );
}

function IndividualSetup({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [idFile, setIdFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!idFile) return;
    setUploading(true);
    const ext = idFile.name.split(".").pop();
    const filePath = `${userId}/id-doc.${ext}`;
    const { error: uploadError } = await supabase.storage.from("company-docs").upload(filePath, idFile, { upsert: true });
    if (uploadError) { toast.error("Upload failed."); setUploading(false); return; }
    const { error: updateError } = await (supabase as any).from("individual_profiles").upsert({ user_id: userId, verification_doc_url: filePath, verification_status: "pending_review", verification_method: "id_upload" } as any, { onConflict: "user_id" });
    if (updateError) { toast.error("Could not submit."); setUploading(false); return; }
    toast.success("ID submitted for review.");
    setIdFile(null);
    setUploading(false);
    onDone();
  }

  return (
    <div className="border border-[#E2E8F0] bg-white p-6 space-y-5">
      <p className="text-[0.9rem] text-[#6B7280]">Upload your government ID to verify your identity.</p>
      <div
        className="flex flex-col items-center justify-center border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center cursor-pointer hover:border-[#16A34A]/40 transition-colors"
        onClick={() => document.getElementById("individual-id-input")?.click()}
      >
        {idFile ? (
          <p className="text-[0.85rem] font-medium text-[#16A34A]">✓ {idFile.name}</p>
        ) : (
          <>
            <p className="text-[0.85rem] text-[#6B7280]">Tap to upload your government ID</p>
            <p className="mt-1 text-[0.75rem] text-[#94A3B8]">JPG, PNG or PDF · Max 5MB</p>
          </>
        )}
      </div>
      <input id="individual-id-input" type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
      <button
        type="button"
        onClick={handleUpload}
        disabled={!idFile || uploading}
        className="inline-flex items-center gap-2 bg-[#16A34A] px-6 py-3 text-[0.9rem] font-semibold text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
      >
        {uploading ? "Uploading..." : "Submit for Review"} <ExternalLink className="size-4" />
      </button>
    </div>
  );
}
