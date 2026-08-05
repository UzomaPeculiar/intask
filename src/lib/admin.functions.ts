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

export const getAdminCommandCenterStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { db } = await ensureAdmin(userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const matchedCutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const reviewCutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const [profilesRes, tasksRes, transactionsRes, disputesRes, reportsRes, withdrawalsRes, studentRes, companyRes, individualRes, fundingRes] = await Promise.all([
      db.from("profiles").select("id, role, created_at"),
      db.from("tasks").select("id, title, status, created_at, updated_at"),
      db.from("transactions").select("id, task_id, status, amount, platform_fee, created_at, updated_at"),
      db.from("disputes").select("id, status"),
      db.from("reports").select("id, status"),
      db.from("withdrawal_requests").select("id, status, created_at, webhook_processed"),
      db.from("student_profiles").select("user_id, verified, verification_status, verification_method"),
      db.from("company_profiles").select("user_id, verified, verification_status"),
      db.from("individual_profiles").select("user_id, verification_status"),
      db.from("wallet_funding").select("id, status, created_at, webhook_processed"),
    ]);

    if (profilesRes.error) throw profilesRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (transactionsRes.error) throw transactionsRes.error;
    if (disputesRes.error) throw disputesRes.error;
    if (reportsRes.error) throw reportsRes.error;
    if (withdrawalsRes.error) throw withdrawalsRes.error;
    if (studentRes.error) throw studentRes.error;
    if (companyRes.error) throw companyRes.error;
    if (individualRes.error) throw individualRes.error;
    if (fundingRes.error) throw fundingRes.error;

    const profiles = profilesRes.data ?? [];
    const tasks = tasksRes.data ?? [];
    const transactions = transactionsRes.data ?? [];
    const disputes = disputesRes.data ?? [];
    const reports = reportsRes.data ?? [];
    const withdrawals = withdrawalsRes.data ?? [];
    const students = studentRes.data ?? [];
    const companies = companyRes.data ?? [];
    const individuals = individualRes.data ?? [];
    const funding = fundingRes.data ?? [];

    const roleCounts = {
      student: profiles.filter((p) => p.role === "student").length,
      alumni: profiles.filter((p) => p.role === "alumni").length,
      individual: profiles.filter((p) => p.role === "individual").length,
      company: profiles.filter((p) => p.role === "company").length,
    };

    const taskStatusCounts = {
      open: tasks.filter((t) => t.status === "open").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      disputed: tasks.filter((t) => t.status === "disputed").length,
      cancelled: tasks.filter((t) => t.status === "cancelled").length,
      matched: tasks.filter((t) => t.status === "matched").length,
      inReview: tasks.filter((t) => t.status === "in_review").length,
    };

    const escrowVolume = transactions
      .filter((tx) => tx.status === "in_escrow" || tx.status === "disputed")
      .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);

    const platformFeesEarned = transactions
      .filter((tx) => tx.status === "released")
      .reduce((sum, tx) => sum + Number(tx.platform_fee ?? 0), 0);

    const signupsToday = profiles.filter((p) => p.created_at && new Date(p.created_at) >= today).length;
    const tasksPostedToday = tasks.filter((t) => t.created_at && new Date(t.created_at) >= today).length;
    const tasksCompletedToday = tasks.filter((t) => t.status === "completed" && t.updated_at && new Date(t.updated_at) >= today).length;
    const paymentsProcessedToday = transactions.filter((tx) => tx.updated_at && new Date(tx.updated_at) >= today && ["in_escrow", "released", "refunded", "disputed"].includes(tx.status)).length;

    const pendingStudent = students.filter((s) => !s.verified && (s.verification_method === "id_upload" || s.verification_status === "pending" || s.verification_status === "pending_review")).length;
    const pendingCompany = companies.filter((c) => !c.verified && c.verification_status !== "rejected").length;
    const pendingIndividual = individuals.filter((i) => i.verification_status === "pending_review").length;

    const openDisputes = disputes.filter((d) => d.status === "open").length;
    const pendingWithdrawals = withdrawals.filter((w) => w.status === "pending").length;
    const unresolvedReports = reports.filter((r) => r.status === "pending").length;

    const failedWithdrawalPayments = withdrawals.filter((w) => ["failed", "reversed", "rejected"].includes(w.status)).length;
    const failedWalletTopups = funding.filter((f) => f.status === "failed").length;
    const webhookBacklog = withdrawals.filter((w) => w.status === "pending" && !w.webhook_processed).length + funding.filter((f) => f.status === "pending" && !f.webhook_processed).length;

    const paidTaskIds = new Set(
      transactions
        .filter((tx) => ["in_escrow", "released", "disputed"].includes(tx.status))
        .map((tx) => tx.task_id),
    );

    const matchedStuck = tasks
      .filter((t) => t.status === "matched" && t.created_at && new Date(t.created_at).toISOString() <= matchedCutoff && !paidTaskIds.has(t.id))
      .slice(0, 8)
      .map((t) => ({ id: t.id, title: t.title, since: t.created_at }));

    const inReviewStuck = tasks
      .filter((t) => t.status === "in_review" && t.updated_at && new Date(t.updated_at).toISOString() <= reviewCutoff)
      .slice(0, 8)
      .map((t) => ({ id: t.id, title: t.title, since: t.updated_at }));

    const releasedFees = transactions
      .filter((tx) => tx.status === "released" && tx.created_at)
      .map((tx) => ({ created_at: tx.created_at, fee: Number(tx.platform_fee ?? 0) }));

    const weekKey = (dateStr) => {
      const date = new Date(dateStr);
      const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
      const day = d.getUTCDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diffToMonday);
      return d.toISOString().slice(0, 10);
    };

    const monthKey = (dateStr) => {
      const d = new Date(dateStr);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    };

    const formatWeekLabel = (key) => {
      const d = new Date(`${key}T00:00:00Z`);
      return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
    };

    const formatMonthLabel = (key) => {
      const [year, month] = key.split("-");
      const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
      return d.toLocaleDateString("en-NG", { month: "short", year: "2-digit" });
    };

    const weeklyMap = {};
    const monthlyMap = {};

    for (const row of releasedFees) {
      const wk = weekKey(row.created_at);
      const mk = monthKey(row.created_at);
      weeklyMap[wk] = (weeklyMap[wk] ?? 0) + row.fee;
      monthlyMap[mk] = (monthlyMap[mk] ?? 0) + row.fee;
    }

    const weeklyTrend = Object.keys(weeklyMap)
      .sort()
      .slice(-8)
      .map((key) => ({ key, label: formatWeekLabel(key), amount: Math.round(weeklyMap[key]) }));

    const monthlyTrend = Object.keys(monthlyMap)
      .sort()
      .slice(-6)
      .map((key) => ({ key, label: formatMonthLabel(key), amount: Math.round(monthlyMap[key]) }));

    return {
      liveStats: {
        totalUsers: profiles.length,
        roleCounts,
        totalTasks: tasks.length,
        taskStatusCounts,
        escrowVolume,
        platformFeesEarned,
      },
      today: {
        signupsToday,
        tasksPostedToday,
        tasksCompletedToday,
        paymentsProcessedToday,
      },
      queue: {
        pendingVerifications: pendingStudent + pendingCompany + pendingIndividual,
        openDisputes,
        pendingWithdrawals,
        unresolvedReports,
      },
      health: {
        failedPayments: failedWithdrawalPayments + failedWalletTopups,
        webhookBacklog,
        matchedStuck,
        inReviewStuck,
      },
      revenueTrend: {
        weekly: weeklyTrend,
        monthly: monthlyTrend,
      },
    };
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

      const { data: releaseClaimed } = await db
        .from("transactions")
        .update({ status: "released" })
        .eq("id", tx.id)
        .eq("status", "in_escrow")
        .select("id")
        .maybeSingle();

      if (!releaseClaimed) {
        throw new Error("Escrow was already released or refunded");
      }

      try {
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
      } catch (error) {
        await db
          .from("transactions")
          .update({ status: "in_escrow" })
          .eq("id", tx.id)
          .eq("status", "released");
        throw error;
      }
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

        const { data: releaseClaimed } = await db
          .from("transactions")
          .update({ status: "released" })
          .eq("id", tx.id)
          .eq("status", tx.status)
          .select("id")
          .maybeSingle();

        if (!releaseClaimed) {
          throw new Error("Escrow was already released or refunded");
        }

        try {
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
        } catch (error) {
          await db
            .from("transactions")
            .update({ status: tx.status })
            .eq("id", tx.id)
            .eq("status", "released");
          throw error;
        }
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
