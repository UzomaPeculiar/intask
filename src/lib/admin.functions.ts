// @ts-nocheck
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_BANNED_WORDS, normalizeWords } from "@/lib/moderation";

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

function sumLedger(rows: any[] | null | undefined, amountField: string, predicate?: (row: any) => boolean) {
  return (rows ?? []).reduce((sum, row) => {
    if (predicate && !predicate(row)) return sum;
    return sum + Number(row?.[amountField] ?? 0);
  }, 0);
}

function deriveWalletSummary(
  wallet: any | null,
  earnedFromLedger: number,
  withdrawnFromLedger: number,
  spentFromLedger: number,
) {
  const walletBalance = Number(wallet?.balance ?? 0);
  const walletEarned = Number(wallet?.total_earned ?? 0);
  const walletWithdrawn = Number(wallet?.total_withdrawn ?? 0);

  const totalEarned = Math.max(walletEarned, earnedFromLedger);
  const totalSpent = Math.max(walletWithdrawn, withdrawnFromLedger, spentFromLedger);
  const balance = Number.isFinite(walletBalance) && walletBalance > 0 ? walletBalance : Math.max(0, totalEarned - totalSpent);

  return {
    balance,
    total_earned: totalEarned,
    total_withdrawn: totalSpent,
  };
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

export const getAdminUserWalletData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string }) => input)
  .handler(async ({ context, data }) => {
    const { userId: adminUserId } = context;
    const { db } = await ensureAdmin(adminUserId);

    if (!data.userId) {
      throw new Error("User id is required");
    }

    const walletRes = await db
      .from("wallets")
      .select("balance, total_earned, total_withdrawn")
      .eq("user_id", data.userId)
      .limit(1);

    if (walletRes.error) throw walletRes.error;

    const [earnedRes, withdrawalsRes, spentRes] = await Promise.all([
      db.from("transactions").select("amount, status, student_id").eq("student_id", data.userId).eq("status", "released"),
      db.from("withdrawal_requests").select("amount, net_amount, status, user_id").eq("user_id", data.userId).eq("status", "completed"),
      db.from("transactions").select("amount, status, poster_id").eq("poster_id", data.userId),
    ]);

    if (earnedRes.error) throw earnedRes.error;
    if (withdrawalsRes.error) throw withdrawalsRes.error;
    if (spentRes.error) throw spentRes.error;

    const earnedFromLedger = sumLedger(earnedRes.data, "amount");
    const withdrawnFromLedger = sumLedger(withdrawalsRes.data, "net_amount") || sumLedger(withdrawalsRes.data, "amount");
    const spentFromLedger = sumLedger(spentRes.data, "amount", (row) => ["in_escrow", "released", "disputed", "refunded"].includes(row?.status));

    // Generated types in this project use `type`; support `transaction_type` as fallback.
    let txRes = await db
      .from("wallet_transactions")
      .select("id, type, amount, status, description, created_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!txRes.error) {
      txRes = {
        ...txRes,
        data: (txRes.data ?? []).map((row: any) => ({
          ...row,
          transaction_type: row.type,
        })),
      } as any;
    }

    if (txRes.error && String(txRes.error.message ?? "").toLowerCase().includes("type")) {
      txRes = await db
        .from("wallet_transactions")
        .select("id, transaction_type, amount, status, description, created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(10);
    }

    if (txRes.error) {
      const rawTxRes = await db
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!rawTxRes.error) {
        txRes = {
          ...rawTxRes,
          data: (rawTxRes.data ?? []).map((row: any) => ({
            id: row.id,
            amount: row.amount,
            created_at: row.created_at,
            description: row.description ?? row.narration ?? row.note ?? null,
            status: row.status ?? "completed",
            transaction_type: row.transaction_type ?? row.type ?? null,
          })),
        } as any;
      }
    }

    // Wallet summary should remain available even when tx history query fails in drifted schemas.
    const walletTransactions = txRes.error ? [] : (txRes.data ?? []);

    let wallet = walletRes.data?.[0] ?? null;

    if (!wallet) {
      wallet = deriveWalletSummary(null, earnedFromLedger, withdrawnFromLedger, spentFromLedger);
    } else {
      wallet = deriveWalletSummary(wallet, earnedFromLedger, withdrawnFromLedger, spentFromLedger);
    }

    return {
      wallet,
      walletTransactions,
    };
  });

export const getAdminUsersManagementData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { db } = await ensureAdmin(userId);

    const warnings: string[] = [];

    let profilesRes = await db
      .from("profiles")
      .select("id, full_name, email, role, created_at, last_active_at, account_status, account_status_reason, is_admin")
      .order("created_at", { ascending: false });

    if (profilesRes.error) {
      const fallbackProfilesRes = await db
        .from("profiles")
        .select("id, full_name, email, role, created_at, is_admin")
        .order("created_at", { ascending: false });
      if (fallbackProfilesRes.error) {
        return { meId: userId, rows: [], warning: "Profiles table could not be loaded in this environment." };
      }
      warnings.push("Some profile status fields are unavailable in this environment.");
      profilesRes = { ...fallbackProfilesRes, data: (fallbackProfilesRes.data ?? []).map((p: any) => ({ ...p, last_active_at: null, account_status: "active", account_status_reason: null })) };
    }

    const [studentsRes, companiesRes, individualsRes, walletsRes, tasksRes, txRes, withdrawalsRes] = await Promise.allSettled([
      db.from("student_profiles").select("user_id, verified, tasks_completed"),
      db.from("company_profiles").select("user_id, verified"),
      db.from("individual_profiles").select("user_id, verified"),
      db.from("wallets").select("user_id, balance, total_earned, total_withdrawn"),
      db.from("tasks").select("id, poster_id, status"),
      db.from("transactions").select("poster_id, student_id, amount, status"),
      db.from("withdrawal_requests").select("user_id, amount, net_amount, status"),
    ]);

    function rowsFromResult(result: PromiseSettledResult<any>, label: string) {
      if (result.status === "rejected") {
        warnings.push(`${label} could not be loaded.`);
        return [];
      }
      if (result.value?.error) {
        warnings.push(`${label} could not be loaded.`);
        return [];
      }
      return result.value?.data ?? [];
    }

    const profiles = profilesRes.data ?? [];
    const students = rowsFromResult(studentsRes, "Student profiles");
    const companies = rowsFromResult(companiesRes, "Company profiles");
    const individuals = rowsFromResult(individualsRes, "Individual profiles");
    const wallets = rowsFromResult(walletsRes, "Wallets");
    const tasks = rowsFromResult(tasksRes, "Tasks");
    const transactions = rowsFromResult(txRes, "Transactions");
    const withdrawals = rowsFromResult(withdrawalsRes, "Withdrawal requests");

    const studentMap = new Map(students.map((s: any) => [s.user_id, s]));
    const companyMap = new Map(companies.map((c: any) => [c.user_id, c]));
    const individualMap = new Map(individuals.map((i: any) => [i.user_id, i]));
    const walletMap = new Map(wallets.map((w: any) => [w.user_id, w]));

    const completedPostedByUser: Record<string, number> = {};
    for (const task of tasks) {
      if (task?.poster_id && task?.status === "completed") {
        completedPostedByUser[task.poster_id] = (completedPostedByUser[task.poster_id] ?? 0) + 1;
      }
    }

    const earnedByStudent: Record<string, number> = {};
    const spentByPoster: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx?.student_id && tx.status === "released") {
        earnedByStudent[tx.student_id] = (earnedByStudent[tx.student_id] ?? 0) + Number(tx.amount ?? 0);
      }
      if (tx?.poster_id && ["in_escrow", "released", "disputed", "refunded"].includes(tx.status)) {
        spentByPoster[tx.poster_id] = (spentByPoster[tx.poster_id] ?? 0) + Number(tx.amount ?? 0);
      }
    }

    const withdrawnByUser: Record<string, number> = {};
    for (const withdrawal of withdrawals) {
      if (!withdrawal?.user_id || withdrawal.status !== "completed") continue;
      withdrawnByUser[withdrawal.user_id] = (withdrawnByUser[withdrawal.user_id] ?? 0) + Number(withdrawal.net_amount ?? withdrawal.amount ?? 0);
    }

    const rows = profiles.map((profile: any) => {
      const student = studentMap.get(profile.id);
      const company = companyMap.get(profile.id);
      const individual = individualMap.get(profile.id);
      const wallet = walletMap.get(profile.id);

      const verified = profile.role === "company" ? !!company?.verified : profile.role === "individual" ? !!individual?.verified : !!student?.verified;
      const tasksCompleted = profile.role === "student" || profile.role === "alumni" ? Number(student?.tasks_completed ?? 0) : Number(completedPostedByUser[profile.id] ?? 0);
      const totalEarned = Math.max(Number(wallet?.total_earned ?? 0), Number(earnedByStudent[profile.id] ?? 0));
      const totalSpent = Math.max(Number(wallet?.total_withdrawn ?? 0), Number(withdrawnByUser[profile.id] ?? 0), Number(spentByPoster[profile.id] ?? 0));
      const walletBalance = Number(wallet?.balance ?? 0) || Math.max(0, totalEarned - totalSpent);

      return { ...profile, verified, tasksCompleted, totalEarned, totalSpent, walletBalance, accountStatus: profile.account_status ?? "active" };
    });

    return { meId: userId, rows, warning: warnings.length > 0 ? warnings[0] : null };
  });

export const adminSaveModerationRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { words: string[] }) => input)
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { db } = await ensureAdmin(userId);

    const normalized = normalizeWords(data.words ?? []);

    if (normalized.length === 0) {
      throw new Error("Add at least one keyword");
    }

    const nowIso = new Date().toISOString();

    const { data: updatedRows, error: updateErr } = await db
      .from("platform_settings")
      .update({
        value: normalized,
        description: "Keywords used for automatic moderation flagging",
        updated_by: userId,
        updated_at: nowIso,
      })
      .eq("key", "banned_words_rules")
      .select("key");

    if (updateErr) throw updateErr;

    if (!updatedRows || updatedRows.length === 0) {
      const { error: insertErr } = await db
        .from("platform_settings")
        .insert({
          key: "banned_words_rules",
          value: normalized,
          description: "Keywords used for automatic moderation flagging",
          updated_by: userId,
          updated_at: nowIso,
        });
      if (insertErr) throw insertErr;
    }

    await db.from("audit_log").insert({
      admin_user_id: userId,
      action: "settings.update",
      target_type: "settings",
      target_id: "banned_words_rules",
      details: {
        key: "banned_words_rules",
        wordsCount: normalized.length,
      },
    });

    return { ok: true, words: normalized };
  });

export const getModerationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    await ensureAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data, error } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "banned_words_rules")
      .maybeSingle();

    if (error) {
      return { words: DEFAULT_BANNED_WORDS };
    }

    const rawValue = data?.value;
    if (!Array.isArray(rawValue)) {
      return { words: DEFAULT_BANNED_WORDS };
    }

    return { words: normalizeWords(rawValue.map((v: any) => String(v ?? ""))) };
  });

export const getAdminFinancialData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { db } = await ensureAdmin(userId);

    // Some environments may not yet have updated_at/processed_at on withdrawal_requests.
    // Use a compatible fallback select so financial tab remains functional.
    let withdrawalsQueryResult = await db
      .from("withdrawal_requests")
      .select("id, user_id, amount, fee, net_amount, bank_name, account_number, account_name, status, created_at, updated_at, processed_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (withdrawalsQueryResult?.error?.message?.includes("column withdrawal_requests.updated_at does not exist")) {
      withdrawalsQueryResult = await db
        .from("withdrawal_requests")
        .select("id, user_id, amount, fee, net_amount, bank_name, account_number, account_name, status, created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
    }

    const [txRes, fundingRes, profilesRes, walletsRes, tasksRes] = await Promise.allSettled([
      db
        .from("transactions")
        .select("id, task_id, poster_id, student_id, amount, platform_fee, status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      db
        .from("wallet_funding")
        .select("id, user_id, amount, paystack_reference, status, webhook_processed, created_at, updated_at")
        .order("created_at", { ascending: false })
        .limit(1000),
      db
        .from("profiles")
        .select("id, full_name, email")
        .order("created_at", { ascending: false })
        .limit(5000),
      db
        .from("wallets")
        .select("user_id, balance"),
      db
        .from("tasks")
        .select("id, title")
        .order("created_at", { ascending: false })
        .limit(5000),
    ]);

    function unwrap(result: PromiseSettledResult<any>, source: string) {
      if (result.status === "rejected") {
        return { data: [], error: `${source}: ${result.reason?.message ?? "request failed"}` };
      }

      if (result.value?.error) {
        return { data: [], error: `${source}: ${result.value.error.message ?? "query failed"}` };
      }

      return { data: result.value?.data ?? [], error: null };
    }

    const withdrawalsPayload = withdrawalsQueryResult?.error
      ? { data: [], error: `withdrawal_requests: ${withdrawalsQueryResult.error.message ?? "query failed"}` }
      : { data: withdrawalsQueryResult?.data ?? [], error: null };
    const transactionsPayload = unwrap(txRes, "transactions");
    const fundingPayload = unwrap(fundingRes, "wallet_funding");
    const profilesPayload = unwrap(profilesRes, "profiles");
    const walletsPayload = unwrap(walletsRes, "wallets");
    const tasksPayload = unwrap(tasksRes, "tasks");

    const sourceErrors = [
      withdrawalsPayload.error,
      transactionsPayload.error,
      fundingPayload.error,
      profilesPayload.error,
      walletsPayload.error,
      tasksPayload.error,
    ].filter(Boolean);

    if (sourceErrors.length === 6) {
      throw new Error(sourceErrors[0]);
    }

    const profiles = profilesPayload.data;
    const tasks = tasksPayload.data;
    const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
    const taskMap = new Map(tasks.map((t: any) => [t.id, t]));

    const withdrawals = (withdrawalsPayload.data ?? []).map((w: any) => ({
      ...w,
      user: profileMap.get(w.user_id)
        ? {
            id: profileMap.get(w.user_id).id,
            full_name: profileMap.get(w.user_id).full_name,
            email: profileMap.get(w.user_id).email,
          }
        : null,
    }));

    const transactions = (transactionsPayload.data ?? []).map((t: any) => ({
      ...t,
      task: taskMap.get(t.task_id)
        ? { title: taskMap.get(t.task_id).title }
        : null,
      poster: profileMap.get(t.poster_id)
        ? {
            full_name: profileMap.get(t.poster_id).full_name,
            email: profileMap.get(t.poster_id).email,
          }
        : null,
      student: profileMap.get(t.student_id)
        ? {
            full_name: profileMap.get(t.student_id).full_name,
            email: profileMap.get(t.student_id).email,
          }
        : null,
    }));

    const funding = (fundingPayload.data ?? []).map((f: any) => ({
      ...f,
      user: profileMap.get(f.user_id)
        ? {
            full_name: profileMap.get(f.user_id).full_name,
            email: profileMap.get(f.user_id).email,
          }
        : null,
    }));

    return {
      withdrawals,
      transactions,
      funding,
      profiles,
      wallets: walletsPayload.data ?? [],
      sourceErrors,
    };
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
      db.from("withdrawal_requests").select("id, status, fee, created_at, webhook_processed"),
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

    const taskFeesEarned = transactions
      .filter((tx) => tx.status === "released")
      .reduce((sum, tx) => sum + Number(tx.platform_fee ?? 0), 0);

    const withdrawalFeesEarned = withdrawals
      .filter((w) => w.status === "completed")
      .reduce((sum, w) => sum + Number(w.fee ?? 0), 0);

    const platformFeesEarned = taskFeesEarned + withdrawalFeesEarned;

    const signupsToday = profiles.filter((p) => p.created_at && new Date(p.created_at) >= today).length;
    const tasksPostedToday = tasks.filter((t) => t.created_at && new Date(t.created_at) >= today).length;
    const tasksCompletedToday = tasks.filter((t) => t.status === "completed" && t.updated_at && new Date(t.updated_at) >= today).length;
    const paymentsProcessedToday = transactions.filter((tx) => tx.updated_at && new Date(tx.updated_at) >= today && ["in_escrow", "released", "refunded", "disputed"].includes(tx.status)).length;
    const withdrawalFeesToday = withdrawals
      .filter((w) => w.created_at && new Date(w.created_at) >= today && w.status === "completed")
      .reduce((sum, w) => sum + Number(w.fee ?? 0), 0);

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
        taskFeesEarned,
        withdrawalFeesEarned,
        platformFeesEarned,
      },
      today: {
        signupsToday,
        tasksPostedToday,
        tasksCompletedToday,
        paymentsProcessedToday,
        withdrawalFeesToday,
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
