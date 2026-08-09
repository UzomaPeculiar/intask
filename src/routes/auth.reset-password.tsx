import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — InTask" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  async function ensureRecoverySession() {
    const normalizeToken = (value: string | null) => (value ? value.replace(/ /g, "+") : null);

    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const hashParams = new URLSearchParams(hash);
    const queryParams = new URLSearchParams(window.location.search);
    const accessToken = normalizeToken(hashParams.get("access_token") ?? queryParams.get("access_token"));
    const refreshToken = normalizeToken(hashParams.get("refresh_token") ?? queryParams.get("refresh_token"));

    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (!error && data.session) return true;
    }

    const code = normalizeToken(queryParams.get("code"));
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.session) return true;
    }

    const tokenHash = normalizeToken(queryParams.get("token_hash"));
    const type = queryParams.get("type");
    if (tokenHash && (!type || type === "recovery")) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (!error && data.session) return true;
    }

    const { data } = await supabase.auth.getSession();
    return !!data.session;
  }

  useEffect(() => {
    let mounted = true;

    const hydrateRecoverySession = async () => {
      const hasSession = await ensureRecoverySession();
      if (!mounted) return;
      setReady(hasSession);
    };

    void hydrateRecoverySession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || !!session) {
        setReady(true);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    const hasSession = await ensureRecoverySession();
    setReady(hasSession);
    if (!hasSession) {
      toast.error("Auth session missing. Open the reset link from your email again.");
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated. You can now sign in.");
    await supabase.auth.signOut();
    nav({ to: "/auth/login" });
  }

  return (
    <div className="min-h-screen bg-[#eff8ea] text-[#1a1e16] [font-family:'Inter',sans-serif]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#0d2818_0%,#1a3a2a_60%,#2d5a3d_100%)] px-16 py-20 md:flex md:flex-col md:justify-center lg:px-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(61,203,108,0.12)_0%,transparent_50%)]" />

          <Link to="/" className="relative z-10 mb-12 inline-flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-[10px] bg-[#3dcb6c] text-white">
              <Sparkles className="size-4" />
            </span>
            <span className="font-['Space_Grotesk',sans-serif] text-[1.3rem] font-bold text-white">InTask</span>
          </Link>

          <div className="relative z-10">
            <h1 className="font-['Space_Grotesk',sans-serif] text-[2.4rem] font-bold leading-[1.1] tracking-[-0.03em] text-white">
              Set a new <span className="text-[#3dcb6c]">password.</span>
            </h1>
            <p className="mt-5 max-w-[380px] text-[1rem] leading-[1.6] text-white/60">
              Choose a strong password for your account. Make it something memorable but secure.
            </p>
          </div>
        </section>

        <section className="flex min-h-screen flex-col justify-center bg-white px-6 py-10 sm:px-10 md:px-16 lg:px-20">
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-7">
              <h2 className="font-['Space_Grotesk',sans-serif] text-[1.6rem] font-bold tracking-[-0.02em] text-[#1a1e16]">Set a new password</h2>
              <p className="mt-1.5 text-[0.85rem] text-[#6a8064]">
                {ready
                  ? "Choose a strong password for your account."
                  : "Open the password reset link from your email first, then return to this page."}
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4.5">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[0.8rem] font-semibold text-[#1a1e16]">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="h-11 rounded-[10px] border-[1.5px] border-[#c4deb8] bg-[#f9fdf7] px-3.5 text-[0.9rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]/20"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-[0.8rem] font-semibold text-[#1a1e16]">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="h-11 rounded-[10px] border-[1.5px] border-[#c4deb8] bg-[#f9fdf7] px-3.5 text-[0.9rem] text-[#1a1e16] placeholder:text-[#9eb79c] focus-visible:ring-[#3dcb6c]/20"
                />
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-[10px] bg-[#3dcb6c] text-[0.95rem] font-semibold text-white hover:bg-[#34b35d] disabled:bg-[#c4deb8]"
                disabled={busy}
              >
                {busy ? "Updating..." : "Update password"}
              </Button>
            </form>

            <p className="mt-6 text-center text-[0.85rem] text-[#6a8064]">
              Password updated?{" "}
              <Link to="/auth/login" className="font-semibold text-[#3dcb6c] hover:underline">
                Go to login
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
