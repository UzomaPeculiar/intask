import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live applicant count for a task.
 * Reads tasks.applicants_count (kept in sync by a database trigger) and
 * subscribes to Realtime UPDATE on that task row.
 */
export function useApplicantCount(taskId: string | undefined, initial = 0) {
  const [count, setCount] = useState<number>(initial);

  useEffect(() => {
    setCount(initial);
  }, [initial]);

  useEffect(() => {
    if (!taskId) return;
    let active = true;

    const refetch = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("applicants_count")
        .eq("id", taskId)
        .maybeSingle();
      if (!active || error || !data) return;
      setCount(Number(data.applicants_count ?? 0));
    };

    refetch();

    const channel = supabase
      .channel(`applicant-count-${taskId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks", filter: `id=eq.${taskId}` },
        () => refetch(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  return count;
}

export function applicantLabel(n: number) {
  return `See ${n} applicant${n === 1 ? "" : "s"}`;
}
