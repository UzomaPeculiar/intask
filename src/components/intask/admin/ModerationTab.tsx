import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { adminSaveModerationRules, getAdminModerationData } from "@/lib/admin.functions";
import { normalizeWords } from "@/lib/moderation";
import { toast } from "sonner";

export function ModerationTab() {
  const [keywordsInput, setKeywordsInput] = useState("");
  const saveModerationRules = useServerFn(adminSaveModerationRules);
  const loadModerationData = useServerFn(getAdminModerationData);

  const { data, isLoading, refetch } = useQuery<{
    words: string[];
    flaggedTasks: any[];
    flaggedMessages: any[];
  }>({
    queryKey: ["admin-moderation"],
    refetchInterval: 60000,
    queryFn: async () => await loadModerationData(),
  });

  useEffect(() => {
    if (data?.words?.length) {
      setKeywordsInput(data.words.join(", "));
    }
  }, [data?.words]);

  const saveWords = useMutation({
    mutationFn: async () => {
      const unique = normalizeWords(keywordsInput.split(","));
      if (unique.length === 0) throw new Error("Add at least one keyword");

      await saveModerationRules({ data: { words: unique } });
    },
    onSuccess: () => {
      toast.success("Banned words rules updated");
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update rules"),
  });

  if (isLoading) return <div className="text-center text-muted-foreground py-10">Loading moderation queue...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Content moderation queue</h2>
            <p className="text-xs text-muted-foreground">Banned words block task posting and trigger payment-safety warnings in chat.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Banned words / auto-flag rules</h3>
        <textarea
          rows={3}
          value={keywordsInput}
          onChange={(e) => setKeywordsInput(e.target.value)}
          placeholder="Enter comma-separated words"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
        <div>
          <Button size="sm" onClick={() => saveWords.mutate()} disabled={saveWords.isPending}>
            {saveWords.isPending ? "Saving..." : "Save rules"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Flagged task titles/descriptions</h3>
          {(data?.flaggedTasks?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No flagged tasks.</p>}
          {(data?.flaggedTasks ?? []).slice(0, 50).map((task: any) => (
            <div key={task.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium text-foreground">{task.title}</p>
              <p className="text-xs text-muted-foreground">Poster: {task.poster?.full_name ?? "Unknown"}</p>
              <p className="text-xs text-warning mt-1">Matched: {task.matches.join(", ")}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Flagged messages</h3>
          {(data?.flaggedMessages?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No flagged messages.</p>}
          {(data?.flaggedMessages ?? []).slice(0, 50).map((msg: any) => (
            <div key={msg.id} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{msg.sender?.full_name ?? "Unknown"} · {new Date(msg.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
              <p className="text-sm text-foreground mt-1">{msg.content || "(empty message)"}</p>
              {msg.task?.title && <p className="text-xs text-muted-foreground mt-1">Task: {msg.task.title}</p>}
              <p className="text-xs text-warning mt-1">Matched: {msg.matches.join(", ")}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
