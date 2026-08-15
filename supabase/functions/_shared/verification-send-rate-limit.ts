const SEND_COOLDOWN_MS = 60_000;
const MAX_SENDS_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

export type VerificationSendRateState = {
  last_sent_at: string | null;
  sends_in_hour: number | null;
  send_hour_started_at: string | null;
};

type RateLimitResult =
  | { allowed: true; sendsInHour: number; sendHourStartedAt: string }
  | { allowed: false; status: number; error: string };

export function checkVerificationSendRateLimit(
  state: VerificationSendRateState | null | undefined,
): RateLimitResult {
  const now = Date.now();

  if (state?.last_sent_at) {
    const elapsed = now - new Date(state.last_sent_at).getTime();
    if (elapsed < SEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((SEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        allowed: false,
        status: 429,
        error: `Please wait ${waitSeconds} second${waitSeconds === 1 ? "" : "s"} before requesting a new code.`,
      };
    }
  }

  const hourStartedAt = state?.send_hour_started_at
    ? new Date(state.send_hour_started_at).getTime()
    : null;
  const hourWindowExpired = hourStartedAt === null || now - hourStartedAt >= HOUR_MS;

  const sendsInHour = hourWindowExpired ? 0 : (state?.sends_in_hour ?? 0);
  const sendHourStartedAt = hourWindowExpired
    ? new Date(now).toISOString()
    : state!.send_hour_started_at!;

  if (sendsInHour >= MAX_SENDS_PER_HOUR) {
    return {
      allowed: false,
      status: 429,
      error: "Too many verification codes requested. Try again in about an hour.",
    };
  }

  return {
    allowed: true,
    sendsInHour: sendsInHour + 1,
    sendHourStartedAt,
  };
}
