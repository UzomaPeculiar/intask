/** Format a Naira amount with comma separators: 35000 -> "₦35,000". */
export function naira(amount: number | string | null | undefined): string {
  if (amount == null || amount === "") return "₦0";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) return "₦0";
  return "₦" + Math.round(n).toLocaleString("en-NG");
}

/** Initials from a name: "Ada Lovelace" -> "AL". */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Deterministic pastel-ish color for an initials avatar. */
export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `oklch(0.88 0.05 ${hue})`;
}

/** Format a date as a friendly short string. */
export function shortDate(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

/** Relative time, simple. */
export function timeAgo(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return shortDate(d);
}
