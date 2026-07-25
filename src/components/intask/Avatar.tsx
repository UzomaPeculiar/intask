type Props = {
  name?: string | null;
  size?: number;
  avatarUrl?: string | null;
};

const COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500",
  "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-rose-500",
];

export function InitialsAvatar({ name, size = 40, avatarUrl }: Props) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";
  const colorIndex = name ? name.charCodeAt(0) % COLORS.length : 0;
  const bgColor = COLORS[colorIndex];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name ?? "Avatar"}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`${bgColor} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}