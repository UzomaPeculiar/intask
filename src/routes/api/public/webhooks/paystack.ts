import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PAYSTACK_SECRET_KEY;
        if (!secret) return new Response("Server not configured", { status: 500 });

        const raw = await request.text();
        const sig = request.headers.get("x-paystack-signature") ?? "";
        const expected = createHmac("sha512", secret).update(raw).digest("hex");
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const evt = JSON.parse(raw);
        if (evt?.event !== "charge.success") return new Response("ignored");

        const reference: string = evt.data?.reference ?? "";
        const meta = evt.data?.metadata ?? {};
        const taskId: string | undefined = meta.task_id;
        if (!reference) return new Response("missing reference", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: tx } = await supabaseAdmin
          .from("transactions")
          .select("id, task_id, poster_id, student_id, status")
          .eq("paystack_reference", reference)
          .maybeSingle();
        if (!tx) return new Response("tx not found", { status: 404 });
        if (tx.status === "in_escrow" || tx.status === "released") {
          return new Response("already processed");
        }

        await supabaseAdmin.from("transactions").update({ status: "in_escrow" }).eq("id", tx.id);
        await supabaseAdmin
          .from("tasks")
          .update({ status: "in_progress" })
          .eq("id", tx.task_id);

        // Create conversation if not exists
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

        await supabaseAdmin.from("notifications").insert([
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

        return new Response("ok");
      },
    },
  },
});
