import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  Building,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  GraduationCap,
  Instagram,
  Linkedin,
  Bookmark,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Twitter,
  User,
  Users,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { naira } from "@/lib/format";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InTask — Get paid for your skills" },
      { name: "description", content: "InTask connects Nigerian students with real paid tasks — from web design to research to content writing. Verified students, escrow payments, ratings on every job." },
      { property: "og:title", content: "InTask — Get paid for your skills" },
      { property: "og:description", content: "Built for Nigerian students. Find work or hire verified students. Escrow payments via Paystack." },
    ],
  }),
  component: Landing,
});

const HOW_IT_WORKS = [
  { n: 1, title: "Create your profile", body: "Sign up as a student, alumni, or business. Verify your status and list your skills." },
  { n: 2, title: "Apply or post a task", body: "Students browse and apply for open tasks. Businesses post tasks and review applicants." },
  { n: 3, title: "Get paid safely", body: "Money is held in escrow via Paystack and released only when work is approved." },
];

const CATEGORIES = [
  "Web Design", "Content Writing", "UI/UX", "Research", "Video Editing",
  "Tutoring", "Business", "Data Analysis", "App Development", "Social Media",
  "Graphic Design", "Copywriting", "Python", "Virtual Assistant",
];

const TRUST = [
  { icon: ShieldCheck, title: "Verified students only", body: "Every student is checked with their school email or student ID before they can work." },
  { icon: CheckCircle2, title: "Secure escrow payments", body: "Funds are held safely via Paystack until you approve the delivered work." },
  { icon: Star, title: "Ratings on every job", body: "Both sides leave reviews after every task. Build a reputation that earns you more." },
];

const WHO_IS_IT_FOR = [
  {
    icon: GraduationCap,
    title: "Students",
    body: "Find paid tasks that match your skills. Build your portfolio and earn while you study.",
    cta: "Find work",
    color: "bg-primary/10 text-primary",
  },
  {
    icon: User,
    title: "Alumni",
    body: "Keep earning after graduation. Take on tasks, build your portfolio, and grow your network.",
    cta: "Join as alumni",
    color: "bg-warning/10 text-warning",
  },
  {
    icon: Building2,
    title: "Businesses",
    body: "Access affordable, verified student talent for short-term tasks and projects.",
    cta: "Post a task",
    color: "bg-success/10 text-success",
  },
];

const DESKTOP_CATEGORIES = [
  { icon: "💻", name: "Web Dev", count: "312 tasks" },
  { icon: "🎨", name: "Visual Arts", count: "224 tasks" },
  { icon: "📣", name: "Marketing", count: "189 tasks" },
  { icon: "🎵", name: "Music", count: "96 tasks" },
  { icon: "📈", name: "Business", count: "143 tasks" },
  { icon: "✍️", name: "Writing", count: "278 tasks" },
];

const DESKTOP_TASKS = [
  {
    category: "Video editing",
    title: "Edit a 10-minute YouTube video with transitions and captions",
    desc: "I have raw footage from a product launch event. Need clean cuts, text overlays, and background music added.",
    price: "₦18,000",
    mode: "fixed",
    poster: "Amaka M.",
    initials: "AM",
  },
  {
    category: "Graphic design",
    title: "Design a logo and brand kit for my new clothing line",
    desc: "Need a minimal, modern logo with full brand kit including colours, fonts, and social media templates.",
    price: "₦25,000",
    mode: "fixed",
    poster: "Kunle O.",
    initials: "KO",
  },
  {
    category: "Web development",
    title: "Build a simple e-commerce site for my handmade jewelry",
    desc: "Small catalog of about 30 items. Need product pages, cart, and WhatsApp checkout integration.",
    price: "₦45,000",
    mode: "negotiable",
    poster: "Chisom I.",
    initials: "CI",
  },
];

const DESKTOP_TESTIMONIALS = [
  {
    stars: "★★★★★",
    text: "I got my logo done in two days for a fraction of what agencies were quoting. The designer was a 300L student at OAU and she was brilliant.",
    name: "Fatima D.",
    subtitle: "Client · Abuja",
    initials: "FD",
    avatarClass: "bg-[#C8E4F0] text-[#1A5A8A]",
  },
  {
    stars: "★★★★★",
    text: "InTask is how I fund my education. I've made over ₦200,000 in three months just from weekend jobs. The escrow system means I always get paid.",
    name: "Emeka O.",
    subtitle: "Freelancer · UNILAG · 400L",
    initials: "EO",
    avatarClass: "bg-[#C8EED8] text-[#1A7A42]",
  },
  {
    stars: "★★★★☆",
    text: "We needed a research assistant for six weeks and found someone incredible through InTask. She's now a part-time staff member at our company.",
    name: "Blessing I.",
    subtitle: "Company · Lagos",
    initials: "BI",
    avatarClass: "bg-[#F0C8E4] text-[#8A1A5A]",
  },
];

function Landing() {
  return (
    <div>
      <div className="lg:hidden">
        <MobileLanding />
      </div>
      <div className="hidden lg:block">
        <DesktopLanding />
      </div>
    </div>
  );
}

function DesktopLanding() {
  const [showTrustExample, setShowTrustExample] = useState(false);

  return (
    <div className="min-h-screen bg-[#EFF8EA] text-[#1A1E16]">
      <header className="sticky top-0 z-30 h-16 border-b border-[#D4E8CC] bg-white">
        <div className="mx-auto flex h-full w-full max-w-[1360px] items-center justify-between px-12">
          <Link to="/" className="text-xl font-bold tracking-tight" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
            In<span className="text-[#3DCB6C]">Task</span>
          </Link>

          <nav className="flex items-center gap-7 text-sm font-medium text-[#4A5244]">
            <Link to="/app/browse" className="hover:text-[#1A1E16]">Browse tasks</Link>
            <a href="#how-it-works" className="hover:text-[#1A1E16]">How it works</a>
            <a href="#" className="hover:text-[#1A1E16]">Blog</a>
            <Link to="/contact" className="hover:text-[#1A1E16]">Contact us</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/auth/login">
              <Button variant="ghost">Log in</Button>
            </Link>
            <Link to="/auth/signup">
              <Button>Sign up free</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-[1200px] grid-cols-[1fr_420px] items-center gap-12 px-12 py-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D8F5E4] px-3 py-[5px] text-xs font-semibold text-[#1A7A42]">
            <span className="size-1.5 rounded-full bg-[#3DCB6C]" />
            Built for students
          </div>

          <h1 className="mb-5 text-[52px] font-bold leading-[1.1] text-[#111811]" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
            Get paid for your skills. <span className="text-[#3DCB6C]">No experience needed</span>
          </h1>

          <p className="mb-8 max-w-[480px] text-base leading-[1.7] text-[#4A5A44]">
            InTask connects university students with real paid tasks — web design, content writing, research, tutoring, and more. Safe payments. Verified talent.
          </p>

          <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#C4DEB8] bg-white p-1.5 pl-4">
            <Search className="size-4 text-[#6A8064]" />
            <input
              type="text"
              placeholder="Search for a skill or task (e.g. logo design, essay editing)"
              className="h-10 flex-1 bg-transparent text-sm text-[#1A1E16] outline-none"
            />
            <button className="rounded-lg bg-[#3DCB6C] px-5 py-2.5 text-sm font-semibold text-white">Search tasks</button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[13px] text-[#6A8064]">Popular:</span>
            {[
              "Video editing",
              "Web development",
              "Graphic design",
              "Copywriting",
            ].map((tag) => (
              <span key={tag} className="rounded-full border border-[#C4DEB8] bg-white px-3.5 py-[5px] text-[13px] text-[#3A5234]">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/auth/signup">
              <Button size="lg" className="gap-2">
                Find work <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="lg" variant="outline">Post a task</Button>
             </Link>
          </div>

          <p className="mt-3 text-xs text-[#6A8064]">Free to sign up · Payments secured by Paystack · Verified students only</p>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/15 via-accent to-success/10 blur-2xl" />
          <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_18px_48px_-24px_rgba(37,99,235,0.38)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Web Design · Remote</p>
                  <h3 className="mt-1 truncate text-base font-semibold text-foreground">Landing page for fashion brand</h3>
                </div>
                <span className="shrink-0 rounded-md bg-success/15 px-2 py-1 text-sm font-semibold text-success">{naira(35000)}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                Need a clean, mobile-first landing page with hero section, product showcase, and contact form. Figma mockup available.
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name="KE Styles" size={28} />
                  <div className="text-xs">
                    <div className="font-medium text-foreground">KE Styles</div>
                    <div className="text-muted-foreground">5 applicants</div>
                  </div>
                </div>
                <Link to="/auth/signup"><Button size="sm" variant="secondary">Apply</Button></Link>
              </div>
              <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3 text-success" /> Payment held safely until work is approved
              </p>
            </div>
          </div>
      </section>

      <section className="flex items-center justify-center gap-10 border-y border-[#D4E8CC] bg-white px-12 py-[18px]">
        <div className="flex items-center gap-2 text-[13px] text-[#4A5A44]"><ShieldCheck className="size-4 text-[#3DCB6C]" /> Escrow-protected payments</div>
        <div className="h-6 w-px bg-[#D4E8CC]" />
        <div className="flex items-center gap-2 text-[13px] text-[#4A5A44]"><Users className="size-4 text-[#3DCB6C]" /> Verified students and alumni</div>
        <div className="h-6 w-px bg-[#D4E8CC]" />
        <div className="flex items-center gap-2 text-[13px] text-[#4A5A44]"><Building className="size-4 text-[#3DCB6C]" /> 50+ Nigerian universities</div>
        <div className="h-6 w-px bg-[#D4E8CC]" />
        <div className="flex items-center gap-2 text-[13px] text-[#4A5A44]"><Clock3 className="size-4 text-[#3DCB6C]" /> Tasks completed in 24-72 hrs</div>
        <div className="h-6 w-px bg-[#D4E8CC]" />
        <div className="flex items-center gap-2 text-[13px] text-[#4A5A44]"><CreditCard className="size-4 text-[#3DCB6C]" /> Secure Paystack checkout</div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-12 py-8">
        <Collapsible open={showTrustExample} onOpenChange={setShowTrustExample}>
          <div className="rounded-2xl border border-[#D4E8CC] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[1px] text-[#6A8064]">Verification example</p>
              <CollapsibleTrigger asChild>
                <button className="text-xs font-semibold text-[#3DCB6C]">{showTrustExample ? "Hide" : "View"} details</button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
              <div className="mt-3 flex items-start gap-3">
                <InitialsAvatar name="Chiamaka Okafor" size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#1A1E16]">Chiamaka Okafor</p>
                    <VerifiedBadge role="student" />
                  </div>
                  <p className="text-xs text-[#6A8064]">UNILAG · 300L · Computer Science</p>
                  <div className="mt-2 flex items-center gap-1 text-xs text-[#6A8064]">
                    <Star className="size-3 fill-[#F5A623] text-[#F5A623]" /> 4.9 · 12 tasks completed
                  </div>
                </div>
                <Briefcase className="size-5 shrink-0 text-[#6A8064]" />
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-12 py-[72px]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-[#3DCB6C]">What we offer</p>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-[34px] font-bold" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>Browse by category</h2>
            <p className="mt-2 text-base text-[#4A5A44]">Find exactly the skill you need across all major service areas.</p>
          </div>
          <Link to="/app/browse" className="text-sm font-semibold text-[#3DCB6C]">See all categories →</Link>
        </div>

        <div className="grid grid-cols-6 gap-3.5">
          {DESKTOP_CATEGORIES.map((item) => (
            <div key={item.name} className="rounded-[14px] border border-[#D4E8CC] bg-white px-4 py-5 text-center transition-colors hover:border-[#3DCB6C]">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-[#D8F5E4] text-[22px]">{item.icon}</div>
              <p className="text-[13px] font-semibold text-[#1A1E16]">{item.name}</p>
              <p className="mt-1 text-[11px] text-[#6A8064]">{item.count}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-12 pb-[72px] pt-0">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-[#3DCB6C]">Open right now</p>
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="text-[34px] font-bold" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>Latest tasks posted</h2>
            <p className="mt-2 text-base text-[#4A5A44]">Browse tasks posted by clients looking for students like you.</p>
          </div>
          <Link to="/app/browse" className="text-sm font-semibold text-[#3DCB6C]">Browse all tasks →</Link>
        </div>

        <div className="grid grid-cols-3 gap-[18px]">
          {DESKTOP_TASKS.map((task) => (
            <article key={task.title} className="rounded-[14px] border border-[#D4E8CC] bg-white p-5">
              <div className="mb-3 flex items-start justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-[#3DCB6C]">{task.category}</p>
                <Bookmark className="size-4 text-[#C4DEB8]" />
              </div>
              <h3 className="mb-2 text-[15px] font-semibold leading-[1.4]" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>{task.title}</h3>
              <p className="mb-3.5 text-[13px] leading-[1.6] text-[#4A5A44]">{task.desc}</p>
              <div className="flex items-center justify-between border-t border-[#E8F4E4] pt-3">
                <p className="text-base font-bold" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>{task.price} <small className="text-xs font-normal text-[#6A8064]" style={{ fontFamily: 'Inter, sans-serif' }}>{task.mode}</small></p>
                <div className="flex items-center gap-1.5 text-xs text-[#4A5A44]">
                  <span className="grid size-[22px] place-items-center rounded-full bg-[#C8EED8] text-[10px] font-bold text-[#1A7A42]">{task.initials}</span>
                  {task.poster}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="bg-[#2E5C35] px-12 py-[72px]">
        <div className="mx-auto w-full max-w-[1200px]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-[#3DCB6C]">Simple process</p>
          <h2 className="text-[34px] font-bold text-white" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>How InTask works</h2>
          <p className="mt-2 text-base text-[#8EC49A]">From posting to payment in four easy steps.</p>

          <div className="mt-12 grid grid-cols-4 gap-6">
            {[
              {
                title: "Post your task",
                body: "Describe what you need, set a budget, and publish your task to thousands of student freelancers.",
              },
              {
                title: "Review applications",
                body: "Freelancers apply with their rates and portfolios. Browse, chat, and pick the best fit.",
              },
              {
                title: "Pay into escrow",
                body: "Funds are held securely via Paystack. Your freelancer only gets paid when you approve the work.",
              },
              {
                title: "Approve and release",
                body: "Review the delivery, request revisions if needed, then release payment and leave a review.",
              },
            ].map((step, index) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-[#3DCB6C] text-xl font-bold text-white" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>{index + 1}</div>
                <h3 className="mb-2 text-base font-semibold text-white" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>{step.title}</h3>
                <p className="text-[13px] leading-[1.6] text-[#8EC49A]">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-12 py-[72px]">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[1px] text-[#3DCB6C]">What people say</p>
        <h2 className="mb-2 text-[34px] font-bold" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>Trusted by students across Nigeria</h2>
        <p className="mb-10 text-base text-[#4A5A44]">Real reviews from real students and clients.</p>

        <div className="grid grid-cols-3 gap-[18px]">
          {DESKTOP_TESTIMONIALS.map((item) => (
            <article key={item.name} className="rounded-[14px] border border-[#D4E8CC] bg-white p-6">
              <p className="mb-3 text-sm text-[#F5A623]">{item.stars}</p>
              <p className="mb-4 text-sm leading-[1.7] text-[#3A4434]">"{item.text}"</p>
              <div className="flex items-center gap-2.5">
                <span className={`grid size-11 place-items-center rounded-full text-sm font-bold ${item.avatarClass}`}>{item.initials}</span>
                <div>
                  <p className="text-[13px] font-semibold">{item.name}</p>
                  <p className="text-[11px] text-[#6A8064]">{item.subtitle}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1200px] px-12 pb-[72px]">
        <div className="grid grid-cols-[1fr_auto] items-center gap-10 rounded-[20px] bg-[#3DCB6C] px-16 py-14">
          <div>
            <h2 className="mb-2 text-[34px] font-bold text-white" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>Ready to start earning?</h2>
            <p className="text-base text-white/85">Join thousands of students already using InTask to earn, learn, and grow.</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Link to="/auth/signup">
              <Button className="gap-2" variant="secondary" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
                Create free account →
              </Button>
            </Link>
            <p className="text-xs text-white/75">Free to join. No monthly fees.</p>
          </div>
        </div>
      </section>

      <footer className="bg-[#1A2E1C] px-12 pb-8 pt-14">
        <div className="mx-auto mb-10 grid w-full max-w-[1200px] grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-10">
          <div>
            <p className="mb-3 text-[22px] font-bold text-white" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>
              In<span className="text-[#3DCB6C]">Task</span>
            </p>
            <p className="mb-5 max-w-[240px] text-[13px] leading-[1.7] text-[#5A7A5E]">
              Work, collaborate, and grow — built for students.
            </p>
            <div className="flex gap-2.5">
              <span className="grid size-[34px] place-items-center rounded-lg bg-[#243826] text-[#8EC49A]"><Twitter className="size-4" /></span>
              <span className="grid size-[34px] place-items-center rounded-lg bg-[#243826] text-[#8EC49A]"><Instagram className="size-4" /></span>
              <span className="grid size-[34px] place-items-center rounded-lg bg-[#243826] text-[#8EC49A]"><Linkedin className="size-4" /></span>
              <span className="grid size-[34px] place-items-center rounded-lg bg-[#243826] text-[#8EC49A]"><Users className="size-4" /></span>
            </div>
          </div>

          {[
            {
              title: "Platform",
              links: [
                { label: "Browse tasks", to: "/app/browse" },
                { label: "Post a task", to: "/auth/signup" },
                { label: "Pricing", to: "#" },
              ],
            },
            {
              title: "Categories",
              links: [
                { label: "Web development", to: "#" },
                { label: "Visual arts", to: "#" },
                { label: "Marketing", to: "#" },
                { label: "Writing", to: "#" },
                { label: "Music", to: "#" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About us", to: "/about" },
                { label: "Blog", to: "#" },
                { label: "Careers", to: "#" },
                { label: "Press", to: "#" },
              ],
            },
            {
              title: "Support",
              links: [
                { label: "Help centre", to: "#" },
                { label: "Contact us", to: "/contact" },
                { label: "FAQs", to: "#" },
                { label: "Dispute policy", to: "#" },
              ],
            },
          ].map((group) => (
            <div key={group.title}>
              <p className="mb-4 text-[13px] font-semibold text-white" style={{ fontFamily: '"Space Grotesk", "Inter", sans-serif' }}>{group.title}</p>
              {group.links.map((item) => (
                item.to.startsWith("/") ? (
                  <Link key={item.label} to={item.to as any} className="mb-2 block text-[13px] text-[#5A7A5E] hover:text-[#8EC49A]">
                    {item.label}
                  </Link>
                ) : (
                  <a key={item.label} href={item.to} className="mb-2 block text-[13px] text-[#5A7A5E] hover:text-[#8EC49A]">
                    {item.label}
                  </a>
                )
              ))}
            </div>
          ))}
        </div>

        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between border-t border-[#243826] pt-6">
          <p className="text-xs text-[#3A5A3E]">© 2026 InTask. All rights reserved.</p>
          <div className="flex gap-5">
            <Link to="/privacy" className="text-xs text-[#3A5A3E]">Privacy policy</Link>
            <Link to="/terms" className="text-xs text-[#3A5A3E]">Terms of service</Link>
            <a href="#" className="text-xs text-[#3A5A3E]">Cookie settings</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function MobileLanding() {
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showTrustExample, setShowTrustExample] = useState(false);
  const visibleCategories = showAllCategories ? CATEGORIES : CATEGORIES.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            InTask
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/auth/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/auth/signup"><Button size="sm">Sign up free</Button></Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
              <Sparkles className="size-3" /> Built for students
            </span>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
              Get paid for your skills. <span className="text-primary">No experience needed.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              InTask connects university students with real paid tasks — web design, content writing, research, tutoring, and more. Safe payments. Verified talent.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/auth/signup">
                <Button size="lg" className="gap-2">
                  Find work <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button size="lg" variant="outline">Post a task</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Free to sign up · Payments secured by Paystack · Verified students only</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/15 via-accent to-success/10 blur-2xl" />
            <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_18px_48px_-24px_rgba(37,99,235,0.38)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Web Design · Remote</p>
                  <h3 className="mt-1 truncate text-base font-semibold text-foreground">Landing page for fashion brand</h3>
                </div>
                <span className="shrink-0 rounded-md bg-success/15 px-2 py-1 text-sm font-semibold text-success">{naira(35000)}</span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                Need a clean, mobile-first landing page with hero section, product showcase, and contact form. Figma mockup available.
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <div className="flex items-center gap-2">
                  <InitialsAvatar name="KE Styles" size={28} />
                  <div className="text-xs">
                    <div className="font-medium text-foreground">KE Styles</div>
                    <div className="text-muted-foreground">5 applicants</div>
                  </div>
                </div>
                <Link to="/auth/signup"><Button size="sm" variant="secondary">Apply</Button></Link>
              </div>
              <p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3 text-success" /> Payment held safely until work is approved
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Who is InTask for?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {WHO_IS_IT_FOR.map((w) => (
              <div key={w.title} className="rounded-2xl border border-border/80 bg-background p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className={`grid size-9 place-items-center rounded-lg ${w.color}`}>
                  <w.icon className="size-5" />
                </div>
                <h3 className="mt-3 font-medium text-foreground">{w.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.body}</p>
                <Link to="/auth/signup">
                  <Button size="sm" variant="outline" className="mt-4 w-full">{w.cta} →</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="grid size-8 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{s.n}</div>
                <h3 className="mt-3 font-medium text-foreground">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Popular categories</h2>
            <button onClick={() => setShowAllCategories((prev) => !prev)} className="text-sm font-medium text-primary hover:underline">
              {showAllCategories ? "Show less" : "Browse all"} →
            </button>
          </div>
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2">
            {visibleCategories.map((c) => (
              <span key={c} className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground">
                {c}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Why InTask?</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {TRUST.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                <div className="grid size-9 place-items-center rounded-lg bg-success/15 text-success">
                  <Icon className="size-5" />
                </div>
                <h3 className="mt-3 font-medium text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>

          <Collapsible open={showTrustExample} onOpenChange={setShowTrustExample}>
            <div className="mt-8 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Verification example</p>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-xs">
                    {showTrustExample ? "Hide" : "View"} details
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent>
                <div className="mt-3 flex items-start gap-3">
                  <InitialsAvatar name="Chiamaka Okafor" size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">Chiamaka Okafor</p>
                      <VerifiedBadge role="student" />
                    </div>
                    <p className="text-xs text-muted-foreground">UNILAG · 300L · Computer Science</p>
                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="size-3 fill-warning text-warning" /> 4.9 · 12 tasks completed
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {["Web Design", "UI/UX", "Figma"].map((s) => (
                        <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
                      ))}
                    </div>
                  </div>
                  <Briefcase className="hidden size-5 shrink-0 text-muted-foreground sm:block" />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </div>
      </section>

      <section className="hidden border-t border-border bg-card md:block">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning">
                <GraduationCap className="size-3" /> For Universities
              </span>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Partner with InTask</h2>
              <p className="mt-4 text-muted-foreground">
                Give your students access to real paid work while they study. InTask partners with Nigerian universities to bridge the gap between education and employment.
              </p>
              <ul className="mt-4 space-y-2">
                {["Free for institutions", "Students earn real income on campus", "Verified work experience before graduation", "Dashboard showing your students' activity"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-4 shrink-0 text-success" /> {item}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 gap-2" disabled>Marketplace only</Button>
            </div>
            <div className="space-y-4 rounded-2xl border border-border bg-background p-6">
              <p className="text-sm font-medium text-foreground">Partnership benefits at a glance</p>
              {[
                { label: "Student employability", value: "Higher" },
                { label: "Graduate readiness", value: "Verified" },
                { label: "Cost to university", value: "Free" },
                { label: "Setup time", value: "3 days" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="text-sm font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-primary">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-primary-foreground sm:text-3xl">
            Ready to start earning?
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/80">
            Join thousands of students already using InTask to earn, learn, and grow.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/auth/signup">
              <Button size="lg" variant="secondary" className="gap-2">
                Create free account <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                Post a task
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-3" />
              </span>
              InTask
            </div>
            <p className="mt-1 text-xs">Work, collaborate, and grow — built for students.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-xs">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
