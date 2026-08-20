import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getNumericPlatformSetting, PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";

type EscrowTx = {
  id: string;
  task_id: string;
  poster_id: string;
  student_id: string;
  status: string;
};

async function ensureEscrowActivated(
  supabaseAdmin: any,
  tx: EscrowTx,
  walletContribution: number,
) {
  const walletPart = Number(walletContribution || 0);
  if (walletPart > 0) {
    const debitRef = `ESCROW_WALLET_DEBIT_${tx.task_id}`;
    const debitRes = await supabaseAdmin.rpc("debit_wallet_atomic", {
      p_user_id: tx.poster_id,
      p_amount: walletPart,
      p_description: `Wallet contribution for escrow on task ${tx.task_id}`,
      p_reference: debitRef,
    });

    const debitFailed = !!debitRes.error || (debitRes.data && debitRes.data.success === false);
    if (debitFailed) {
      throw new Error(debitRes.error?.message ?? debitRes.data?.error ?? "Could not debit wallet contribution");
    }
  }

  const { data: claimedTx } = await supabaseAdmin
    .from("transactions")
    .update({ status: "in_escrow" })
    .eq("id", tx.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!claimedTx) {
    const { data: latestTx } = await supabaseAdmin
      .from("transactions")
      .select("status")
      .eq("id", tx.id)
      .maybeSingle();

    if (!latestTx || (latestTx.status !== "in_escrow" && latestTx.status !== "released")) {
      throw new Error("Escrow could not be activated for this transaction");
    }
  }

  await supabaseAdmin
    .from("tasks")
    .update({ status: "in_progress" })
    .eq("id", tx.task_id);

  await supabaseAdmin
    .from("applications")
    .update({ status: "accepted" })
    .eq("task_id", tx.task_id)
    .eq("student_id", tx.student_id);

  const { data: existingConvRows } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("task_id", tx.task_id)
    .eq("student_id", tx.student_id)
    .limit(1);
  const existingConv = existingConvRows?.[0] ?? null;

  if (!existingConv) {
    await supabaseAdmin.from("conversations").insert({
      task_id: tx.task_id,
      student_id: tx.student_id,
      poster_id: tx.poster_id,
    });
  }
}

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

export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? process.env.VITE_PAYSTACK_PUBLIC_KEY ?? "" };
});

export const initEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string; mode?: "paystack_only" | "wallet_only" | "wallet_plus_paystack" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const settingsDb = supabaseAdmin as any;
    const mode = data.mode ?? "paystack_only";
    const platformFeePercent = await getNumericPlatformSetting(
      settingsDb,
      "platform_fee_percent",
      PLATFORM_SETTING_DEFAULTS.platform_fee_percent,
    );
    const feeRate = Math.min(Math.max(Number(platformFeePercent), 0), 100) / 100;

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, budget, poster_id, matched_student_id, status")
      .eq("id", data.taskId)
      .single();

    const { data: existingTxRows, error: existingTxError } = await supabase
      .from("transactions")
      .select("id, status, paystack_reference")
      .eq("task_id", task?.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const existingTransaction = existingTxRows?.[0] ?? null;

    if (tErr || !task) throw new Error("Task not found");
    if (task.poster_id !== userId) {
      throw new Error("Only the poster can pay for this task");
    }
    if (!task.matched_student_id) {
      throw new Error("Accept a student first");
    }
    if (task.status !== "matched") {
      throw new Error("Only matched tasks can be funded");
    }
    if (!task.budget || Number(task.budget) <= 0) {
      throw new Error("Task budget is not set");
    }

    const taskAmount = Number(task.budget);
    const { data: walletRows } = await supabase
      .from("wallets")
      .select("balance")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    const walletBalance = Number(walletRows?.[0]?.balance ?? 0);

    const walletContribution = mode === "paystack_only" ? 0 : Math.min(walletBalance, taskAmount);
    const paystackContribution = Math.max(0, taskAmount - walletContribution);

    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email;

    if (!email) {
      throw new Error("Add an email to your profile first");
    }

    if (existingTxError) {
      throw existingTxError;
    }

    // A transaction is already in escrow.
    if (existingTransaction?.status === "in_escrow") {
      throw new Error("Payment already confirmed for this task.");
    }

    // A transaction has already been released.
    if (existingTransaction?.status === "released") {
      throw new Error("Payment has already been completed for this task.");
    }

    // If there is a pending transaction with a Paystack reference,
    // verify it server-side before creating another payment.
    if (
      existingTransaction?.status === "pending" &&
      existingTransaction?.paystack_reference
    ) {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(
          existingTransaction.paystack_reference
        )}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      const verifyData = (await verifyRes.json()) as any;

      // The previous payment was actually successful.
      if (
        verifyRes.ok &&
        verifyData?.status &&
        verifyData?.data?.status === "success"
      ) {
        await supabase
          .from("transactions")
          .update({ status: "in_escrow" } as any)
          .eq("id", existingTransaction.id);

        await supabase
          .from("tasks")
          .update({ status: "in_progress" } as any)
          .eq("id", task.id);

        await supabase
          .from("applications")
          .update({ status: "accepted" } as any)
          .eq("task_id", task.id)
          .eq("student_id", task.matched_student_id);

        // Make sure a conversation exists for the task.
        const { data: existingConvRows } = await supabase
          .from("conversations")
          .select("id")
          .eq("task_id", task.id)
          .eq("student_id", task.matched_student_id)
          .limit(1);
        const existingConv = existingConvRows?.[0] ?? null;

        if (!existingConv) {
          await supabase.from("conversations").insert({
            task_id: task.id,
            student_id: task.matched_student_id,
            poster_id: task.poster_id,
          });
        }

        throw new Error(
          "Payment already confirmed. Your task is now in progress."
        );
      }
    }

    const reference = existingTransaction?.paystack_reference ?? `intask_${task.id}_escrow`;

    const transactionPayload = {
      task_id: task.id,
      poster_id: task.poster_id,
      student_id: task.matched_student_id,
      amount: task.budget,
      platform_fee: Number(task.budget) * feeRate,
      status: "pending",
      paystack_reference: reference,
    };

    const txQuery = existingTransaction?.id
      ? supabase
          .from("transactions")
          .update(transactionPayload as any)
          .eq("id", existingTransaction.id)
      : supabase.from("transactions").insert(transactionPayload as any);

    const { data: txRows, error: txErr } = await txQuery
      .select("id, paystack_reference")
      .limit(1);

    const tx = txRows?.[0]
      ? txRows[0]
      : existingTransaction?.id
        ? { id: existingTransaction.id, paystack_reference: reference }
        : null;

    if (txErr || !tx) {
      throw txErr ?? new Error("Could not create transaction");
    }
    
    if (mode === "wallet_only") {
      if (walletContribution < taskAmount) {
        throw new Error("Insufficient wallet balance for instant escrow funding");
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await ensureEscrowActivated(
        supabaseAdmin,
        {
          id: tx.id,
          task_id: task.id,
          poster_id: task.poster_id,
          student_id: task.matched_student_id,
          status: "pending",
        },
        walletContribution,
      );

      await supabaseAdmin.from("notifications").insert([
        {
          user_id: task.matched_student_id,
          type: "task_funded",
          message: "Escrow funded. You can start the work.",
          link: `/app/tasks/${task.id}`,
        },
        {
          user_id: task.poster_id,
          type: "task_funded",
          message: "Payment received and held in escrow.",
          link: `/app/tasks/${task.id}`,
        },
      ]);

      return {
        fundedInstantly: true,
        amount: taskAmount,
        walletContribution,
        paystackAmount: 0,
      };
    }

    const amountKobo = Math.round(paystackContribution * 100);
    const res = await fetch(
      "https://api.paystack.co/transaction/initialize", 
      {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        metadata: { 
          task_id: task.id, 
          transaction_id: tx.id,
          escrow_mode: mode,
          escrow_wallet_amount: walletContribution,
          escrow_paystack_amount: paystackContribution,
          poster_id: task.poster_id,
        },
      }),
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json?.status) throw new Error(json?.message ?? "Paystack init failed");

    return {
      fundedInstantly: false,
      reference,
      accessCode: json.data.access_code as string,
      authorizationUrl: json.data.authorization_url as string,
      amount: taskAmount,
      walletContribution,
      paystackAmount: paystackContribution,
    };
  });

export const verifyEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { reference: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json?.status || json.data?.status !== "success") {
      throw new Error("Payment could not be confirmed. Please contact support.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id, task_id, poster_id, student_id, status")
      .eq("paystack_reference", data.reference)
      .maybeSingle();
    if (!tx) throw new Error("Transaction not found");
    if (tx.poster_id !== userId) throw new Error("Not allowed");

    if (tx.status !== "in_escrow" && tx.status !== "released") {
      const metadata = json?.data?.metadata ?? {};
      const walletContribution = Number(metadata?.escrow_wallet_amount ?? 0);

      await ensureEscrowActivated(
        supabaseAdmin,
        {
          id: tx.id,
          task_id: tx.task_id,
          poster_id: tx.poster_id,
          student_id: tx.student_id,
          status: tx.status,
        },
        walletContribution,
      );

      await supabaseAdmin.from("notifications").insert([
        {
          user_id: tx.student_id,
          type: "task_funded",
          message: "Escrow funded. You can start the work.",
          link: `/app/tasks/${tx.task_id}`,
        },
        {
          user_id: tx.poster_id,
          type: "task_funded",
          message: "Payment received and held in escrow.",
          link: `/app/tasks/${tx.task_id}`,
        },
      ]);
    }

    return { ok: true, taskId: tx.task_id };
  });

export const releaseEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: task, error } = await supabase
      .from("tasks")
      .select("id, poster_id, matched_student_id, status, is_team_task")
      .eq("id", data.taskId)
      .single();
    if (error || !task) throw new Error("Task not found");
    if (task.poster_id !== userId) throw new Error("Only the poster can release payment");
    if (task.status !== "in_review") throw new Error("Mark a delivery as approved from the review screen");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .select("id, amount, platform_fee, status, student_id")
      .eq("task_id", task.id)
      .maybeSingle();
    if (!tx || tx.status !== "in_escrow") throw new Error("No escrow to release");

    const payout = Number(tx.amount) - Number(tx.platform_fee);
    if (!Number.isFinite(payout) || payout <= 0) {
      throw new Error("Calculated payout is invalid");
    }

    let recipients: Array<{ studentId: string; amount: number }> = [];

    if (task.is_team_task) {
      const { data: teamMembers, error: tmErr } = await supabaseAdmin
        .from("task_team_members")
        .select("student_id, payment_share, status, delivery_submitted_at")
        .eq("task_id", task.id)
        .eq("status", "active");

      if (tmErr) throw new Error(tmErr.message);

      const members = (teamMembers ?? []).filter((m: any) => !!m.student_id);
      if (members.some((member: any) => !member.delivery_submitted_at)) {
        throw new Error("All team members must submit their work before payment can be released");
      }
      if (members.length > 0) {
        recipients = computePayoutSplits(payout, members);
      }
    }

    if (recipients.length === 0) {
      if (!tx.student_id) throw new Error("No matched student found for payout");
      recipients = [{ studentId: tx.student_id, amount: payout }];
    }

    const { data: releaseClaimed } = await supabaseAdmin
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
        const creditRes = await supabaseAdmin.rpc("credit_wallet", {
          p_user_id: recipient.studentId,
          p_amount: recipient.amount,
          p_description: `Payment for task ${task.id}`,
          p_reference: `ESCROW_RELEASE_${task.id}_${recipient.studentId}`,
        });

        if (creditRes.error) {
          throw new Error(`Could not credit team member ${recipient.studentId}: ${creditRes.error.message ?? "unknown error"}`);
        }

        const creditPayload = normalizeCreditWalletResult(creditRes.data);
        if (creditPayload?.success === false || creditPayload?.error) {
          throw new Error(`Could not credit team member ${recipient.studentId}: ${creditPayload.error ?? "unknown error"}`);
        }
      }

      await supabaseAdmin
        .from("tasks")
        .update({ status: "completed", delivery_approved_at: new Date().toISOString() })
        .eq("id", task.id);

      // Bump tasks_completed counters for every credited recipient.
      for (const recipient of recipients) {
        const { data: sp } = await supabaseAdmin
          .from("student_profiles")
          .select("tasks_completed")
          .eq("user_id", recipient.studentId)
          .maybeSingle();
        if (sp) {
          await supabaseAdmin
            .from("student_profiles")
            .update({ tasks_completed: (sp.tasks_completed ?? 0) + 1 })
            .eq("user_id", recipient.studentId);
        }
      }

      // Credit referral rewards if any recipient was referred.
      // This logic mirrors creditReferralRewards in referral.functions.ts but
      // runs inline to avoid createServerFn context issues.
      for (const recipient of recipients) {
        try {
          const { data: refEvent } = await (supabaseAdmin as any)
            .from("referral_events")
            .select("id, referrer_id, referrer_credit, referred_credit")
            .eq("referred_id", recipient.studentId)
            .eq("credited", false)
            .maybeSingle();

          if (!refEvent) continue;

          const referrerAmount = Number(refEvent.referrer_credit ?? 500);
          const referredAmount = Number(refEvent.referred_credit ?? 250);

          // Credit referrer's wallet.
          const refCreditRes = await supabaseAdmin.rpc("credit_wallet", {
            p_user_id: refEvent.referrer_id,
            p_amount: referrerAmount,
            p_description: `Referral reward: someone you invited completed their first task!`,
            p_reference: `REFERRAL_REFERRER_${recipient.studentId}`,
          });
          if (refCreditRes.error) throw refCreditRes.error;

          // Credit referred user's wallet (completion bonus).
          const refdCreditRes = await supabaseAdmin.rpc("credit_wallet", {
            p_user_id: recipient.studentId,
            p_amount: referredAmount,
            p_description: `Referral completion bonus: thanks for completing your first task!`,
            p_reference: `REFERRAL_REFERRED_${recipient.studentId}`,
          });
          if (refdCreditRes.error) throw refdCreditRes.error;

          // Mark event as credited.
          await (supabaseAdmin as any)
            .from("referral_events")
            .update({ credited: true })
            .eq("id", refEvent.id);

          // Notify both parties.
          await supabaseAdmin.from("notifications").insert([
            {
              user_id: refEvent.referrer_id,
              type: "referral_reward",
              message: `You earned \u20A6${referrerAmount.toLocaleString("en-NG")}! Your referral completed their first task.`,
              link: "/app/referrals",
            },
            {
              user_id: recipient.studentId,
              type: "referral_reward",
              message: `You earned a \u20A6${referredAmount.toLocaleString("en-NG")} completion bonus for your first task!`,
              link: "/app/referrals",
            },
          ]);
        } catch {
          // Non-fatal — don't block task completion if referral credit fails.
        }
      }

      await supabaseAdmin.from("notifications").insert(
        recipients.map((recipient) => ({
          user_id: recipient.studentId,
          type: "payment_released",
          message: `Payment released. ₦${recipient.amount.toLocaleString("en-NG")} is on the way.`,
          link: `/app/tasks/${task.id}`,
        })),
      );
    } catch (error) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "in_escrow" })
        .eq("id", tx.id)
        .eq("status", "released");
      throw error;
    }

    return { ok: true, payout };
  });

export const requestRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string; notes: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: task } = await supabase
      .from("tasks")
      .select("id, poster_id, matched_student_id, status, is_team_task")
      .eq("id", data.taskId)
      .single();
    if (!task || task.poster_id !== userId) throw new Error("Not allowed");
    if (task.status !== "in_review") throw new Error("No delivery to review");

    await supabase
      .from("tasks")
      .update({ status: "in_progress", revision_notes: data.notes, delivery_submitted_at: null })
      .eq("id", task.id);

    if (task.is_team_task) {
      await supabase
        .from("task_team_members")
        .update({
          delivery_submitted_at: null,
          delivery_title: null,
          delivery_message: null,
          delivery_url: null,
          delivery_file_url: null,
          delivery_file_name: null,
        })
        .eq("task_id", task.id)
        .eq("status", "active");

      const { data: teamMembers } = await supabase
        .from("task_team_members")
        .select("student_id")
        .eq("task_id", task.id)
        .eq("status", "active");

      const notifications = (teamMembers ?? [])
        .filter((member: any) => !!member.student_id)
        .map((member: any) => ({
          user_id: member.student_id,
          type: "revision_requested",
          message: "Poster requested a revision.",
          link: `/app/tasks/${task.id}`,
        }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications as any);
      }
    } else {
      await supabase.from("notifications").insert({
        user_id: task.matched_student_id!,
        type: "revision_requested",
        message: "Poster requested a revision.",
        link: `/app/tasks/${task.id}`,
      });
    }

    return { ok: true };
  });

export const verifyWalletFunding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { reference: string }) => input)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const reference = data.reference?.trim();
    if (!reference) throw new Error("Funding reference is required");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let verifiedPayload: any | null = null;

    const { data: existingFunding, error: fErr } = await supabaseAdmin
      .from("wallet_funding")
      .select("id, user_id, amount, status, webhook_processed")
      .eq("paystack_reference", reference)
      .eq("user_id", userId)
      .maybeSingle();

    if (fErr) throw new Error(fErr.message);

    let funding = existingFunding;

    if (!funding) {
      if (!process.env.PAYSTACK_SECRET_KEY) {
        return {
          ok: false,
          pending: false,
          message: "Wallet verification is not configured on the app server (missing PAYSTACK_SECRET_KEY).",
        };
      }

      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        },
      );

      const verifyData = (await verifyRes.json()) as any;
      verifiedPayload = verifyData;

      if (!verifyRes.ok || !verifyData?.status) {
        return { ok: false, pending: true, message: verifyData?.message ?? "Verification is still pending" };
      }

      if (verifyData?.data?.status !== "success") {
        return { ok: false, pending: true, message: `Payment status: ${verifyData?.data?.status ?? "pending"}` };
      }

      const metadataUserId = verifyData?.data?.metadata?.user_id;
      if (metadataUserId !== userId) {
        return { ok: false, pending: false, message: "This funding reference does not belong to your account." };
      }

      const amount = Number(verifyData?.data?.amount ?? 0) / 100;
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Invalid verified amount returned from Paystack");
      }

      const { data: walletRow, error: walletErr } = await supabaseAdmin
        .from("wallets")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (walletErr) throw new Error(walletErr.message);

      let walletId = walletRow?.id;
      if (!walletId) {
        const { data: createdWallet, error: createWalletErr } = await supabaseAdmin
          .from("wallets")
          .insert({ user_id: userId, balance: 0, total_earned: 0, total_withdrawn: 0 })
          .select("id")
          .single();
        if (createWalletErr || !createdWallet?.id) {
          throw new Error(createWalletErr?.message ?? "Could not create wallet record");
        }
        walletId = createdWallet.id;
      }

      const { data: insertedFunding, error: insertFundingErr } = await supabaseAdmin
        .from("wallet_funding")
        .insert({
          user_id: userId,
          wallet_id: walletId,
          amount,
          paystack_reference: reference,
          status: "pending",
          webhook_processed: false,
        })
        .select("id, user_id, amount, status, webhook_processed")
        .single();

      if (insertFundingErr) {
        const { data: retryFunding, error: retryErr } = await supabaseAdmin
          .from("wallet_funding")
          .select("id, user_id, amount, status, webhook_processed")
          .eq("paystack_reference", reference)
          .eq("user_id", userId)
          .maybeSingle();
        if (retryErr || !retryFunding) {
          throw new Error(insertFundingErr.message);
        }
        funding = retryFunding;
      } else {
        funding = insertedFunding;
      }
    }

    if (funding.status === "completed" || funding.webhook_processed) {
      return { ok: true, alreadyProcessed: true, credited: true, amount: Number(funding.amount) };
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return {
        ok: false,
        pending: false,
        message: "Wallet verification is not configured on the app server (missing PAYSTACK_SECRET_KEY).",
      };
    }

    const verifyData =
      verifiedPayload ??
      ((await (
        await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          },
        })
      ).json()) as any);

    if (!verifyData?.status) {
      return { ok: false, pending: true, message: verifyData?.message ?? "Verification is still pending" };
    }

    if (verifyData?.data?.status !== "success") {
      return { ok: false, pending: true, message: `Payment status: ${verifyData?.data?.status ?? "pending"}` };
    }

    const amount = Number(verifyData?.data?.amount ?? 0) / 100;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid verified amount returned from Paystack");
    }

    const expectedAmount = Number(funding.amount);
    if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
      throw new Error("Invalid funding amount in record");
    }
    if (Math.abs(amount - expectedAmount) > 0.01) {
      throw new Error("Verified amount does not match funding request");
    }

    const creditRes = await supabaseAdmin.rpc("credit_wallet", {
      p_user_id: funding.user_id,
      p_amount: expectedAmount,
      p_description: "Wallet top-up via Paystack",
      p_reference: reference,
    });

    const rpcSaysFailure = creditRes.data && creditRes.data.success === false;
    if (creditRes.error || rpcSaysFailure) {
      throw new Error(creditRes.error?.message ?? creditRes.data?.error ?? "Could not credit wallet");
    }

    const { error: fundingUpdateErr } = await supabaseAdmin
      .from("wallet_funding")
      .update({ status: "completed", webhook_processed: true, updated_at: new Date().toISOString() })
      .eq("id", funding.id);
    if (fundingUpdateErr) {
      throw new Error(`Wallet credited but funding record could not be marked complete: ${fundingUpdateErr.message}`);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: funding.user_id,
      type: "wallet_funded",
      message: `₦${amount.toLocaleString("en-NG")} has been added to your InTask wallet.`,
      link: "/app/wallet",
    });

    return { ok: true, credited: true, amount: expectedAmount };
  });

// Reads the current user's withdrawals through the service-role client.
// Direct client-side reads of withdrawal_requests can fail with 403 on
// environments where the authenticated role is missing the SELECT grant
// (drifted Lovable-managed databases), which silently disabled the wallet
// page's pending-withdrawal sync.
export const getMyWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await (supabaseAdmin as any)
      .from("withdrawal_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) throw new Error(error.message ?? "Could not load withdrawals");
    return (data ?? []) as any[];
  });
