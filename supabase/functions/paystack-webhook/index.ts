import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";

serve(async (req) => {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY")!;

    // Verify webhook signature
    const hash = createHmac("sha512", secret).update(body).toString("hex");
    if (hash !== signature) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const eventType = event.event;
    const data = event.data;

    // Handle transfer events (withdrawals)
    if (eventType === "transfer.success") {
      const reference = data.reference;
      const { data: withdrawal } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (!withdrawal || withdrawal.webhook_processed) return new Response("OK", { status: 200 });

      await supabase
        .from("withdrawal_requests")
        .update({ status: "completed", processed_at: new Date().toISOString(), webhook_processed: true })
        .eq("reference", reference);

      await supabase
        .from("wallet_transactions")
        .update({ status: "completed" })
        .eq("reference", reference)
        .eq("user_id", withdrawal.user_id);

      await supabase.from("notifications").insert({
        user_id: withdrawal.user_id,
        type: "withdrawal_completed",
        message: `Your withdrawal of ₦${Number(withdrawal.net_amount).toLocaleString()} has been sent to ${withdrawal.bank_name}.`,
        link: "/app/wallet",
      });
    }

    if (eventType === "transfer.failed" || eventType === "transfer.reversed") {
      const reference = data.reference;
      const { data: withdrawal } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (!withdrawal || withdrawal.webhook_processed) return new Response("OK", { status: 200 });

      const newStatus = eventType === "transfer.failed" ? "failed" : "reversed";

      await supabase
        .from("withdrawal_requests")
        .update({ status: newStatus, processed_at: new Date().toISOString(), webhook_processed: true, failure_reason: data.reason ?? eventType })
        .eq("reference", reference);

      // Reverse the wallet debit — return funds to user
      await supabase.rpc("reverse_wallet_debit", {
        p_user_id: withdrawal.user_id,
        p_amount: withdrawal.amount,
        p_description: `Withdrawal ${newStatus} - funds returned`,
        p_reference: reference,
      });

      await supabase.from("notifications").insert({
        user_id: withdrawal.user_id,
        type: "withdrawal_failed",
        message: `Your withdrawal of ₦${Number(withdrawal.net_amount).toLocaleString()} could not be processed. Funds have been returned to your wallet.`,
        link: "/app/wallet",
      });
    }

    // Handle charge success (wallet funding)
    if (eventType === "charge.success") {
      const reference = data.reference;
      if (!reference.startsWith("FUND_")) return new Response("OK", { status: 200 });

      const { data: funding } = await supabase
        .from("wallet_funding")
        .select("*")
        .eq("paystack_reference", reference)
        .maybeSingle();

      if (!funding || funding.webhook_processed || funding.status === "completed") {
        return new Response("OK", { status: 200 });
      }

      const amount = data.amount / 100; // Convert from kobo

      await supabase.rpc("credit_wallet", {
        p_user_id: funding.user_id,
        p_amount: amount,
        p_description: "Wallet top-up via Paystack",
        p_reference: reference,
      });

      await supabase
        .from("wallet_funding")
        .update({ status: "completed", webhook_processed: true, updated_at: new Date().toISOString() })
        .eq("paystack_reference", reference);

      await supabase.from("notifications").insert({
        user_id: funding.user_id,
        type: "wallet_funded",
        message: `₦${amount.toLocaleString()} has been added to your InTask wallet.`,
        link: "/app/wallet",
      });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
});