import { Outlet, useRouterState } from "@tanstack/react-router";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { EmptyState } from "@/components/intask/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, Search, Clock, Star } from "lucide-react";

export const Route = createFileRoute("/app/mentorship")({
  head: () => ({ meta: [{ title: "Mentorship — InTask" }] }),
  component: MentorshipLayout,
});

function MentorshipLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isChild = path !== "/app/mentorship";
  if (isChild) return <Outlet />;
  return <MentorshipPage />;
}

const MENTORSHIP_CATEGORIES = [
  "All", "Career Advice", "CV Review", "Mock Interview", "Tech Skills",
  "Business", "Design", "Writing", "Project Review", "General",
];

function MentorshipPage() {
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState("");
  const nav = useNavigate();

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", me!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: services, isLoading } = useQuery({
    queryKey: ["mentorship-services", category, q],
    queryFn: async () => {
      const { data: servicesData, error } = await (supabase as any)
        .from("mentorship_services")
        .select("*, mentor:profiles!mentorship_services_mentor_id_fkey(id, full_name, role)")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!servicesData || servicesData.length === 0) return [];

      const mentorIds = servicesData.map((s: any) => s.mentor_id);
      const { data: mentorProfiles } = await supabase
        .from("student_profiles")
        .select("user_id, university, year_of_study, rating_average, rating_count, verified, skills")
        .in("user_id", mentorIds);

      const profileMap: Record<string, any> = {};
      for (const p of mentorProfiles ?? []) profileMap[p.user_id] = p;

      const data = servicesData.map((s: any) => ({
        ...s,
        mentor_profile: profileMap[s.mentor_id] ?? null,
      }));

      console.log("services data:", data);
      return data;

      if (error) throw error;
      let results = data ?? [];
      if (category !== "All") results = results.filter((s: any) => s.category === category);
      if (q.trim()) results = results.filter((s: any) =>
        s.title.toLowerCase().includes(q.toLowerCase()) ||
        s.description.toLowerCase().includes(q.toLowerCase()) ||
        s.mentor?.full_name?.toLowerCase().includes(q.toLowerCase())
      );
      return results;
    },
  });

  const isAlumni = myProfile?.role === "alumni";

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 pt-5 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Mentorship</h1>
        {isAlumni && (
          <Button size="sm" onClick={() => nav({ to: "/app/mentorship/manage" as any})}>
            My services
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Book 1-on-1 sessions with verified alumni for career advice, CV reviews, mock interviews and more.
      </p>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search mentors or topics…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {MENTORSHIP_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-card" />)}
        </div>
      )}

      {!isLoading && (services?.length ?? 0) === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="No mentorship services yet"
          description={isAlumni ? "Be the first to offer mentorship to students." : "Check back soon — alumni are adding services."}
          action={isAlumni ? <Button onClick={() => nav({ to: "/app/mentorship/manage" })}>Offer mentorship</Button> : undefined}
        />
      )}

      <div className="space-y-4">
        {services?.map((s: any) => (
          <Link key={s.id} to="/app/mentorship/$serviceId" params={{ serviceId: s.id }} className="block">
            <div className="rounded-xl border border-border bg-card p-4 shadow-card transition-colors active:bg-accent/50">
              <div className="flex items-start gap-3">
                <InitialsAvatar name={s.mentor?.full_name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-foreground line-clamp-1">{s.mentor?.full_name}</p>
                    <span className="shrink-0 rounded-md bg-success/15 px-2 py-0.5 text-sm font-semibold text-success">
                      ₦{Number(s.price).toLocaleString("en-NG")}
                    </span>
                  </div>
                  <VerifiedBadge role="alumni" />
                  {s.mentor_profile?.university && (
                    <p className="text-xs text-muted-foreground mt-0.5">{s.mentor_profile.university}</p>
                  )}
                </div>
              </div>
              <div className="mt-3">
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3" /> {s.duration_minutes} min
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5">{s.category}</span>
                {(s.mentor_profile?.rating_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="size-3 fill-warning text-warning" />
                    {Number(s.mentor_profile.rating_average).toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}