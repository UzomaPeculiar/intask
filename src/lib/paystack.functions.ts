import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FEE_RATE = 0.08;

export const getPaystackPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { publicKey: process.env.PAYSTACK_PUBLIC_KEY ?? process.env.VITE_PAYSTACK_PUBLIC_KEY ?? "" };
});

export const initEscrow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { taskId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: task, error: tErr } = await supabase
      .from("tasks")
      .select("id, title, budget, poster_id, matched_student_id, status")
      .eq("id", data.taskId)
      .single();
    if (tErr || !task) throw new Error("Task not found");
    if (task.poster_id !== userId) throw new Error("Only the poster can pay for this task");
    if (!task.matched_student_id) throw new Error("Accept a student first");
    if (!["matched", "open"].includes(task.status)) {
      throw new Error("This task is already paid for or in progress");
    }
    if (!task.budget || Number(task.budget) <= 0) throw new Error("Task budget is not set");

    const { data: userRes } = await supabase.auth.getUser();
    const email = userRes.user?.email;
    if (!email) throw new Error("Add an email to your profile first");

    // Reuse pending transaction if one exists
    const { data: existing } = await supabase
      .from("transactions")
      .select("id, paystack_reference, status")
      .eq("task_id", task.id)
      .maybeSingle();

    let txId = existing?.id;
    let reference = existing?.paystack_reference;

    if (existing && existing.status !== "pending") {
      throw new Error("Payment already completed for this task");
    }

    if (!txId) {
      reference = `intask_${task.id.slice(0, 8)}_${Date.now()}`;
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
      if (txErr) throw txErr;
      txId = tx.id;
    } else if (!reference) {
      reference = `intask_${task.id.slice(0, 8)}_${Date.now()}`;
      await supabase.from("transactions").update({ paystack_reference: reference }).eq("id", txId);
    }

    const amountKobo = Math.round(Number(task.budget) * 100);
    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        reference,
        metadata: { task_id: task.id, transaction_id: txId },
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
  .inputValidator((input: { reference: string }) => input)
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
  .inputValidator((input: { taskId: string }) => input)
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

    const payout = Number(tx.amount) - Number(tx.platform_fee);
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
  .inputValidator((input: { taskId: string; notes: string }) => input)
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
