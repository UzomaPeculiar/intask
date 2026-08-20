// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Get or create the current user's referral code.
 * Returns the code plus stats (total referrals, total earned).
 */
export const getMyReferralCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    // Check if user already has a referral code.
    const { data: existing } = await (db as any)
      .from("referral_codes")
      .select("code, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      // Fetch stats.
      const { data: events } = await (db as any)
        .from("referral_events")
        .select("referrer_credit, credited")
        .eq("referrer_id", userId);

      const totalReferrals = (events ?? []).length;
      const totalEarned = (events ?? []).reduce(
        (sum: number, e: any) => sum + Number(e.referrer_credit ?? 0),
        0,
      );

      return { code: existing.code, totalReferrals, totalEarned };
    }

    // Generate a new code (retry up to 5 times on collision).
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: codeResult } = await (db as any).rpc("generate_referral_code");
      const code = codeResult as string;

      if (!code) continue;

      const { error: insertErr } = await (db as any)
        .from("referral_codes")
        .insert({ user_id: userId, code });

      if (!insertErr) {
        return { code, totalReferrals: 0, totalEarned: 0 };
      }
      // Unique constraint violation → retry.
    }

    throw new Error("Could not generate a unique referral code. Please try again.");
  });

/**
 * Get referral stats for the current user.
 */
export const getMyReferralStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: events } = await (db as any)
      .from("referral_events")
      .select("referred_id, referrer_credit, credited, created_at")
      .eq("referrer_id", userId)
      .order("created_at", { ascending: false });

    const totalReferrals = (events ?? []).length;
    const totalEarned = (events ?? []).reduce(
      (sum: number, e: any) => sum + Number(e.referrer_credit ?? 0),
      0,
    );
    const creditedCount = (events ?? []).filter((e: any) => e.credited).length;

    // Fetch referred user names.
    const referredIds = (events ?? []).map((e: any) => e.referred_id).filter(Boolean);
    const { data: profiles } = referredIds.length > 0
      ? await (db as any)
          .from("profiles")
          .select("id, full_name")
          .in("id", referredIds)
      : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const referrals = (events ?? []).map((e: any) => ({
      referred_id: e.referred_id,
      referred_name: profileMap.get(e.referred_id)?.full_name ?? "Unknown",
      referrer_credit: e.referrer_credit,
      credited: e.credited,
      created_at: e.created_at,
    }));

    return { totalReferrals, totalEarned, creditedCount, referrals };
  });

/**
 * Apply a referral code. Called during signup with the referral code.
 * Creates a referral event and credits both parties.
 */
export const applyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { code: string }) => data)
  .handler(async ({ context, data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const code = data.code?.trim().toUpperCase();

    if (!code || code.length < 4) {
      throw new Error("Invalid referral code");
    }

    // Cannot refer yourself.
    const { data: referrerCode } = await (db as any)
      .from("referral_codes")
      .select("user_id")
      .eq("code", code)
      .maybeSingle();

    if (!referrerCode) {
      throw new Error("Referral code not found");
    }

    if (referrerCode.user_id === userId) {
      throw new Error("You cannot use your own referral code");
    }

    // Check if already referred.
    const { data: existingEvent } = await (db as any)
      .from("referral_events")
      .select("id")
      .eq("referred_id", userId)
      .maybeSingle();

    if (existingEvent) {
      throw new Error("You have already been referred");
    }

    // Fetch reward amounts from platform settings.
    const { data: settings } = await (db as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "referral_rewards")
      .maybeSingle();

    const rewards = settings?.value ?? { referrer_amount: 500, referred_amount: 250 };
    const referrerAmount = Number(rewards.referrer_amount ?? 500);
    const referredAmount = Number(rewards.referred_amount ?? 250);

    // Create the referral event — credits are held pending until the referred
    // user completes a task (handled by creditReferralRewards).
    const { error: eventErr } = await (db as any)
      .from("referral_events")
      .insert({
        referrer_id: referrerCode.user_id,
        referred_id: userId,
        referral_code: code,
        referrer_credit: referrerAmount,
        referred_credit: referredAmount,
        credited: false,
      });

    if (eventErr) throw eventErr;

    // Notify the referrer that someone signed up — credit comes after first task.
    await (db as any).from("notifications").insert({
      user_id: referrerCode.user_id,
      type: "referral_signup",
      message: `Someone signed up with your referral code! You'll earn ₦${referrerAmount.toLocaleString("en-NG")} after they complete their first task.`,
      link: "/app/referrals",
    });

    return { ok: true, referrerAmount, referredAmount, credited: false };
  });

/**
 * Credit referral rewards after the referred user completes a task.
 * Called from releaseEscrow when a task is marked completed.
 * Idempotent — safe to call multiple times for the same user.
 */
export const creditReferralRewards = createServerFn({ method: "POST" })
  .validator((data: { completedUserId: string }) => data)
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const completedUserId = data.completedUserId;

    // Find the pending referral event for this user.
    const { data: event } = await (db as any)
      .from("referral_events")
      .select("id, referrer_id, referrer_credit, referred_credit, credited")
      .eq("referred_id", completedUserId)
      .eq("credited", false)
      .maybeSingle();

    if (!event) return { ok: true, credited: false }; // No pending referral

    // Fetch reward amounts from platform settings (fallback to stored values).
    const { data: settings } = await (db as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "referral_rewards")
      .maybeSingle();

    const rewards = settings?.value ?? {};
    const referrerAmount = Number(event.referrer_credit ?? rewards.referrer_amount ?? 500);
    const referredAmount = Number(event.referred_credit ?? rewards.referred_amount ?? 250);

    // Credit the referrer's wallet.
    const referrerCredit = await (db as any).rpc("credit_wallet", {
      p_user_id: event.referrer_id,
      p_amount: referrerAmount,
      p_description: `Referral reward: someone you invited completed their first task!`,
      p_reference: `REFERRAL_REFERRER_${completedUserId}`,
    });

    if (referrerCredit.error) {
      throw new Error(`Could not credit referrer: ${referrerCredit.error.message}`);
    }

    // Credit the referred user's wallet (completion bonus).
    const referredCredit = await (db as any).rpc("credit_wallet", {
      p_user_id: completedUserId,
      p_amount: referredAmount,
      p_description: `Referral completion bonus: thanks for completing your first task!`,
      p_reference: `REFERRAL_REFERRED_${completedUserId}`,
    });

    if (referredCredit.error) {
      throw new Error(`Could not credit referred user: ${referredCredit.error.message}`);
    }

    // Mark the event as credited.
    await (db as any)
      .from("referral_events")
      .update({ credited: true })
      .eq("id", event.id);

    // Notify both parties.
    await (db as any).from("notifications").insert([
      {
        user_id: event.referrer_id,
        type: "referral_reward",
        message: `You earned ₦${referrerAmount.toLocaleString("en-NG")}! Your referral completed their first task.`,
        link: "/app/referrals",
      },
      {
        user_id: completedUserId,
        type: "referral_reward",
        message: `You earned a ₦${referredAmount.toLocaleString("en-NG")} completion bonus for your first task!`,
        link: "/app/referrals",
      },
    ]);

    return { ok: true, credited: true, referrerAmount, referredAmount };
  });
