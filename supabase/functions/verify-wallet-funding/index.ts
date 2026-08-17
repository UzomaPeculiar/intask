import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reference } = await req.json();
    const ref = String(reference ?? "").trim();
    if (!ref) {
      return new Response(JSON.stringify({ success: false, error: "Funding reference is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({
          success: false,
          pending: false,
          message: "Wallet verification is not configured (missing PAYSTACK_SECRET_KEY).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const verifyData = (await verifyRes.json()) as any;

    if (!verifyRes.ok || !verifyData?.status) {
      return new Response(
        JSON.stringify({
          success: false,
          pending: true,
          message: verifyData?.message ?? "Verification is still pending",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (verifyData?.data?.status !== "success") {
      return new Response(
        JSON.stringify({
          success: false,
          pending: true,
          message: `Payment status: ${verifyData?.data?.status ?? "pending"}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const metadataUserId = verifyData?.data?.metadata?.user_id;
    if (metadataUserId !== user.id) {
      return new Response(
        JSON.stringify({
          success: false,
          pending: false,
          message: "This funding reference does not belong to your account.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const metadataType = verifyData?.data?.metadata?.type;
    if (metadataType && metadataType !== "wallet_funding") {
      return new Response(
        JSON.stringify({ success: false, pending: false, message: "This payment is not a wallet funding transaction." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ref.startsWith("FUND_")) {
      return new Response(
        JSON.stringify({ success: false, pending: false, message: "Invalid wallet funding reference." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const amount = Number(verifyData?.data?.amount ?? 0) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ success: false, error: "Invalid verified amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creditData, error: creditErr } = await supabase.rpc("credit_wallet", {
      p_user_id: user.id,
      p_amount: amount,
      p_description: "Wallet top-up via Paystack",
      p_reference: ref,
    });

    const rpcSaysFailure = creditData && creditData.success === false;
    if (creditErr || rpcSaysFailure) {
      return new Response(
        JSON.stringify({ success: false, error: creditErr?.message ?? creditData?.error ?? "Could not credit wallet" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark the funding record complete so the admin financial tab reflects the
    // payment even when the charge.success webhook is delayed or points at a
    // different endpoint. credit_wallet is idempotent by reference, so a retry
    // after an error here is safe.
    const { error: fundingUpdateErr } = await supabase
      .from("wallet_funding")
      .update({ status: "completed", webhook_processed: true, updated_at: new Date().toISOString() })
      .eq("paystack_reference", ref);

    if (fundingUpdateErr) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Wallet credited but funding record could not be marked complete: ${fundingUpdateErr.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true, credited: true, amount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[verify-wallet-funding]", err);
    return new Response(JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
