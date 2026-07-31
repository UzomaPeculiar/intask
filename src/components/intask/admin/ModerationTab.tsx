import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ModerationTab() {
  const [keywordsInput, setKeywordsInput] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-moderation"],
    refetchInterval: 60000,
    queryFn: async () => {
      const defaultWords = ["bitcoin", "crypto", "adult", "sex", "loan", "bet", "gamble", "scam"];
      const [tasksRes, messagesRes, convRes, settingsRes] = await Promise.all([
        (supabase as any)
          .from("tasks")
          .select("id, title, description, created_at, poster:profiles!tasks_poster_id_fkey(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any)
          .from("messages")
          .select("id, conversation_id, content, created_at, sender:profiles!messages_sender_id_fkey(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(500),
        (supabase as any).from("conversations").select("id, task_id"),
        (supabase as any).from("platform_settings").select("value").eq("key", "banned_words_rules").maybeSingle(),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (messagesRes.error) throw messagesRes.error;
      if (convRes.error) throw convRes.error;

      const rawSetting = settingsRes.data?.value;
      const words = Array.isArray(rawSetting)
        ? rawSetting.map((w: any) => String(w).toLowerCase().trim()).filter(Boolean)
        : defaultWords;

      const taskByConversation = new Map((convRes.data ?? []).map((c: any) => [c.id, c.task_id]));
      const taskMap = new Map((tasksRes.data ?? []).map((t: any) => [t.id, t]));

      const flaggedTasks = (tasksRes.data ?? [])
        .map((task: any) => {
          const combined = `${task.title ?? ""} ${task.description ?? ""}`.toLowerCase();
          const matches = words.filter((w: string) => combined.includes(w));
          return { ...task, matches };
        })
        .filter((task: any) => task.matches.length > 0);

      const flaggedMessages = (messagesRes.data ?? [])
        .map((msg: any) => {
          const combined = `${msg.content ?? ""}`.toLowerCase();
          const matches = words.filter((w: string) => combined.includes(w));
          const taskId = taskByConversation.get(msg.conversation_id);
          const task = taskId ? taskMap.get(taskId) : null;
          return { ...msg, matches, task };
        })
        .filter((msg: any) => msg.matches.length > 0);

      return {
        words,
        flaggedTasks,
        flaggedMessages,
      };
    },
  });

  useEffect(() => {
    if (data?.words?.length) {
      setKeywordsInput(data.words.join(", "));
    }
  }, [data?.words]);

  const saveWords = useMutation({
    mutationFn: async () => {
      const parsed = keywordsInput
        .split(",")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
      const unique = Array.from(new Set(parsed));
      if (unique.length === 0) throw new Error("Add at least one keyword");

      const { error } = await (supabase as any)
        .from("platform_settings")
        .upsert({
          key: "banned_words_rules",
          value: unique,
          description: "Keywords used for automatic moderation flagging",
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
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
            <p className="text-xs text-muted-foreground">Auto-flagged tasks and messages based on banned-word rules.</p>
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
