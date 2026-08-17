import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { timingSafeEqual } from "https://deno.land/std@0.168.0/crypto/timing_safe_equal.ts";

function verifyPaystackSignature(body: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha512", secret).update(body).toString("hex");
  const encoder = new TextEncoder();
  const sigBytes = encoder.encode(signature);
  const expectedBytes = encoder.encode(expected);
  if (sigBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(sigBytes, expectedBytes);
}

serve(async (req) => {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-paystack-signature") ?? "";
    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret) {
      return new Response("Server not configured", { status: 500 });
    }

    if (!verifyPaystackSignature(body, signature, secret)) {
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(body);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const eventType = event.event;
    const data = event.data;

    console.log("[paystack-webhook] event received:", eventType, "reference:", data?.reference, "transfer_code:", data?.transfer_code);

    // Handle transfer events (withdrawals)
    if (eventType === "transfer.success") {
      const reference = data.reference;
      const { data: withdrawal, error: lookupErr } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (lookupErr) console.error("[paystack-webhook] transfer.success lookup error:", lookupErr);

      if (!withdrawal || withdrawal.webhook_processed) {
        console.log("[paystack-webhook] transfer.success skipped - no pending withdrawal for", reference);
        return new Response("OK", { status: 200 });
      }

      const { data: claimedWithdrawal, error: updateErr } = await supabase
        .from("withdrawal_requests")
        .update({ status: "completed", processed_at: new Date().toISOString(), webhook_processed: true })
        .eq("reference", reference)
        .eq("webhook_processed", false)
        .select("id")
        .maybeSingle();

      if (updateErr) console.error("[paystack-webhook] transfer.success update error:", updateErr);

      if (!claimedWithdrawal) {
        console.log("[paystack-webhook] transfer.success not claimed for", reference);
        return new Response("OK", { status: 200 });
      }

      console.log("[paystack-webhook] withdrawal completed:", reference, "id:", claimedWithdrawal.id);

      // Route through the SECURITY DEFINER function: direct UPDATEs on
      // wallet_transactions can fail on environments with drifted grants.
      await supabase.rpc("mark_wallet_transaction_status", {
        p_user_id: withdrawal.user_id,
        p_reference: reference,
        p_status: "completed",
      });

      await supabase.from("notifications").insert({
        user_id: withdrawal.user_id,
        type: "withdrawal_completed",
        message: `Your withdrawal of ₦${Number(withdrawal.net_amount).toLocaleString()} has been sent to ${withdrawal.bank_name}.`,
        link: "/app/wallet",
      });
    }

    if (eventType === "transfer.failed" || eventType === "transfer.reversed") {
      const reference = data.reference;
      const { data: withdrawal, error: lookupErr } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();

      if (lookupErr) console.error("[paystack-webhook] transfer failure lookup error:", lookupErr);

      if (!withdrawal || withdrawal.webhook_processed) {
        console.log("[paystack-webhook]", eventType, "skipped for", reference);
        return new Response("OK", { status: 200 });
      }

      const newStatus = eventType === "transfer.failed" ? "failed" : "reversed";

      const { data: claimedWithdrawal } = await supabase
        .from("withdrawal_requests")
        .update({ status: newStatus, processed_at: new Date().toISOString(), webhook_processed: true, failure_reason: data.reason ?? eventType })
        .eq("reference", reference)
        .eq("webhook_processed", false)
        .select("id")
        .maybeSingle();

      if (!claimedWithdrawal) return new Response("OK", { status: 200 });

      // Reverse the wallet debit — return funds to user
      await supabase.rpc("reverse_wallet_debit", {
        p_user_id: withdrawal.user_id,
        p_amount: withdrawal.amount,
        p_description: `Withdrawal ${newStatus} - funds returned`,
        p_reference: reference,
      });

      await supabase.rpc("mark_wallet_transaction_status", {
        p_user_id: withdrawal.user_id,
        p_reference: reference,
        p_status: newStatus,
      });

      await supabase.from("notifications").insert({
        user_id: withdrawal.user_id,
        type: "withdrawal_failed",
        message: `Your withdrawal of ₦${Number(withdrawal.net_amount).toLocaleString()} could not be processed. Funds have been returned to your wallet.`,
        link: "/app/wallet",
      });
    }

    // Handle charge success (wallet funding OR task escrow)
    if (eventType === "charge.success") {
      const reference = data.reference;

      // Wallet funding
      if (reference.startsWith("FUND_")) {
        const { data: funding } = await supabase
          .from("wallet_funding")
          .select("*")
          .eq("paystack_reference", reference)
          .maybeSingle();

        if (!funding || funding.webhook_processed || funding.status === "completed") {
          console.log("[paystack-webhook] funding skipped - already processed:", reference);
          return new Response("OK", { status: 200 });
        }

        const amount = data.amount / 100; // Convert from kobo

        await supabase.rpc("credit_wallet", {
          p_user_id: funding.user_id,
          p_amount: amount,
          p_description: "Wallet top-up via Paystack",
          p_reference: reference,
        });

        const { error: fundingUpdateErr } = await supabase
          .from("wallet_funding")
          .update({ status: "completed", webhook_processed: true, updated_at: new Date().toISOString() })
          .eq("paystack_reference", reference);

        if (fundingUpdateErr) {
          console.error("[paystack-webhook] failed to mark wallet funding complete:", fundingUpdateErr);
        }

        await supabase.from("notifications").insert({
          user_id: funding.user_id,
          type: "wallet_funded",
          message: `₦${amount.toLocaleString()} has been added to your InTask wallet.`,
          link: "/app/wallet",
        });

        return new Response("OK", { status: 200 });
      }

      // Task escrow payment
      const metadata = data.metadata ?? {};
      const taskId = metadata.task_id;

      const { data: tx } = await supabase
        .from("transactions")
        .select("id, task_id, poster_id, student_id, status")
        .eq("paystack_reference", reference)
        .maybeSingle();
      console.log("[paystack-webhook] escrow charge.success:", reference, "tx:", tx?.id ?? "not found");
      if (!tx) return new Response("tx not found", { status: 404 });
      if (tx.status === "in_escrow" || tx.status === "released") {
        return new Response("already processed");
      }

      const walletContribution = Number(metadata.escrow_wallet_amount ?? 0);
      if (walletContribution > 0) {
        const debitRef = `ESCROW_WALLET_DEBIT_${tx.task_id}`;
        const debitRes = await supabase.rpc("debit_wallet_atomic", {
          p_user_id: tx.poster_id,
          p_amount: walletContribution,
          p_description: `Wallet contribution for escrow on task ${tx.task_id}`,
          p_reference: debitRef,
        });

        const debitFailed = !!debitRes.error || (debitRes.data && debitRes.data.success === false);
        if (debitFailed) {
          return new Response(debitRes.error?.message ?? debitRes.data?.error ?? "wallet debit failed", { status: 409 });
        }
      }

      const { data: claimedTx } = await supabase
        .from("transactions")
        .update({ status: "in_escrow" })
        .eq("id", tx.id)
        .eq("status", tx.status)
        .select("id")
        .maybeSingle();

      if (!claimedTx) {
        return new Response("already processed");
      }

      await supabase
        .from("tasks")
        .update({ status: "in_progress" })
        .eq("id", tx.task_id);

      // Create conversation if not exists
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("task_id", tx.task_id)
        .eq("student_id", tx.student_id)
        .maybeSingle();
      if (!existingConv) {
        await supabase.from("conversations").insert({
          task_id: tx.task_id,
          student_id: tx.student_id,
          poster_id: tx.poster_id,
        });
      }

      await supabase.from("notifications").insert([
        {
          user_id: tx.student_id,
          type: "task_funded",
          message: "Escrow funded. You can start the work.",
          link: `/app/tasks/${tx.task_id ?? taskId}`,
        },
        {
          user_id: tx.poster_id,
          type: "task_funded",
          message: "Payment received and held in escrow.",
          link: `/app/tasks/${tx.task_id ?? taskId}`,
        },
      ]);

      return new Response("OK", { status: 200 });
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response("Error", { status: 500 });
  }
});