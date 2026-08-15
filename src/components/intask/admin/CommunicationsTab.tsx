import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

export function CommunicationsTab() {
  const [directUserId, setDirectUserId] = useState("");
  const [directSubject, setDirectSubject] = useState("");
  const [directBody, setDirectBody] = useState("");
  const [sendAsEmail, setSendAsEmail] = useState(true);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-communications"],
    refetchInterval: 30000,
    queryFn: async () => {
      const [profilesRes, notificationsRes] = await Promise.all([
        (supabase as any)
          .from("admin_profiles")
          .select("id, full_name, email, role")
          .order("created_at", { ascending: false })
          .limit(1000),
        (supabase as any)
          .from("notifications")
          .select("id, user_id, type, message, read, created_at, user:admin_profiles!notifications_user_id_fkey(full_name, email, role)")
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (notificationsRes.error) throw notificationsRes.error;

      return {
        profiles: profilesRes.data ?? [],
        notifications: notificationsRes.data ?? [],
      };
    },
  });

  const sendDirect = useMutation({
    mutationFn: async () => {
      const selectedUserId = directUserId.trim();
      if (!selectedUserId) throw new Error("Select a user");
      if (!directSubject.trim()) throw new Error("Subject is required");
      if (!directBody.trim() || directBody.trim().length < 4) throw new Error("Message is too short");

      const recipient = (data?.profiles ?? []).find((p: any) => p.id === selectedUserId);
      if (!recipient) throw new Error("Select a valid user ID from suggestions");

      const { data: auth } = await supabase.auth.getUser();
      const adminId = auth.user?.id;
      if (!adminId) throw new Error("Could not determine admin account");

      const { error: notifErr } = await (supabase as any).from("notifications").insert({
        user_id: selectedUserId,
        type: sendAsEmail ? "admin_direct_email" : "admin_direct_message",
        message: `${directSubject.trim()}: ${directBody.trim()}`,
        link: "/app/notifications",
      });
      if (notifErr) throw notifErr;

      await (supabase as any).from("audit_log").insert({
        admin_user_id: adminId,
        action: "communications.direct",
        target_type: "user",
        target_id: selectedUserId,
        details: {
          subject: directSubject.trim(),
          channel: sendAsEmail ? "email+inapp" : "inapp",
        },
      });
    },
    onSuccess: () => {
      toast.success(sendAsEmail ? "Message sent. Email delivery depends on configured provider." : "Direct message sent");
      setDirectSubject("");
      setDirectBody("");
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not send direct message"),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Communications</h2>
            <p className="text-xs text-muted-foreground">Send direct user messages and inspect notification delivery logs. Persistent announcements are managed in Settings.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {!isLoading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Could not load communication data. Ensure admin has permission to read notifications.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Email a specific user</h3>
          <input
            list="admin-communication-users"
            value={directUserId}
            onChange={(e) => setDirectUserId(e.target.value)}
            placeholder="User ID (pick from suggestions)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <datalist id="admin-communication-users">
            {(data?.profiles ?? []).map((p: any) => (
              <option key={p.id} value={p.id}>{`${p.full_name ?? "Unknown"} - ${p.email ?? ""}`}</option>
            ))}
          </datalist>
          <input
            value={directSubject}
            onChange={(e) => setDirectSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            rows={4}
            value={directBody}
            onChange={(e) => setDirectBody(e.target.value)}
            placeholder="Message"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={sendAsEmail} onChange={(e) => setSendAsEmail(e.target.checked)} />
            Mark as email attempt (also delivered in-app)
          </label>
          <Button onClick={() => sendDirect.mutate()} disabled={sendDirect.isPending}>
            {sendDirect.isPending ? "Sending..." : "Send to user"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Notification log</h3>
        <p className="mt-1 text-xs text-muted-foreground">Latest system notifications per user for delivery/debug tracking.</p>

        <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
          {(data?.notifications ?? []).length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">No notification logs available.</p>
          )}
          {(data?.notifications ?? []).map((n: any) => (
            <div key={n.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{n.user?.full_name ?? "Unknown user"} · {n.type}</p>
                  <p className="text-xs text-muted-foreground">{n.user?.email ?? "-"} {n.user?.role ? `· ${n.user.role}` : ""}</p>
                  <p className="mt-1 text-sm text-foreground">{n.message}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("en-NG")}</p>
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${n.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>
                    {n.read ? "Read" : "Unread"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
