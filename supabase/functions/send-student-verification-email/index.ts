import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isLikelyUniversityEmail(email: string) {
  const e = email.toLowerCase();
  return e.includes(".edu") || e.includes("student") || e.includes("university");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) return jsonResponse({ success: false, error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const universityEmail = String(payload?.university_email ?? "").trim().toLowerCase();

    if (!universityEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(universityEmail)) {
      return jsonResponse({ success: false, error: "A valid university email is required" }, 400);
    }

    if (!isLikelyUniversityEmail(universityEmail)) {
      return jsonResponse({ success: false, error: "Please provide a valid university/student email address" }, 400);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFrom = Deno.env.get("STUDENT_VERIFICATION_FROM_EMAIL") ?? "InTask <onboarding@resend.dev>";

    if (!resendApiKey) {
      return jsonResponse({
        success: false,
        code: "EMAIL_VERIFICATION_NOT_CONFIGURED",
        error: "Student email verification is temporarily unavailable. Please try again later or use student ID upload verification.",
      }, 503);
    }

    const { data: studentProfile, error: spErr } = await supabase
      .from("student_profiles")
      .select("user_id, verification_method")
      .eq("user_id", user.id)
      .maybeSingle();

    if (spErr || !studentProfile) {
      return jsonResponse({ success: false, error: "Student profile not found" }, 404);
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const secret = Deno.env.get("STUDENT_EMAIL_CODE_SECRET") ?? "intask-student-email-code-secret";
    const codeHash = await sha256(`${code}:${secret}`);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: upsertErr } = await supabase
      .from("student_email_verifications")
      .upsert({
        user_id: user.id,
        university_email: universityEmail,
        code_hash: codeHash,
        code_expires_at: expiresAt,
        attempts: 0,
        verified_at: null,
      }, { onConflict: "user_id" });

    if (upsertErr) {
      return jsonResponse({ success: false, error: upsertErr.message }, 500);
    }

    const { error: studentUpdateErr } = await supabase
      .from("student_profiles")
      .update({
        university_email: universityEmail,
        verification_method: "email",
        verified: false,
        verification_status: "pending",
      })
      .eq("user_id", user.id);

    if (studentUpdateErr) {
      return jsonResponse({ success: false, error: studentUpdateErr.message }, 500);
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resendFrom,
        to: ["uzomapeculiar1@gmail.com"],
        subject: "Your InTask student verification code",
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
            <h2>Verify your student status on InTask</h2>
            <p>Use this one-time code to confirm your university email:</p>
            <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${code}</p>
            <p>This code expires in 10 minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
          </div>
        `,
      }),
    });

    const emailData = await emailRes.json().catch(() => ({}));
    if (!emailRes.ok) {
      return jsonResponse({
        success: false,
        error: (emailData as any)?.message ?? "Failed to send verification email",
      }, 500);
    }

    return jsonResponse({ success: true, message: "Verification code sent" });
  } catch (err: any) {
    return jsonResponse({ success: false, error: err?.message ?? "Unknown error" }, 500);
  }
});
