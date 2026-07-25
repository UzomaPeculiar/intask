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

    const { amount } = await req.json();
    if (!amount || amount < 100) {
      return new Response(JSON.stringify({ error: "Minimum funding amount is ₦100" }), { status: 400, headers: corsHeaders });
    }

    const reference = `FUND_${user.id.replace(/-/g, "").slice(0, 8)}_${Date.now()}`;

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single() as any;

    // Initialize Paystack transaction
    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile?.email ?? user.email,
        amount: amount * 100,
        reference,
        currency: "NGN",
        metadata: { user_id: user.id, type: "wallet_funding" },
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      return new Response(JSON.stringify({ error: paystackData.message }), { status: 400, headers: corsHeaders });
    }

    // Get or create wallet
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle() as any;

    let walletId = wallet?.id;
    if (!walletId) {
      const { data: newWallet } = await supabase
        .from("wallets")
        .insert({ user_id: user.id, balance: 0, total_earned: 0, total_withdrawn: 0 })
        .select("id")
        .single() as any;
      walletId = newWallet?.id;
    }

    // Record funding attempt
    await supabase.from("wallet_funding").insert({
      user_id: user.id,
      wallet_id: walletId,
      amount,
      paystack_reference: reference,
      status: "pending",
    });

    return new Response(JSON.stringify({
      success: true,
      authorization_url: paystackData.data.authorization_url,
      reference,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});