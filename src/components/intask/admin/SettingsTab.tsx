import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { History, Mail, SlidersHorizontal } from "lucide-react";
import { adminPublishAnnouncement, adminSavePlatformSetting, adminSeedDefaultSettings, getAdminSettingsData } from "@/lib/admin.functions";

export function SettingsTab() {
  const qc = useQueryClient();
  const loadSettingsData = useServerFn(getAdminSettingsData);
  const saveSettingServer = useServerFn(adminSavePlatformSetting);
  const seedDefaultsServer = useServerFn(adminSeedDefaultSettings);
  const publishAnnouncementServer = useServerFn(adminPublishAnnouncement);
  const [actionFilter, setActionFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState<"all" | "settings" | "user" | "task" | "dispute" | "announcement">("all");
  const [periodFilter, setPeriodFilter] = useState<"all" | "7d" | "30d" | "90d">("30d");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [announcementRole, setAnnouncementRole] = useState<"all" | "student" | "alumni" | "company" | "individual">("all");

  const numericSettingRules: Record<string, { min: number; max: number; label: string }> = {
    platform_fee_percent: { min: 0, max: 30, label: "Platform fee (%)" },
    min_withdrawal_amount: { min: 100, max: 1000000, label: "Minimum withdrawal (NGN)" },
    processing_fee_amount: { min: 0, max: 100000, label: "Withdrawal processing fee (NGN)" },
    min_task_budget: { min: 500, max: 10000000, label: "Minimum task budget (NGN)" },
  };

  const defaultSettingsSeed = [
    { key: "platform_fee_percent", value: 8, description: "Platform fee percentage charged on each completed task" },
    { key: "min_withdrawal_amount", value: 550, description: "Minimum withdrawal amount in Naira" },
    { key: "processing_fee_amount", value: 50, description: "Flat fee charged on each withdrawal in Naira" },
    { key: "maintenance_mode", value: false, description: "When true, non-admin users see a maintenance page" },
    { key: "min_task_budget", value: 1000, description: "Minimum task budget in Naira" },
  ];

  function isEqualValue(a: any, b: any) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function buildRiskNotice(key: string, newValue: any, currentValue: any) {
    if (key === "maintenance_mode" && newValue === true && currentValue !== true) {
      return "Enabling maintenance mode can temporarily block user workflows.";
    }
    if (key === "platform_fee_percent" && !isEqualValue(newValue, currentValue)) {
      return "Changing platform fee affects all future earnings and payout calculations.";
    }
    if (key === "min_withdrawal_amount" && !isEqualValue(newValue, currentValue)) {
      return "Changing minimum withdrawal directly affects cashout eligibility.";
    }
    if (key === "processing_fee_amount" && !isEqualValue(newValue, currentValue)) {
      return "Changing withdrawal processing fee affects net payout users receive on future cashouts.";
    }
    if (key === "min_task_budget" && !isEqualValue(newValue, currentValue)) {
      return "Changing minimum task budget affects future task posting validation.";
    }
    return null;
  }

  const { data, isLoading, error, refetch } = useQuery<{
    settings: any[];
    logs: any[];
    announcements: any[];
  }>({
    queryKey: ["admin-settings-audit", periodFilter],
    refetchInterval: 30000,
    queryFn: async () => {
      const result = await loadSettingsData();
      const allLogs = result.logs ?? [];
      const days = periodFilter === "7d" ? 7 : periodFilter === "30d" ? 30 : periodFilter === "90d" ? 90 : null;
      const logs = days == null
        ? allLogs
        : allLogs.filter((log: any) => Date.now() - new Date(log.created_at).getTime() <= days * 24 * 60 * 60 * 1000);
      return {
        settings: result.settings ?? [],
        logs,
        announcements: result.announcements ?? [],
      };
    },
  });

  const publishAnnouncement = useMutation({
    mutationFn: async () => {
      await publishAnnouncementServer({
        data: {
          title: announcementTitle,
          body: announcementBody,
          targetRole: announcementRole,
        },
      });
    },
    onSuccess: () => {
      toast.success("Announcement published");
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setAnnouncementRole("all");
      refetch();
    },
    onError: (e: any) => toast.error(e.message ?? "Could not publish announcement"),
  });

  const initializeDefaults = useMutation({
    mutationFn: async () => {
      await seedDefaultsServer({ data: { rows: defaultSettingsSeed } });
    },
    onSuccess: () => {
      toast.success("Default platform settings initialized");
      refetch();
    },
    onError: (e: any) => {
      const message = String(e?.message ?? "");
      if (message.toLowerCase().includes("permission denied")) {
        toast.error("Permission denied while seeding defaults. Apply latest Supabase migrations and try again.");
        return;
      }
      toast.error(e.message ?? "Could not initialize defaults");
    },
  });

  const saveSetting = useMutation({
    mutationFn: async ({ key, currentValue }: { key: string; currentValue: any }) => {
      const raw = (drafts[key] ?? "").trim();
      if (!raw) throw new Error("Value cannot be empty");

      let parsed: any = raw;
      if (key === "maintenance_mode") {
        if (raw !== "true" && raw !== "false") throw new Error("Maintenance mode must be true or false");
        parsed = raw === "true";
      } else if (numericSettingRules[key]) {
        const n = Number(raw);
        if (!Number.isFinite(n)) throw new Error(`${numericSettingRules[key].label} must be a number`);
        if (n < numericSettingRules[key].min || n > numericSettingRules[key].max) {
          throw new Error(`${numericSettingRules[key].label} must be between ${numericSettingRules[key].min} and ${numericSettingRules[key].max}`);
        }
        parsed = Math.round(n);
      } else if (raw === "true") {
        parsed = true;
      } else if (raw === "false") {
        parsed = false;
      } else if (!Number.isNaN(Number(raw)) && raw !== "") {
        parsed = Number(raw);
      } else {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
      }

      if (isEqualValue(parsed, currentValue)) {
        throw new Error("No change detected");
      }

      const riskNotice = buildRiskNotice(key, parsed, currentValue);
      let reason = "";
      if (riskNotice) {
        const confirmed = window.confirm(`${riskNotice}\n\nDo you want to continue?`);
        if (!confirmed) throw new Error("Change cancelled");

        reason = window.prompt("Provide reason for this high-risk settings change (min 8 chars):") ?? "";
        if (reason.trim().length < 8) {
          throw new Error("Reason must be at least 8 characters for this change");
        }
      }

      await saveSettingServer({
        data: {
          key,
          value: parsed,
          oldValue: currentValue,
          reason: reason.trim() || undefined,
          highRisk: !!riskNotice,
        },
      });
    },
    onSuccess: () => {
      toast.success("Setting updated");
      refetch();
      qc.invalidateQueries({ queryKey: ["admin-command-center"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update setting"),
  });

  const filteredLogs = useMemo(() => {
    const rows = data?.logs ?? [];
    return rows.filter((row: any) => {
      if (targetFilter !== "all" && row.target_type !== targetFilter) return false;
      const q = actionFilter.trim().toLowerCase();
      if (!q) return true;
      const text = `${row.action ?? ""} ${row.target_type ?? ""} ${row.target_id ?? ""} ${row.admin?.full_name ?? ""} ${row.admin?.email ?? ""}`.toLowerCase();
      return text.includes(q);
    });
  }, [data?.logs, targetFilter, actionFilter]);

  function exportAuditCsv() {
    if (filteredLogs.length === 0) {
      toast.error("No audit rows to export");
      return;
    }

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const headers = ["created_at", "action", "target_type", "target_id", "admin_name", "admin_email", "details_json"];
    const rows = filteredLogs.map((log: any) => [
      new Date(log.created_at).toISOString(),
      log.action ?? "",
      log.target_type ?? "",
      log.target_id ?? "",
      log.admin?.full_name ?? "",
      log.admin?.email ?? "",
      JSON.stringify(log.details ?? {}),
    ]);

    const csv = [headers, ...rows]
      .map((cols) => cols.map((col) => escapeCsv(String(col))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Audit CSV exported");
  }

  function stringifyValue(value: any) {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  function draftValueFor(setting: any) {
    return drafts[setting.key] ?? stringifyValue(setting.value);
  }

  function isKnownNumericKey(key: string) {
    return !!numericSettingRules[key];
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Settings and Audit Center</h2>
            <p className="text-xs text-muted-foreground">Manage platform-wide controls and review a timestamped admin action trail.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Platform settings</h3>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading settings...</p>}

        {!isLoading && error && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">Could not load platform settings</p>
            <p className="text-xs text-muted-foreground mt-1">{String((error as any)?.message ?? "Unknown error")}</p>
          </div>
        )}

        {!isLoading && !error && (data?.settings ?? []).length === 0 && (
          <div className="mb-3 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium text-foreground">No settings found yet</p>
            <p className="text-xs text-muted-foreground mt-1">Initialize default platform settings to enable this section.</p>
            <div className="mt-2">
              <Button size="sm" variant="outline" onClick={() => initializeDefaults.mutate()} disabled={initializeDefaults.isPending}>
                {initializeDefaults.isPending ? "Initializing..." : "Initialize defaults"}
              </Button>
            </div>
          </div>
        )}

        {!isLoading && (
          <div className="space-y-3">
            {(data?.settings ?? []).map((setting: any) => (
              <div key={setting.key} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{setting.key}</p>
                    {setting.description && <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">Updated: {setting.updated_at ? new Date(setting.updated_at).toLocaleString("en-NG") : "-"}</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  {setting.key === "maintenance_mode" ? (
                    <label className="flex w-full items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draftValueFor(setting) === "true"}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [setting.key]: e.target.checked ? "true" : "false",
                          }))
                        }
                      />
                      <span>Enable maintenance mode</span>
                    </label>
                  ) : isKnownNumericKey(setting.key) ? (
                    <input
                      type="number"
                      min={numericSettingRules[setting.key].min}
                      max={numericSettingRules[setting.key].max}
                      step="1"
                      value={draftValueFor(setting)}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  ) : (
                    <input
                      value={draftValueFor(setting)}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [setting.key]: e.target.value }))}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  )}
                  <Button
                    size="sm"
                    onClick={() => saveSetting.mutate({ key: setting.key, currentValue: setting.value })}
                    disabled={saveSetting.isPending || draftValueFor(setting) === stringifyValue(setting.value)}
                  >
                    {saveSetting.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
                {isKnownNumericKey(setting.key) && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Allowed range: {numericSettingRules[setting.key].min} to {numericSettingRules[setting.key].max}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Mail className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Announcement controls</h3>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <input
            value={announcementTitle}
            onChange={(e) => setAnnouncementTitle(e.target.value)}
            placeholder="Announcement title"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <textarea
            rows={3}
            value={announcementBody}
            onChange={(e) => setAnnouncementBody(e.target.value)}
            placeholder="Announcement body"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={announcementRole}
              onChange={(e) => setAnnouncementRole(e.target.value as any)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="all">All users</option>
              <option value="student">Students</option>
              <option value="alumni">Alumni</option>
              <option value="company">Companies</option>
              <option value="individual">Individuals</option>
            </select>
            <Button onClick={() => publishAnnouncement.mutate()} disabled={publishAnnouncement.isPending}>
              {publishAnnouncement.isPending ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent announcements</p>
          {(data?.announcements ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No announcements yet.</p>
          )}
          {(data?.announcements ?? []).map((ann: any) => (
            <div key={ann.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{ann.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Target: {ann.target_role ?? "all"} · {ann.is_active ? "active" : "inactive"}</p>
                  <p className="mt-1 text-sm text-foreground">{ann.body}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(ann.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Audit trail</h3>
        </div>

        <div className="mb-3">
          <Button variant="outline" size="sm" onClick={exportAuditCsv}>
            Export filtered CSV
          </Button>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Filter by action, target, admin"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value as any)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All targets</option>
            <option value="settings">Settings</option>
            <option value="user">Users</option>
            <option value="task">Tasks</option>
            <option value="dispute">Disputes</option>
            <option value="announcement">Announcements</option>
          </select>

          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        <div className="max-h-[460px] space-y-2 overflow-auto pr-1">
          {filteredLogs.length === 0 && <p className="text-sm text-muted-foreground">No audit events match this filter.</p>}
          {filteredLogs.map((log: any) => (
            <div key={log.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{log.action}</p>
                  <p className="text-xs text-muted-foreground">{log.target_type}{log.target_id ? ` · ${log.target_id}` : ""}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">By {log.admin?.full_name ?? "Unknown"}{log.admin?.email ? ` (${log.admin.email})` : ""}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("en-NG")}</p>
              </div>
              <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-muted/50 p-2 text-[11px] text-foreground">{JSON.stringify(log.details ?? {}, null, 2)}</pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
