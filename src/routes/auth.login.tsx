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
    nav({ to: (redirect as any) ?? "/app" });
  }

  return (
    <div className="min-h-screen bg-[#eff8ea] [font-family:'Inter',sans-serif]">
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
        <section className="relative overflow-hidden bg-[linear-gradient(160deg,#0d2818_0%,#1a3a2a_60%,#2d5a3d_100%)] px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(61,203,108,0.12)_0%,transparent_50%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(181,119,26,0.06)_0%,transparent_40%)]" />

          <div className="relative z-10 flex h-full flex-col justify-center">
            <Link to="/" className="mb-12 flex w-fit items-center gap-2.5 no-underline">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#3dcb6c] text-base text-white">✦</span>
              <span className="[font-family:'Space_Grotesk',sans-serif] text-[1.3rem] font-bold text-white">InTask</span>
            </Link>

            <div>
              <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[2.2rem] leading-[1.1] font-bold tracking-[-0.03em] text-white md:text-[2.8rem]">
                Get paid for your <span className="text-[#3dcb6c]">skills.</span>
              </h1>
              <p className="mt-5 max-w-[400px] text-[1.05rem] leading-[1.6] text-white/60">
                Join thousands of Nigerian students earning money through verified tasks - from web design to research to content writing.
              </p>
            </div>

            <div className="mt-12 flex gap-12">
              <div>
                <p className="[font-family:'Space_Grotesk',sans-serif] text-[1.8rem] font-bold text-[#3dcb6c]">2,400+</p>
                <p className="mt-0.5 text-[0.8rem] text-white/45">Students verified</p>
              </div>
              <div>
                <p className="[font-family:'Space_Grotesk',sans-serif] text-[1.8rem] font-bold text-[#3dcb6c]">₦12M+</p>
                <p className="mt-0.5 text-[0.8rem] text-white/45">Paid out securely</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center bg-white px-8 py-12 md:px-14 md:py-16 lg:px-20 lg:py-[60px]">
          <div className="mb-9">
            <h2 className="[font-family:'Space_Grotesk',sans-serif] text-[1.8rem] font-bold tracking-[-0.02em] text-[#1a1e16]">
              Welcome back
            </h2>
            <p className="mt-1.5 text-[0.9rem] text-[#6a8064]">Log in to continue working on InTask.</p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="mb-5">
              <label htmlFor="email" className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">
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
                className="h-11 w-full rounded-[10px] border border-[#c4deb8] bg-[#f9fdf7] px-[14px] text-[0.9rem] text-[#1a1e16] outline-none transition-colors duration-150 placeholder:text-[#9eb79c] focus:border-[#3dcb6c] focus:ring-[3px] focus:ring-[rgba(61,203,108,0.1)]"
              />
            </div>

            <div className="mb-5">
              <label htmlFor="password" className="mb-1.5 block text-[0.8rem] font-semibold text-[#1a1e16]">
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
                className="h-11 w-full rounded-[10px] border border-[#c4deb8] bg-[#f9fdf7] px-[14px] text-[0.9rem] text-[#1a1e16] outline-none transition-colors duration-150 placeholder:text-[#9eb79c] focus:border-[#3dcb6c] focus:ring-[3px] focus:ring-[rgba(61,203,108,0.1)]"
              />
            </div>

            <div className="mb-5 mt-[-8px] flex items-center justify-between">
              <span />
              <Link to="/auth/forgot-password" className="text-[0.75rem] font-semibold text-[#3dcb6c] no-underline hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-[10px] border-0 bg-[#3dcb6c] text-[0.95rem] font-semibold text-white transition-colors duration-150 hover:bg-[#35b860] disabled:cursor-not-allowed disabled:bg-[#c4deb8]"
            >
              {loading ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#e4efe0]" />
            <span className="text-[0.75rem] text-[#9eb79c]">or continue with</span>
            <div className="h-px flex-1 bg-[#e4efe0]" />
          </div>

          <Button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-2.5 rounded-[10px] border border-[#c4deb8] bg-white text-[0.85rem] font-medium text-[#1a1e16] transition-colors duration-150 hover:bg-[#f4fbf0]"
          >
            <span className="text-[1.1rem]">G</span>
            Continue with Google
          </Button>

          <p className="mt-7 text-center text-[0.85rem] text-[#6a8064]">
            New here?{" "}
            <Link to="/auth/signup" className="font-semibold text-[#3dcb6c] no-underline">
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
