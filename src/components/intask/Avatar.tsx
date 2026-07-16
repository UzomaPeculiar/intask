import { initials, avatarColor } from "@/lib/format";

export function InitialsAvatar({
  name,
  size = 40,
  className = "",
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const text = initials(name ?? "?");
  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-foreground/80 ${className}`}
      style={{
        width: size,
        height: size,
        background: avatarColor(name ?? "?"),
        fontSize: Math.max(11, size * 0.4),
      }}
      aria-label={name ?? ""}
    >
      {text}
    </div>
  );
}
