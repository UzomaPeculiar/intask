import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/forgot-password")({
  head: () => ({ meta: [{ title: "Reset password — InTask" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const redirectTo = `${window.location.origin}/auth/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Reset link sent. Check your email inbox.");
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] [font-family:'Inter',sans-serif]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,#0d2818_0%,#1a3a2a_60%,#2d5a3d_100%)] px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(22,163,74,0.12)_0%,transparent_50%)]" />

          <div className="relative z-10 flex h-full flex-col justify-center">
            <Link to="/" className="mb-10 flex w-fit items-center gap-2.5 no-underline md:mb-12">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#16A34A] text-base text-white">✦</span>
              <span className="[font-family:'Space_Grotesk',sans-serif] text-[1.3rem] font-bold text-white">InTask</span>
            </Link>

            <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[2.1rem] leading-[1.1] font-bold tracking-[-0.03em] text-white md:text-[2.4rem]">
              Forgot your <span className="text-[#16A34A]">password?</span>
            </h1>
            <p className="mt-5 max-w-[380px] text-base leading-[1.6] text-white/60">
              No worries - we&apos;ll send you a reset link to get you back into your account.
            </p>
          </div>
        </section>

        <section className="flex flex-col justify-center bg-white px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-[60px]">
          <div className="mb-7">
            <h2 className="[font-family:'Space_Grotesk',sans-serif] text-[1.6rem] font-bold tracking-[-0.02em] text-[#1E293B]">
              Reset your password
            </h2>
            <p className="mt-1.5 text-[0.85rem] text-[#6B7280]">
              Enter your account email and we&apos;ll send you a reset link.
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="mb-[18px]">
              <label htmlFor="email" className="mb-1.5 block text-[0.8rem] font-semibold text-[#1E293B]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 w-full rounded-[10px] border border-[#E2E8F0] bg-[#FFFFFF] px-[14px] text-[0.9rem] text-[#1E293B] outline-none transition-shadow duration-150 placeholder:text-[#94A3B8] focus:border-[#16A34A] focus:ring-[3px] focus:ring-[rgba(22,163,74,0.1)]"
              />
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="h-12 w-full rounded-[10px] bg-[#16A34A] text-[0.95rem] font-semibold text-white hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-[#E2E8F0]"
            >
              {busy ? "Sending..." : "Send reset link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[0.85rem] text-[#6B7280]">
            Remember your password?{" "}
            <Link to="/auth/login" className="font-semibold text-[#16A34A] no-underline">
              Back to login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
