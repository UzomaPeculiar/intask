import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  getNumericPlatformSetting,
  PLATFORM_SETTING_DEFAULTS,
} from "@/lib/platform-settings";

export const getRuntimePlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [platformFeePercent, minWithdrawalAmount, processingFeeAmount, minTaskBudget, maintenanceModeSetting] = await Promise.all([
      getNumericPlatformSetting(
        db,
        "platform_fee_percent",
        PLATFORM_SETTING_DEFAULTS.platform_fee_percent,
      ),
      getNumericPlatformSetting(
        db,
        "min_withdrawal_amount",
        PLATFORM_SETTING_DEFAULTS.min_withdrawal_amount,
      ),
      getNumericPlatformSetting(
        db,
        "processing_fee_amount",
        PLATFORM_SETTING_DEFAULTS.processing_fee_amount,
      ),
      getNumericPlatformSetting(
        db,
        "min_task_budget",
        PLATFORM_SETTING_DEFAULTS.min_task_budget,
      ),
      db
        .from("platform_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle(),
    ]);

    const maintenanceRaw = maintenanceModeSetting?.data?.value;
    const maintenanceMode =
      typeof maintenanceRaw === "boolean"
        ? maintenanceRaw
        : typeof maintenanceRaw === "string"
          ? maintenanceRaw.toLowerCase() === "true"
          : false;

    return {
      platform_fee_percent: Math.min(100, Math.max(0, Number(platformFeePercent))),
      min_withdrawal_amount: Math.max(0, Number(minWithdrawalAmount)),
      processing_fee_amount: Math.max(0, Number(processingFeeAmount)),
      min_task_budget: Math.max(0, Number(minTaskBudget)),
      maintenance_mode: maintenanceMode,
    };
  });
