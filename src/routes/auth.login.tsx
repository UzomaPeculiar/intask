import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/login")({
  head: () => ({ meta: [{ title: "Log in — InTask" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: (search.redirect as string) ?? undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");

    // Route based on profile role: students/alumni → browse, others → talent.
    try {
      const { data: me } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", me.user?.id ?? "")
        .maybeSingle();

      // If there's an explicit redirect, honor it — this covers /admin and
      // other deep links the user was trying to reach.
      if (redirect) {
        nav({ to: redirect as any });
        return;
      }

      const role = profile?.role;
      const isPoster = role === "company" || role === "individual";

      if (isPoster) {
        nav({ to: "/app/talent" });
      } else {
        nav({ to: "/app" });
      }
    } catch {
      nav({ to: "/app" });
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] [font-family:'Inter',sans-serif]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,#0d2818_0%,#1a3a2a_60%,#2d5a3d_100%)] px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(22,163,74,0.12)_0%,transparent_50%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(181,119,26,0.06)_0%,transparent_40%)]" />

          <div className="relative z-10 flex h-full flex-col justify-center">
            <Link to="/" className="mb-12 flex w-fit items-center gap-2.5 no-underline">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#16A34A] text-base text-white">✦</span>
              <span className="[font-family:'Space_Grotesk',sans-serif] text-[1.3rem] font-bold text-white">InTask</span>
            </Link>

            <div>
              <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[2.2rem] leading-[1.1] font-bold tracking-[-0.03em] text-white md:text-[2.8rem]">
                Get paid for your <span className="text-[#16A34A]">skills.</span>
              </h1>
              <p className="mt-5 max-w-[400px] text-[1.05rem] leading-[1.6] text-white/60">
                Join thousands of Nigerian students earning money through verified tasks - from web design to research to content writing.
              </p>
            </div>

            <div className="mt-12">
              <p className="text-[0.85rem] text-white/50">Verified students. Secure escrow payments. Fair outcomes for both sides.</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center bg-white px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-[60px]">
          <div className="mb-9">
            <h2 className="[font-family:'Space_Grotesk',sans-serif] text-[1.8rem] font-bold tracking-[-0.02em] text-[#1E293B]">
              Welcome back
            </h2>
            <p className="mt-1.5 text-[0.9rem] text-[#6B7280]">Log in to continue working on InTask.</p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="mb-5">
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
                className="h-11 w-full rounded-[10px] border border-[#E2E8F0] bg-[#FFFFFF] px-[14px] text-[0.9rem] text-[#1E293B] outline-none transition-colors duration-150 placeholder:text-[#94A3B8] focus:border-[#16A34A] focus:ring-[3px] focus:ring-[rgba(22,163,74,0.1)]"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="password" className="mb-1.5 block text-[0.8rem] font-semibold text-[#1E293B]">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="h-11 w-full rounded-[10px] border border-[#E2E8F0] bg-[#FFFFFF] px-[14px] text-[0.9rem] text-[#1E293B] outline-none transition-colors duration-150 placeholder:text-[#94A3B8] focus:border-[#16A34A] focus:ring-[3px] focus:ring-[rgba(22,163,74,0.1)]"
              />
            </div>

            <div className="mb-5 mt-[-8px] flex items-center justify-between">
              <span />
              <Link to="/auth/forgot-password" className="text-[0.75rem] font-semibold text-[#16A34A] no-underline hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-[10px] border-0 bg-[#16A34A] text-[0.95rem] font-semibold text-white transition-colors duration-150 hover:bg-[#15803D] disabled:cursor-not-allowed disabled:bg-[#E2E8F0]"
            >
              {loading ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E2E8F0]" />
            <span className="text-[0.75rem] text-[#94A3B8]">or continue with</span>
            <div className="h-px flex-1 bg-[#E2E8F0]" />
          </div>

          <Button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-[#E2E8F0] bg-white text-[0.85rem] font-medium text-[#1E293B] transition-colors duration-150 hover:bg-[#F1F3F5]"
          >
            <span className="text-[1.1rem]">G</span>
            Continue with Google
          </Button>

          <p className="mt-7 text-center text-[0.85rem] text-[#6B7280]">
            New here?{" "}
            <Link to="/auth/signup" search={{ ref: "" }} className="font-semibold text-[#16A34A] no-underline">
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
