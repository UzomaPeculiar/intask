export const PLATFORM_SETTING_DEFAULTS = {
  platform_fee_percent: 8,
  min_withdrawal_amount: 550,
  processing_fee_amount: 50,
  min_task_budget: 1000,
} as const;

export type PlatformNumericSettingKey = keyof typeof PLATFORM_SETTING_DEFAULTS;

function parseNumericSettingValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

export async function getNumericPlatformSetting(
  db: { from: (table: string) => any },
  key: PlatformNumericSettingKey,
  fallback: number,
): Promise<number> {
  try {
    const { data, error } = await (db as any)
      .from("platform_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();

    if (error) return fallback;
    return parseNumericSettingValue(data?.value, fallback);
  } catch {
    return fallback;
  }
}
