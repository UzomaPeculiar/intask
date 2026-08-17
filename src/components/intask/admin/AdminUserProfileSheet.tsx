import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAdminUserWalletData } from "@/lib/admin.functions";

export function AdminUserProfileSheet({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const loadAdminUserWalletData = useServerFn(getAdminUserWalletData);

  const { data, isLoading } = useQuery<any | null>({
    queryKey: ["admin-user-profile", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) return null;

      const { data: profile } = await (supabase as any)
        .from("admin_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (!profile) return null;

      const [studentRes, companyRes, individualRes] = await Promise.all([
        profile.role === "student" || profile.role === "alumni"
          ? (supabase as any).from("admin_student_profiles").select("*").eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        profile.role === "company"
          ? (supabase as any).from("admin_company_profiles").select("*").eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
        profile.role === "individual"
          ? (supabase as any).from("admin_individual_profiles").select("*").eq("user_id", userId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      return {
        profile,
        student: studentRes.data,
        company: companyRes.data,
        individual: individualRes.data,
      };
    },
  });

  const {
    data: adminWalletData,
    isLoading: isLoadingAdminWallet,
    error: adminWalletError,
  } = useQuery<{ wallet: any; walletTransactions: any[] } | null>({
    queryKey: ["admin-user-wallet", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      if (!userId) return null;
      return await loadAdminUserWalletData({ data: { userId } });
    },
  });

  const setAccountStatus = useMutation({
    mutationFn: async ({ status, reason }: { status: "active" | "suspended" | "banned"; reason?: string }) => {
      if (!userId) throw new Error("No user selected");
      const { data: auth } = await supabase.auth.getUser();
      const meId = auth.user?.id;
      if (!meId) throw new Error("Could not identify current admin");
      if (meId === userId) throw new Error("You cannot change your own status here");

      const patch =
        status === "active"
          ? { account_status: "active", account_status_reason: null, suspended_at: null }
          : { account_status: status, account_status_reason: reason ?? null, suspended_at: new Date().toISOString() };

      const { error } = await (supabase as any).from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account status updated");
      qc.invalidateQueries({ queryKey: ["admin-user-profile", userId] });
      qc.invalidateQueries({ queryKey: ["admin-users-management"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update account status"),
  });

  const profile = data?.profile;
  const student = data?.student;
  const company = data?.company;
  const individual = data?.individual;
  const wallet = adminWalletData?.wallet ?? null;
  const walletTransactions = adminWalletData?.walletTransactions ?? [];

  function statusAction(next: "active" | "suspended" | "banned") {
    if (next === "active") {
      setAccountStatus.mutate({ status: "active" });
      return;
    }
    const reason = window.prompt(`Reason for ${next === "banned" ? "banning" : "suspending"} this user:`) ?? "";
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }
    setAccountStatus.mutate({ status: next, reason: reason.trim() });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[85vh] overflow-y-auto rounded-t-2xl" : "w-[400px] sm:w-[540px] overflow-y-auto"}>
        <SheetHeader className="space-y-1">
          <SheetTitle>User Profile</SheetTitle>
          <SheetDescription>Full details for verification review</SheetDescription>
        </SheetHeader>

        {isLoading && <p className="py-8 text-sm text-muted-foreground">Loading user...</p>}
        {!isLoading && !profile && <p className="py-8 text-sm text-muted-foreground">User not found.</p>}

        {profile && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <InitialsAvatar name={profile.full_name} size={56} avatarUrl={profile.avatar_url} />
              <div>
                <p className="font-semibold text-foreground">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
                <VerifiedBadge role={profile.role} verified={profile.role === "company" ? company?.verified : profile.role === "individual" ? individual?.verified : student?.verified} />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Status: <span className="font-medium text-foreground">{profile.account_status ?? "active"}</span></p>
              <div className="mt-2 flex gap-2">
                {(profile.account_status ?? "active") === "active" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => statusAction("suspended")}>Suspend</Button>
                    <Button size="sm" variant="outline" className="border-destructive/40 text-destructive" onClick={() => statusAction("banned")}>Ban</Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => statusAction("active")}>Reactivate</Button>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Summary</h3>
              {isLoadingAdminWallet ? <p className="mt-2 text-sm text-muted-foreground">Loading wallet summary...</p> : null}
              {adminWalletError ? (
                <p className="mt-2 text-sm text-destructive">Wallet fetch error: {String((adminWalletError as any)?.message ?? "unknown")}</p>
              ) : null}
              {!isLoadingAdminWallet && !adminWalletError && wallet ? (
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="font-semibold text-foreground">₦{Number(wallet.balance ?? 0).toLocaleString("en-NG")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Earned</p>
                    <p className="font-semibold text-foreground">₦{Number(wallet.total_earned ?? 0).toLocaleString("en-NG")}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Withdrawn</p>
                    <p className="font-semibold text-foreground">₦{Number(wallet.total_withdrawn ?? 0).toLocaleString("en-NG")}</p>
                  </div>
                </div>
              ) : null}
              {!isLoadingAdminWallet && !adminWalletError && !wallet ? <p className="mt-2 text-sm text-muted-foreground">No wallet record found.</p> : null}
            </div>

            {walletTransactions.length > 0 ? (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wallet Transactions</h3>
                <div className="mt-2 space-y-2">
                  {walletTransactions.map((tx: any) => (
                    <div key={tx.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-foreground">{tx.description || tx.transaction_type}</span>
                      <span className={tx.transaction_type === "credit" ? "text-success" : "text-foreground"}>
                        {tx.transaction_type === "credit" ? "+" : "-"}₦{Number(tx.amount).toLocaleString("en-NG")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
