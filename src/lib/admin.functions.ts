// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: isAdmin, error: adminErr } = await db.rpc("is_admin_user", { _uid: userId });

  if (adminErr) {
    const { data: profile, error } = await db
      .from("profiles")
      .select("id, is_admin")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile?.is_admin) {
      throw new Error("Admin access required");
    }
  } else if (!isAdmin) {
    throw new Error("Admin access required");
  }

  return { db };
}

export const assertAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await ensureAdmin(userId);
    return { ok: true };
  });

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { id: string; status: "completed" | "rejected"; notes?: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { db } = await ensureAdmin(userId);

    const { data: withdrawal, error: wdErr } = await db
      .from("withdrawal_requests")
      .select("id, user_id, amount, net_amount, bank_name, reference, status")
      .eq("id", data.id)
      .maybeSingle();

    if (wdErr || !withdrawal) throw new Error("Withdrawal request not found");
    if (withdrawal.status !== "pending") {
      if (withdrawal.status === data.status) {
        return { ok: true, alreadyProcessed: true };
      }
      throw new Error(`Withdrawal has already been processed with status: ${withdrawal.status}`);
    }

    if (data.status === "rejected" && !data.notes?.trim()) {
      throw new Error("A rejection note is required");
    }

    if (data.status === "completed") {
      if (!withdrawal.reference) throw new Error("Withdrawal reference is missing");

      await db
        .from("withdrawal_requests")
        .update({
          status: "completed",
          notes: data.notes ?? null,
          processed_at: new Date().toISOString(),
          webhook_processed: true,
        })
        .eq("id", withdrawal.id)
        .eq("status", "pending");

      await db
        .from("wallet_transactions")
        .update({ status: "completed" })
        .eq("reference", withdrawal.reference)
        .eq("user_id", withdrawal.user_id);

      await db.from("notifications").insert({
        user_id: withdrawal.user_id,
        type: "withdrawal_completed",
        message: `Your withdrawal of ₦${Number(withdrawal.net_amount ?? withdrawal.amount).toLocaleString("en-NG")} has been processed successfully.`,
        link: "/app/wallet",
      });

      return { ok: true };
    }

    const reverseRes = await db.rpc("reverse_wallet_debit", {
      p_user_id: withdrawal.user_id,
      p_amount: withdrawal.amount,
      p_description: "Withdrawal rejected by admin - funds returned",
      p_reference: withdrawal.reference,
    });

    if (reverseRes.error || !reverseRes.data?.success) {
      throw new Error(reverseRes.error?.message ?? reverseRes.data?.error ?? "Could not reverse withdrawal debit");
    }

    await db
      .from("withdrawal_requests")
      .update({
        status: "rejected",
        notes: data.notes ?? null,
        processed_at: new Date().toISOString(),
        webhook_processed: true,
        failure_reason: "Rejected by admin",
      })
      .eq("id", withdrawal.id)
      .eq("status", "pending");

    await db.from("notifications").insert({
      user_id: withdrawal.user_id,
      type: "withdrawal_rejected",
      message: `Your withdrawal of ₦${Number(withdrawal.amount).toLocaleString("en-NG")} was rejected. Funds have been returned to your wallet.`,
      link: "/app/wallet",
    });

    return { ok: true };
  });

export const adminResolveDispute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { disputeId: string; resolution: string; releaseToStudent: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { db } = await ensureAdmin(userId);

    const { data: dispute, error: dErr } = await db
      .from("disputes")
      .select("id, task_id, raised_by, status")
      .eq("id", data.disputeId)
      .maybeSingle();

    if (dErr || !dispute) throw new Error("Dispute not found");
    if (!data.resolution?.trim() || data.resolution.trim().length < 8) {
      throw new Error("Resolution note must be at least 8 characters");
    }

    if (dispute.status === "resolved") return { ok: true };
    if (dispute.status !== "open") {
      throw new Error(`Dispute cannot be resolved from status: ${dispute.status}`);
    }

    const { data: task, error: tErr } = await db
      .from("tasks")
      .select("id, poster_id, matched_student_id")
      .eq("id", dispute.task_id)
      .maybeSingle();
    if (tErr || !task) throw new Error("Task not found for dispute");

    const { data: tx, error: txErr } = await db
      .from("transactions")
      .select("id, amount, platform_fee, status, poster_id, student_id")
      .eq("task_id", task.id)
      .maybeSingle();
    if (txErr || !tx) throw new Error("Transaction not found for disputed task");

    if (tx.status === "released" || tx.status === "refunded") {
      await db
        .from("disputes")
        .update({ status: "resolved", resolution: data.resolution.trim(), updated_at: new Date().toISOString() })
        .eq("id", dispute.id);
      return { ok: true, alreadyProcessed: true };
    }

    if (tx.status !== "in_escrow") {
      throw new Error(`Escrow is not available for dispute resolution (status: ${tx.status})`);
    }

    if (data.releaseToStudent) {
      if (!tx.student_id) throw new Error("No matched student found for payout");
      const payout = Number(tx.amount) - Number(tx.platform_fee);
      if (!Number.isFinite(payout) || payout <= 0) {
        throw new Error("Calculated payout is invalid");
      }

      const creditRes = await db.rpc("credit_wallet", {
        p_user_id: tx.student_id,
        p_amount: payout,
        p_description: `Dispute resolved in your favor for task ${task.id}`,
        p_reference: `DISPUTE_RELEASE_${task.id}`,
      });

      if (creditRes.error || !creditRes.data?.success) {
        throw new Error(creditRes.error?.message ?? creditRes.data?.error ?? "Could not credit student wallet");
      }

      await db.from("transactions").update({ status: "released" }).eq("id", tx.id);
      await db
        .from("tasks")
        .update({ status: "completed", delivery_approved_at: new Date().toISOString() })
        .eq("id", task.id);

      await db.from("notifications").insert([
        {
          user_id: tx.student_id,
          type: "dispute_resolved",
          message: "Dispute resolved in your favor. Payment has been released to your wallet.",
          link: `/app/tasks/${task.id}`,
        },
        {
          user_id: tx.poster_id,
          type: "dispute_resolved",
          message: "Dispute resolved. Escrow has been released to the student.",
          link: `/app/tasks/${task.id}`,
        },
      ]);
    } else {
      await db.from("transactions").update({ status: "refunded" }).eq("id", tx.id);
      await db.from("tasks").update({ status: "cancelled" }).eq("id", task.id);

      await db.from("notifications").insert([
        {
          user_id: tx.poster_id,
          type: "dispute_resolved",
          message: "Dispute resolved in your favor. Escrow has been marked for refund.",
          link: `/app/tasks/${task.id}`,
        },
        {
          user_id: tx.student_id,
          type: "dispute_resolved",
          message: "Dispute resolved. The task has been cancelled and escrow refunded to the poster.",
          link: `/app/tasks/${task.id}`,
        },
      ]);
    }

    await db
      .from("disputes")
      .update({ status: "resolved", resolution: data.resolution, updated_at: new Date().toISOString() })
      .eq("id", dispute.id);

    return { ok: true };
  });
