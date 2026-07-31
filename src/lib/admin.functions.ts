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

    await db.from("audit_log").insert({
      admin_user_id: userId,
      action: "dispute.resolve",
      target_type: "dispute",
      target_id: dispute.id,
      details: {
        taskId: task.id,
        releaseToStudent: data.releaseToStudent,
        resolution: data.resolution,
      },
    });

    return { ok: true };
  });

export const adminForceCancelTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string; reason: string; resolveEscrowAs?: "refund_poster" | "release_student" }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { db } = await ensureAdmin(userId);

    if (!data.reason?.trim() || data.reason.trim().length < 8) {
      throw new Error("Provide a cancellation reason (at least 8 characters)");
    }

    const resolutionMode = data.resolveEscrowAs ?? "refund_poster";

    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, status, poster_id, matched_student_id")
      .eq("id", data.taskId)
      .maybeSingle();

    if (taskErr || !task) throw new Error("Task not found");

    const { data: tx } = await db
      .from("transactions")
      .select("id, status, amount, platform_fee, poster_id, student_id")
      .eq("task_id", task.id)
      .maybeSingle();

    if (tx?.status === "released" || tx?.status === "refunded") {
      await db
        .from("tasks")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", task.id);

      await db.from("audit_log").insert({
        admin_user_id: userId,
        action: "task.force_cancel",
        target_type: "task",
        target_id: task.id,
        details: {
          reason: data.reason.trim(),
          previousTaskStatus: task.status,
          transactionStatus: tx.status,
          note: "Transaction was already terminal",
        },
      });

      return { ok: true, alreadyTerminal: true };
    }

    if (tx && (tx.status === "in_escrow" || tx.status === "disputed")) {
      if (resolutionMode === "release_student") {
        const payout = Number(tx.amount) - Number(tx.platform_fee ?? 0);
        if (!Number.isFinite(payout) || payout <= 0) throw new Error("Invalid payout calculation");

        const creditRes = await db.rpc("credit_wallet", {
          p_user_id: tx.student_id,
          p_amount: payout,
          p_description: `Admin force-cancel payout for task ${task.id}`,
          p_reference: `ADMIN_FORCE_CANCEL_RELEASE_${task.id}`,
        });

        if (creditRes.error) throw new Error(creditRes.error.message ?? "Could not credit student wallet");

        const creditPayload = normalizeCreditWalletResult(creditRes.data);
        if (creditPayload?.success === false || creditPayload?.error) {
          throw new Error(creditPayload.error ?? "Could not credit student wallet");
        }

        await db.from("transactions").update({ status: "released" }).eq("id", tx.id);
      } else {
        await db.from("transactions").update({ status: "refunded" }).eq("id", tx.id);
      }
    } else if (tx && tx.status === "pending") {
      await db.from("transactions").update({ status: "refunded" }).eq("id", tx.id);
    }

    await db
      .from("tasks")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", task.id);

    await db.from("notifications").insert([
      {
        user_id: task.poster_id,
        type: "task_cancelled",
        message:
          resolutionMode === "release_student"
            ? "An admin cancelled this task and released escrow to the student based on case review."
            : "An admin cancelled this task and refunded escrow to your account based on case review.",
        link: `/app/tasks/${task.id}`,
      },
      {
        user_id: task.matched_student_id,
        type: "task_cancelled",
        message:
          resolutionMode === "release_student"
            ? "An admin cancelled this task and released escrow payout to your wallet based on case review."
            : "An admin cancelled this task and refunded escrow to the poster based on case review.",
        link: `/app/tasks/${task.id}`,
      },
    ]);

    await db.from("audit_log").insert({
      admin_user_id: userId,
      action: "task.force_cancel",
      target_type: "task",
      target_id: task.id,
      details: {
        reason: data.reason.trim(),
        previousTaskStatus: task.status,
        transactionStatus: tx?.status ?? null,
        resolveEscrowAs: resolutionMode,
      },
    });

    return { ok: true };
  });

export const adminManualRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string; amount: number; reason: string; method: "wallet" | "paystack"; paystackReference?: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId: adminId } = context;
    const { db } = await ensureAdmin(adminId);

    if (!data.userId) throw new Error("User is required");
    if (!Number.isFinite(Number(data.amount)) || Number(data.amount) <= 0) {
      throw new Error("Amount must be greater than 0");
    }
    if (!data.reason?.trim() || data.reason.trim().length < 8) {
      throw new Error("Reason must be at least 8 characters");
    }

    const amount = Number(data.amount);
    const refundRef = `ADMIN_REFUND_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (data.method === "wallet") {
      const creditRes = await db.rpc("credit_wallet", {
        p_user_id: data.userId,
        p_amount: amount,
        p_description: `Admin manual refund: ${data.reason.trim()}`,
        p_reference: refundRef,
      });

      if (creditRes.error) {
        throw new Error(creditRes.error.message ?? "Could not credit user wallet");
      }

      const payload = normalizeCreditWalletResult(creditRes.data);
      if (payload?.success === false || payload?.error) {
        throw new Error(payload.error ?? "Could not credit user wallet");
      }

      await db.from("notifications").insert({
        user_id: data.userId,
        type: "refund_processed",
        message: `A manual refund of ₦${amount.toLocaleString("en-NG")} was applied to your wallet.`,
        link: "/app/wallet",
      });

      await db.from("audit_log").insert({
        admin_user_id: adminId,
        action: "finance.manual_refund",
        target_type: "user",
        target_id: data.userId,
        details: {
          method: "wallet",
          amount,
          reason: data.reason.trim(),
          reference: refundRef,
        },
      });

      return { ok: true, method: "wallet", reference: refundRef };
    }

    if (!data.paystackReference?.trim()) {
      throw new Error("Paystack reference is required for Paystack refunds");
    }

    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      throw new Error("Paystack is not configured on this server");
    }

    const paystackRes = await fetch("https://api.paystack.co/refund", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transaction: data.paystackReference.trim(),
        amount: Math.round(amount * 100),
        currency: "NGN",
      }),
    });

    const paystackJson = (await paystackRes.json()) as any;
    if (!paystackRes.ok || !paystackJson?.status) {
      throw new Error(paystackJson?.message ?? "Paystack refund failed");
    }

    await db.from("notifications").insert({
      user_id: data.userId,
      type: "refund_processed",
      message: `A refund of ₦${amount.toLocaleString("en-NG")} was initiated to your payment source.`,
      link: "/app/wallet",
    });

    await db.from("audit_log").insert({
      admin_user_id: adminId,
      action: "finance.manual_refund",
      target_type: "user",
      target_id: data.userId,
      details: {
        method: "paystack",
        amount,
        reason: data.reason.trim(),
        paystackReference: data.paystackReference.trim(),
        paystackRefundId: paystackJson?.data?.id ?? null,
      },
    });

    return {
      ok: true,
      method: "paystack",
      refundId: paystackJson?.data?.id ?? null,
      status: paystackJson?.data?.status ?? null,
    };
  });
