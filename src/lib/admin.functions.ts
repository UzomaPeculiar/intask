// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function normalizeCreditWalletResult(data: any) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function computePayoutSplits(
  totalAmount: number,
  members: Array<{ student_id: string; payment_share?: number | null }>,
) {
  const validMembers = members.filter((m) => !!m.student_id);
  if (validMembers.length === 0) return [] as Array<{ studentId: string; amount: number }>;

  const explicitWeights = validMembers.map((m) => Number(m.payment_share ?? 0));
  const hasExplicitWeights = explicitWeights.some((w) => Number.isFinite(w) && w > 0);
  const weights = hasExplicitWeights
    ? explicitWeights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0))
    : validMembers.map(() => 1);

  const sumWeights = weights.reduce((acc, w) => acc + w, 0);
  if (!Number.isFinite(sumWeights) || sumWeights <= 0) {
    throw new Error("Invalid team payment weights");
  }

  const totalCents = Math.round(totalAmount * 100);
  const split = validMembers.map((m, i) => {
    const raw = (totalCents * weights[i]) / sumWeights;
    return {
      studentId: m.student_id,
      cents: Math.floor(raw),
      remainderWeight: raw - Math.floor(raw),
    };
  });

  let distributed = split.reduce((acc, s) => acc + s.cents, 0);
  let remainder = totalCents - distributed;
  if (remainder > 0) {
    split
      .sort((a, b) => b.remainderWeight - a.remainderWeight)
      .forEach((s) => {
        if (remainder > 0) {
          s.cents += 1;
          remainder -= 1;
        }
      });
  }

  return split
    .map((s) => ({ studentId: s.studentId, amount: s.cents / 100 }))
    .filter((s) => s.amount > 0);
}

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
      .select("id, poster_id, matched_student_id, is_team_task")
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
      const payout = Number(tx.amount) - Number(tx.platform_fee);
      if (!Number.isFinite(payout) || payout <= 0) {
        throw new Error("Calculated payout is invalid");
      }

      let recipients: Array<{ studentId: string; amount: number }> = [];

      if (task.is_team_task) {
        const { data: teamMembers, error: tmErr } = await db
          .from("task_team_members")
          .select("student_id, payment_share, status")
          .eq("task_id", task.id)
          .eq("status", "active");

        if (tmErr) throw new Error(tmErr.message);

        const members = (teamMembers ?? []).filter((m: any) => !!m.student_id);
        if (members.length > 0) {
          recipients = computePayoutSplits(payout, members);
        }
      }

      if (recipients.length === 0) {
        if (!tx.student_id) throw new Error("No matched student found for payout");
        recipients = [{ studentId: tx.student_id, amount: payout }];
      }

      for (const recipient of recipients) {
        const creditRes = await db.rpc("credit_wallet", {
          p_user_id: recipient.studentId,
          p_amount: recipient.amount,
          p_description: `Dispute resolved in your favor for task ${task.id}`,
          p_reference: `DISPUTE_RELEASE_${task.id}_${recipient.studentId}`,
        });

        if (creditRes.error) {
          throw new Error(`Could not credit team member ${recipient.studentId}: ${creditRes.error.message ?? "unknown error"}`);
        }

        const creditPayload = normalizeCreditWalletResult(creditRes.data);
        if (creditPayload?.success === false || creditPayload?.error) {
          throw new Error(`Could not credit team member ${recipient.studentId}: ${creditPayload.error ?? "unknown error"}`);
        }
      }

      await db.from("transactions").update({ status: "released" }).eq("id", tx.id);
      await db
        .from("tasks")
        .update({ status: "completed", delivery_approved_at: new Date().toISOString() })
        .eq("id", task.id);

      await db.from("notifications").insert([
        ...recipients.map((recipient) => ({
          user_id: recipient.studentId,
          type: "dispute_resolved",
          message: `Dispute resolved in your favor. ₦${recipient.amount.toLocaleString("en-NG")} has been released to your wallet.`,
          link: `/app/tasks/${task.id}`,
        })),
        {
          user_id: tx.poster_id,
          type: "dispute_resolved",
          message: "Dispute resolved. Escrow has been released to the student team.",
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
