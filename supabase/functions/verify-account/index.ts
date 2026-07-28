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
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Verification is not configured (missing PAYSTACK_SECRET_KEY)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { account_number, bank_code } = await req.json();

    if (!account_number || !bank_code) {
      return new Response(JSON.stringify({ success: false, error: "Account number and bank code are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const query = new URLSearchParams({ account_number: String(account_number).trim(), bank_code: String(bank_code).trim() });
    const res = await fetch(`https://api.paystack.co/bank/resolve?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const data = await res.json();

    if (data.status && data.data?.account_name) {
      return new Response(
        JSON.stringify({ success: true, status: true, account_name: data.data.account_name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, status: false, error: data.message ?? "Could not verify account" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});