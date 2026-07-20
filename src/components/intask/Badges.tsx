import { Award } from "lucide-react";
import { CheckCircle2, Building2, GraduationCap, Clock } from "lucide-react";

export function VerifiedBadge({ role, verified, isPro }: { role?: "student" | "alumni" | "company" | "individual" | null; verified?: boolean; isPro?: boolean }) {
  if (role === "company") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
        <Building2 className="size-3" /> Business
      </span>
    );
  }
  if (role === "alumni") {
    if (isPro) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
          <GraduationCap className="size-3" /> Alumni Pro
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
        <GraduationCap className="size-3" /> Alumni
      </span>
    );
  }
  if (role === "individual") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        Individual
      </span>
    );
  }
  if (role === "student" && verified === false) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
        <Clock className="size-3" /> Verification pending
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
      <CheckCircle2 className="size-3" /> Verified Student
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  matched: "bg-primary/10 text-primary",
  in_progress: "bg-success/15 text-success",
  in_review: "bg-warning/15 text-warning",
  completed: "bg-muted text-muted-foreground",
  disputed: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
};
const label: Record<string, string> = {
  open: "Open",
  matched: "Matched",
  in_progress: "In progress",
  in_review: "Review needed",
  completed: "Completed",
  disputed: "Disputed",
  cancelled: "Cancelled",
  expired: "Expired",
};
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map[status] ?? "bg-muted text-muted-foreground"}`}>
      {label[status] ?? status}
    </span>
  );
}