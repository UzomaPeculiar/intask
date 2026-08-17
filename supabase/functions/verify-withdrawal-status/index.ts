import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ success: false, error: "Function not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!paystackSecret) {
      return new Response(JSON.stringify({ success: false, error: "Missing PAYSTACK_SECRET_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    const supabaseUser = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { reference } = await req.json();
    const ref = String(reference ?? "").trim();
    if (!ref || !ref.startsWith("WD_")) {
      return new Response(JSON.stringify({ success: false, error: "Valid withdrawal reference is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: withdrawal, error: withdrawalError } = await supabaseUser
      .from("withdrawal_requests")
      .select("id, user_id, amount, net_amount, reference, status, webhook_processed")
      .eq("reference", ref)
      .eq("user_id", user.id)
      .maybeSingle();

    if (withdrawalError || !withdrawal) {
      return new Response(JSON.stringify({ success: false, error: "Withdrawal request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (withdrawal.webhook_processed || ["completed", "failed", "reversed", "rejected"].includes(withdrawal.status)) {
      return new Response(JSON.stringify({ success: true, updated: false, status: withdrawal.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const verifyRes = await fetch(`https://api.paystack.co/transfer/verify/${encodeURIComponent(ref)}`, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const verifyData = (await verifyRes.json()) as any;
    if (!verifyRes.ok || !verifyData?.status) {
      return new Response(JSON.stringify({ success: false, pending: true, status: "pending", message: verifyData?.message ?? "Transfer verification is still pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transferStatus = String(verifyData?.data?.status ?? "pending").toLowerCase();

    if (transferStatus === "success") {
      const { data: claimed } = await supabase
        .from("withdrawal_requests")
        .update({ status: "completed", processed_at: new Date().toISOString(), webhook_processed: true })
        .eq("id", withdrawal.id)
        .eq("webhook_processed", false)
        .select("id")
        .maybeSingle();

      if (claimed) {
        // Route through the SECURITY DEFINER function: direct UPDATEs on
        // wallet_transactions can fail on environments with drifted grants.
        await supabase.rpc("mark_wallet_transaction_status", {
          p_user_id: user.id,
          p_reference: ref,
          p_status: "completed",
        });
      }

      return new Response(JSON.stringify({ success: true, updated: !!claimed, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (transferStatus === "failed" || transferStatus === "reversed") {
      const newStatus = transferStatus === "failed" ? "failed" : "reversed";
      const reason = verifyData?.data?.reason ?? transferStatus;

      const { data: claimed } = await supabase
        .from("withdrawal_requests")
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
          webhook_processed: true,
          failure_reason: reason,
        })
        .eq("id", withdrawal.id)
        .eq("webhook_processed", false)
        .select("id")
        .maybeSingle();

      if (claimed) {
        await supabase.rpc("reverse_wallet_debit", {
          p_user_id: user.id,
          p_amount: withdrawal.amount,
          p_description: `Withdrawal ${newStatus} - funds returned`,
          p_reference: ref,
        });
        await supabase.rpc("mark_wallet_transaction_status", {
          p_user_id: user.id,
          p_reference: ref,
          p_status: newStatus,
        });
      }

      return new Response(JSON.stringify({ success: true, updated: !!claimed, status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: false, pending: true, status: transferStatus, message: `Transfer status: ${transferStatus}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[verify-withdrawal-status]", err);
    return new Response(JSON.stringify({ success: false, error: "An unexpected error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});