import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const DISPUTE_REASONS = [
  "Work was not delivered as described",
  "Student stopped responding",
  "Work quality was unacceptable",
  "Poster refused to release payment after approval",
  "Poster changed requirements after work started",
  "Payment was not secured in escrow",
  "Other",
];

type Props = {
  taskId: string;
  taskTitle: string;
};

export function DisputeButton({ taskId, taskTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  async function submit() {
    if (!reason) { toast.error("Please select a reason"); return; }
    setSubmitting(true);
    const { data: me } = await supabase.auth.getUser();
    if (!me.user) { toast.error("Not signed in"); setSubmitting(false); return; }
    const { error } = await (supabase as any).from("disputes").insert({
      task_id: taskId,
      raised_by: me.user.id,
      reason,
      details: details.trim() || null,
      status: "open",
    });
    setSubmitting(false);
    if (error) { toast.error("Could not submit dispute. Please try again."); return; }
    await supabase.from("transactions")
      .update({ status: "disputed" } as any)
      .eq("task_id", taskId);
    toast.success("Dispute submitted. Our team will review it within 48 hours. Funds remain held in escrow.");
    setReason("");
    setDetails("");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["task", taskId] });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10 w-full">
          <AlertTriangle className="size-3.5" /> Raise a dispute
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="text-left">
          <SheetTitle>Raise a dispute</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6 pt-2">
          <p className="text-xs text-muted-foreground">
            Task: <span className="font-medium text-foreground">{taskTitle}</span>
          </p>
          <p className="text-xs text-muted-foreground rounded-lg bg-muted/50 px-3 py-2">
            Funds will remain held in escrow until the dispute is resolved. Our team will review within 48 hours.
          </p>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">What went wrong?</label>
            <div className="space-y-2">
              {DISPUTE_REASONS.map((r) => (
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
              placeholder="Describe what happened in detail..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <Button
            className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={!reason || submitting}
            onClick={submit}
          >
            {submitting ? "Submitting..." : "Submit dispute"}
          </Button>
          <button className="w-full text-center text-sm text-muted-foreground" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}