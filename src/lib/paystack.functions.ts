import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEE_RATE = 0.08;

export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? process.env.VITE_PAYSTACK_PUBLIC_KEY ?? "" };
});

export const initEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, budget, poster_id, matched_student_id, status")
      .eq("id", data.taskId)
      .single();

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

    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email;

    if (!email) {
      throw new Error("Add an email to your profile first");
    }

    // Reuse pending transaction if one exists
    const { data: existingTransaction, error: existingTxError } = await supabase
      .from("transactions")
      .select("id, status, paystack_reference")
      .eq("task_id", task.id)
      .maybeSingle();

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
        const { data: existingConv } = await supabase
          .from("conversations")
          .select("id")
          .eq("task_id", task.id)
          .eq("student_id", task.matched_student_id)
          .maybeSingle();

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

    // The existing transaction is still pending but Paystack did not
    // confirm a successful payment. Remove it before creating a new one.
    if (existingTransaction) {
      const { error: deleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("id", existingTransaction.id);

      if (deleteError) {
        throw deleteError;
      }
    }

    // Create a new transaction and Paystack reference.
    const reference = `intask_${task.id.slice(0, 8)}_${Date.now()}`;

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        task_id: task.id,
        poster_id: task.poster_id,
        student_id: task.matched_student_id,
        amount: task.budget,
        platform_fee: Number(task.budget) * FEE_RATE,
        status: "pending",
        paystack_reference: reference,
      })
      .select("id")
      .single();
  
    if (txErr || !tx) {
      throw txErr ?? new Error("Could not create transaction");
    }
    
    const amountKobo = Math.round(Number(task.budget) * 100);
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
          transaction_id: tx.id },
      }),
    });
    const json = (await res.json()) as any;
    if (!res.ok || !json?.status) throw new Error(json?.message ?? "Paystack init failed");

    return {
      reference,
      accessCode: json.data.access_code as string,
      authorizationUrl: json.data.authorization_url as string,
      amount: Number(task.budget),
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
      await supabaseAdmin.from("transactions").update({ status: "in_escrow" }).eq("id", tx.id);
      await supabaseAdmin.from("tasks").update({ status: "in_progress" }).eq("id", tx.task_id);
      await supabaseAdmin
        .from("applications")
        .update({ status: "accepted" })
        .eq("task_id", tx.task_id)
        .eq("student_id", tx.student_id);

      const { data: existingConv } = await supabaseAdmin
        .from("conversations")
        .select("id")
        .eq("task_id", tx.task_id)
        .eq("student_id", tx.student_id)
        .maybeSingle();
      if (!existingConv) {
        await supabaseAdmin.from("conversations").insert({
          task_id: tx.task_id,
          student_id: tx.student_id,
          poster_id: tx.poster_id,
        });
      }
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
      .select("id, poster_id, matched_student_id, status")
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
    const creditRes = await supabaseAdmin.rpc("credit_wallet", {
      p_user_id: tx.student_id,
      p_amount: payout,
      p_description: `Payment for task ${task.id}`,
      p_reference: `ESCROW_RELEASE_${task.id}`,
    });

    if (creditRes.error || !creditRes.data?.success) {
      throw new Error(creditRes.error?.message ?? creditRes.data?.error ?? "Could not credit student wallet");
    }

    await supabaseAdmin.from("transactions").update({ status: "released" }).eq("id", tx.id);
    await supabaseAdmin
      .from("tasks")
      .update({ status: "completed", delivery_approved_at: new Date().toISOString() })
      .eq("id", task.id);

    // Bump student tasks_completed counter
    const { data: sp } = await supabaseAdmin
      .from("student_profiles")
      .select("tasks_completed")
      .eq("user_id", tx.student_id)
      .maybeSingle();
    if (sp) {
      await supabaseAdmin
        .from("student_profiles")
        .update({ tasks_completed: (sp.tasks_completed ?? 0) + 1 })
        .eq("user_id", tx.student_id);
    }

    await supabaseAdmin.from("notifications").insert([
      {
        user_id: tx.student_id,
        type: "payment_released",
        message: `Payment released. ₦${payout.toLocaleString("en-NG")} is on the way.`,
        link: `/app/tasks/${task.id}`,
      },
    ]);

    return { ok: true, payout };
  });

export const requestRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { taskId: string; notes: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: task } = await supabase
      .from("tasks")
      .select("id, poster_id, matched_student_id, status")
      .eq("id", data.taskId)
      .single();
    if (!task || task.poster_id !== userId) throw new Error("Not allowed");
    if (task.status !== "in_review") throw new Error("No delivery to review");

    await supabase
      .from("tasks")
      .update({ status: "in_progress", revision_notes: data.notes })
      .eq("id", task.id);

    await supabase.from("notifications").insert({
      user_id: task.matched_student_id!,
      type: "revision_requested",
      message: "Poster requested a revision.",
      link: `/app/tasks/${task.id}`,
    });

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

    await supabaseAdmin
      .from("wallet_funding")
      .update({ status: "completed", webhook_processed: true, updated_at: new Date().toISOString() })
      .eq("id", funding.id);

    await supabaseAdmin.from("notifications").insert({
      user_id: funding.user_id,
      type: "wallet_funded",
      message: `₦${amount.toLocaleString("en-NG")} has been added to your InTask wallet.`,
      link: "/app/wallet",
    });

    return { ok: true, credited: true, amount: expectedAmount };
  });
