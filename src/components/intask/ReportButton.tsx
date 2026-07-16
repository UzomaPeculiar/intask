import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Flag } from "lucide-react";
import { toast } from "sonner";

const REPORT_REASONS = [
  "Fake or misleading profile",
  "Scam or fraudulent activity",
  "Inappropriate content",
  "Harassment or abusive behaviour",
  "Spam",
  "Underpaying or exploitative task",
  "Did not pay after work was completed",
  "Did not deliver work after payment",
  "Other",
];

type Props = {
  reportedId: string;
  reportedName: string;
  variant?: "ghost" | "outline";
};

export function ReportButton({ reportedId, reportedName, variant = "ghost" }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    setSubmitting(true);
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) {
      toast.error("You must be logged in to report");
      setSubmitting(false);
      return;
    }
    if (me.user.id === reportedId) {
      toast.error("You cannot report yourself");
      setSubmitting(false);
      return;
    }
    const { error } = await (supabase as any).from("reports").insert({
      reporter_id: me.user.id,
      reported_id: reportedId,
      reason,
      details: details.trim() || null,
      status: "pending",
    });
    setSubmitting(false);
    if (error) {
      toast.error("Could not submit report. Please try again.");
      return;
    }
    toast.success("Report submitted. Our team will review it shortly.");
    setReason("");
    setDetails("");
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant={variant} size="sm" className="gap-1 text-muted-foreground hover:text-destructive">
          <Flag className="size-3.5" /> Report
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Report {reportedName}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Reason for report</label>
            <div className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                    reason === r
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-border bg-card text-foreground hover:border-destructive/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Additional details <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <Button
            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!reason || submitting}
            onClick={submit}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
          <button
            className="w-full text-center text-sm text-muted-foreground"
            onClick={() => setOpen(false)}
          >
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}