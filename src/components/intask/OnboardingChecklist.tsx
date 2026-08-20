import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  X,
  Compass,
  FileText,
  ShieldCheck,
  User,
  Search,
} from "lucide-react";

const DISMISS_KEY = "intask_onboarding_dismissed";

interface Step {
  label: string;
  description: string;
  icon: typeof CheckCircle2;
  done: boolean;
  action?: string; // route to navigate to
  actionLabel?: string;
}

interface OnboardingChecklistProps {
  role: "student" | "alumni" | "company" | "individual" | null;
  profileComplete: boolean;
  tasksApplied: number;
  tasksPosted: number;
  verified: boolean;
}

export function OnboardingChecklist({
  role,
  profileComplete,
  tasksApplied,
  tasksPosted,
  verified,
}: OnboardingChecklistProps) {
  const nav = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "true");
    } catch {
      // localStorage unavailable
    }
  }, []);

  if (dismissed) return null;

  const isSeeker = role === "student" || role === "alumni";
  const isPoster = role === "company" || role === "individual";

  const steps: Step[] = isSeeker
    ? [
        {
          label: "Complete your profile",
          description: "Add your university, department, and skills",
          icon: User,
          done: profileComplete,
          action: "/app/profile/me",
          actionLabel: "Complete profile",
        },
        {
          label: "Apply to your first task",
          description: "Browse open tasks and send your first application",
          icon: Compass,
          done: tasksApplied > 0,
          action: "/app/browse",
          actionLabel: "Browse tasks",
        },
        {
          label: "Get verified",
          description: "Verify your student status to build trust",
          icon: ShieldCheck,
          done: verified,
          action: "/app/profile/me",
          actionLabel: "Verify now",
        },
      ]
    : [
        {
          label: "Complete your profile",
          description: "Add your business details and logo",
          icon: User,
          done: profileComplete,
          action: "/app/profile/me",
          actionLabel: "Complete profile",
        },
        {
          label: "Post your first task",
          description: "Describe what you need and set a budget",
          icon: FileText,
          done: tasksPosted > 0,
          action: "/app/tasks/create",
          actionLabel: "Post a task",
        },
        {
          label: "Get verified",
          description: "Verify your business to attract top talent",
          icon: ShieldCheck,
          done: verified,
          action: "/app/profile/me",
          actionLabel: "Verify now",
        },
      ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;
  const nextStep = steps.find((s) => !s.done);

  function handleDismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "true");
    } catch {
      // localStorage unavailable
    }
  }

  if (allDone) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-full bg-success/15">
              <CheckCircle2 className="size-5 text-success" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                You're all set!
              </p>
              <p className="text-xs text-muted-foreground">
                Your profile is complete. Start{" "}
                {isSeeker ? "applying to tasks" : "posting tasks"} to grow.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Get started with InTask
          </p>
          <p className="text-xs text-muted-foreground">
            {completedCount} of {steps.length} steps complete
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="mt-4 space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.label}
              className={`flex items-start gap-3 rounded-xl p-3 transition-colors ${
                step.done
                  ? "bg-success/5"
                  : "bg-muted/50"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {step.done ? (
                  <CheckCircle2 className="size-5 text-success" />
                ) : (
                  <Circle className="size-5 text-muted-foreground/50" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.done ? "text-success" : "text-foreground"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {!step.done && step.action && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => nav({ to: step.action as any })}
                >
                  {step.actionLabel}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick action for next step */}
      {nextStep?.action && (
        <div className="mt-4">
          <Button
            className="w-full"
            size="sm"
            onClick={() => nav({ to: nextStep.action as any })}
          >
            {nextStep.actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
