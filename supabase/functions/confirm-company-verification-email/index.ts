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
    const code = String(payload?.code ?? "").trim();

    if (!/^\d{6}$/.test(code)) {
      return jsonResponse({ success: false, error: "Enter the 6-digit verification code" }, 400);
    }

    const { data: rec, error: recErr } = await supabase
      .from("company_email_verifications")
      .select("user_id, company_email, code_hash, code_expires_at, attempts, verified_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (recErr || !rec) {
      return jsonResponse({ success: false, error: "No pending verification request found" }, 404);
    }

    if (rec.verified_at) {
      return jsonResponse({ success: true, alreadyVerified: true, message: "Email already verified" });
    }

    if (new Date(rec.code_expires_at).getTime() < Date.now()) {
      return jsonResponse({ success: false, error: "This code has expired. Request a new code." }, 400);
    }

    if ((rec.attempts ?? 0) >= 5) {
      return jsonResponse({ success: false, error: "Too many failed attempts. Request a new code." }, 429);
    }

    const codeSecret = Deno.env.get("COMPANY_EMAIL_CODE_SECRET");
    if (!codeSecret) {
      return jsonResponse({
        success: false,
        code: "EMAIL_VERIFICATION_NOT_CONFIGURED",
        error: "Email verification is temporarily unavailable. Please try again later.",
      }, 503);
    }

    const expectedHash = await sha256(`${code}:${codeSecret}`);

    if (expectedHash !== rec.code_hash) {
      await supabase
        .from("company_email_verifications")
        .update({ attempts: (rec.attempts ?? 0) + 1 })
        .eq("user_id", user.id);

      return jsonResponse({ success: false, error: "Invalid verification code" }, 400);
    }

    const nowIso = new Date().toISOString();

    // Mark company as verified via email
    const { error: verifyErr } = await supabase
      .from("company_profiles")
      .update({
        company_email: rec.company_email,
        verification_method: "email",
        verification_status: "approved",
        verified: true,
        verified_at: nowIso,
      })
      .eq("user_id", user.id);

    if (verifyErr) {
      return jsonResponse({ success: false, error: verifyErr.message }, 500);
    }

    await supabase
      .from("company_email_verifications")
      .update({ verified_at: nowIso })
      .eq("user_id", user.id);

    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "verification_approved",
      message: "Your company email has been verified. Your Verified Business badge is now active.",
      link: "/app/profile/me",
    });

    return jsonResponse({ success: true, message: "Email verified successfully" });
  } catch (err: any) {
    console.error("[confirm-company-verification-email]", err);
    return jsonResponse({ success: false, error: "An unexpected error occurred. Please try again." }, 500);
  }
});
