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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { amount, bank_account_id } = await req.json();

    if (!amount || amount < 550) {
      return new Response(JSON.stringify({ error: "Minimum withdrawal is ₦550 (₦500 + ₦50 fee)" }), { status: 400, headers: corsHeaders });
    }

    // Get bank account and recipient code
    const { data: bankAccount, error: bankError } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("id", bank_account_id)
      .eq("user_id", user.id)
      .single();

    if (bankError || !bankAccount) {
      return new Response(JSON.stringify({ error: "Bank account not found" }), { status: 400, headers: corsHeaders });
    }

    if (!bankAccount.paystack_recipient_code) {
      return new Response(JSON.stringify({ error: "Bank account not verified with Paystack. Please re-add your bank account." }), { status: 400, headers: corsHeaders });
    }

    // Check for pending withdrawal (prevent simultaneous)
    const { data: pendingWithdrawals } = await supabase
      .from("withdrawal_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending");

    if (pendingWithdrawals && pendingWithdrawals.length > 0) {
      return new Response(JSON.stringify({ error: "You have a pending withdrawal. Please wait for it to complete." }), { status: 400, headers: corsHeaders });
    }

    // Generate unique reference
    const reference = `WD_${user.id.replace(/-/g, "").slice(0, 8)}_${Date.now()}`;
    const fee = 50;
    const net_amount = amount - fee;

    // Atomic wallet debit
    const { data: debitResult, error: debitError } = await supabase
      .rpc("debit_wallet_atomic", {
        p_user_id: user.id,
        p_amount: amount,
        p_description: `Withdrawal to ${bankAccount.bank_name} - ${bankAccount.account_number}`,
        p_reference: reference,
      });

    if (debitError || !debitResult?.success) {
      return new Response(JSON.stringify({ error: debitResult?.error ?? "Could not debit wallet" }), { status: 400, headers: corsHeaders });
    }

    // Create withdrawal record
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        wallet_id: debitResult.wallet_id,
        amount,
        fee,
        net_amount,
        bank_name: bankAccount.bank_name,
        account_number: bankAccount.account_number,
        account_name: bankAccount.account_name,
        recipient_code: bankAccount.paystack_recipient_code,
        bank_account_id,
        reference,
        status: "pending",
      })
      .select("id")
      .single();

    if (withdrawalError) {
      // Reverse the wallet debit if withdrawal record creation fails
      await supabase.rpc("reverse_wallet_debit", {
        p_user_id: user.id,
        p_amount: amount,
        p_description: "Withdrawal failed - refunded",
        p_reference: reference,
      });
      throw withdrawalError;
    }

    // Initiate Paystack transfer
    const transferRes = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "balance",
        amount: net_amount * 100, // Paystack uses kobo
        recipient: bankAccount.paystack_recipient_code,
        reason: `InTask withdrawal - ${reference}`,
        reference,
      }),
    });

    const transferData = await transferRes.json();

    if (!transferData.status) {
      // Reverse wallet debit on Paystack failure
      await supabase.rpc("reverse_wallet_debit", {
        p_user_id: user.id,
        p_amount: amount,
        p_description: "Withdrawal failed - Paystack error",
        p_reference: reference,
      });
      await supabase
        .from("withdrawal_requests")
        .update({ status: "failed", failure_reason: transferData.message })
        .eq("id", withdrawal.id);

      return new Response(JSON.stringify({ error: transferData.message ?? "Transfer failed" }), { status: 400, headers: corsHeaders });
    }

    // Update withdrawal with transfer code
    await supabase
      .from("withdrawal_requests")
      .update({ paystack_transfer_code: transferData.data.transfer_code })
      .eq("id", withdrawal.id);

    // Notify user
    await supabase.from("notifications").insert({
      user_id: user.id,
      type: "withdrawal_initiated",
      message: `Your withdrawal of ₦${net_amount.toLocaleString()} to ${bankAccount.bank_name} is being processed.`,
      link: "/app/wallet",
    });

    return new Response(JSON.stringify({
      success: true,
      reference,
      transfer_code: transferData.data.transfer_code,
      net_amount,
      fee,
      message: "Withdrawal initiated. Funds will arrive within minutes.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});