import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      return new Response(
        JSON.stringify({ success: false, error: "Bank list is not configured (missing PAYSTACK_SECRET_KEY)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const res = await fetch("https://api.paystack.co/bank?country=nigeria", {
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const data = await res.json();
    if (!res.ok || !data?.status) {
      return new Response(
        JSON.stringify({ success: false, error: data?.message ?? "Could not load banks" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const banks = (Array.isArray(data.data) ? data.data : [])
      .filter((bank: any) => bank?.active !== false && bank?.code && bank?.name)
      .map((bank: any) => ({
        code: String(bank.code),
        name: String(bank.name),
      }))
      .sort((left: any, right: any) => left.name.localeCompare(right.name));

    return new Response(JSON.stringify({ success: true, banks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
