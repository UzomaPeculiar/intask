import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Props = {
  taskId: string;
  userId?: string;
};

export function SaveTaskButton({ taskId, userId }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    (supabase as any)
      .from("saved_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("task_id", taskId)
      .maybeSingle()
      .then(({ data }: any) => setSaved(!!data));
  }, [taskId, userId]);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) { toast.error("Log in to save tasks"); return; }
    setLoading(true);
    if (saved) {
      await (supabase as any)
        .from("saved_tasks")
        .delete()
        .eq("user_id", userId)
        .eq("task_id", taskId);
      setSaved(false);
      toast.success("Task removed from saved");
    } else {
      await (supabase as any)
        .from("saved_tasks")
        .insert({ user_id: userId, task_id: taskId });
      setSaved(true);
      toast.success("Task saved");
    }
    setLoading(false);
    qc.invalidateQueries({ queryKey: ["saved-tasks"] });
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={saved ? "Unsave task" : "Save task"}
      className={`grid size-8 place-items-center rounded-full border transition-colors ${
        saved
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
      }`}
    >
      <Bookmark className={`size-4 ${saved ? "fill-primary" : ""}`} />
    </button>
  );
}