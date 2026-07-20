import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { EmptyState } from "@/components/intask/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Star, Lock, Unlock, Filter, Award } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/talent")({
  head: () => ({ meta: [{ title: "Talent Search — InTask" }] }),
  component: TalentSearchPage,
});

const SKILLS = [
  "All Skills", "Web Design", "Mobile App Dev", "UI/UX Design", "Graphic Design",
  "Content Writing", "Copywriting", "Social Media", "Video Editing", "Photography",
  "Data Analysis", "Research", "Python", "JavaScript", "Excel/Spreadsheets",
  "Math Tutoring", "Business Analysis", "Product Management", "Virtual Assistant",
];

const UNIVERSITIES = [
  "All Universities", "UNILAG", "University of Ibadan", "OAU", "ABU Zaria",
  "FUTA", "LASU", "UNIPORT", "UNIBEN", "UNN", "UNIABUJA",
  "Covenant University", "Babcock University", "Other",
];

const YEAR_LEVELS = ["All Levels", "100 level", "200 level", "300 level", "400 level", "500 level and above"];

function TalentSearchPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("All Skills");
  const [university, setUniversity] = useState("All Universities");
  const [yearLevel, setYearLevel] = useState("All Levels");
  const [minRating, setMinRating] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
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

  const { data: mySub } = useQuery({
    queryKey: ["my-subscription", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("company_subscriptions")
        .select("*, plan:subscription_plans(can_search_talent, name)")
        .eq("company_id", me!.id)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
  });

  const { data: myUnlocks } = useQuery({
    queryKey: ["my-unlocks", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("talent_unlocks")
        .select("student_id")
        .eq("searcher_id", me!.id);
      return (data ?? []).map((u: any) => u.student_id) as string[];
    },
  });

  const { data: results, isLoading, refetch } = useQuery({
    queryKey: ["talent-search", q, skill, university, yearLevel, minRating],
    enabled: false,
    queryFn: async () => {
      let profilesQuery = supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["student", "alumni"])
        .neq("id", me?.id ?? "")
        .limit(50);

      if (q.trim()) profilesQuery = profilesQuery.ilike("full_name", `%${q.trim()}%`);

      const { data: profiles } = await profilesQuery;
      if (!profiles || profiles.length === 0) return [];

      let spQuery = supabase
        .from("student_profiles")
        .select("user_id, university, year_of_study, skills, rating_average, rating_count, tasks_completed, verified")
        .in("user_id", profiles.map((p) => p.id));

      if (university !== "All Universities") spQuery = spQuery.ilike("university", `%${university}%`);
      if (yearLevel !== "All Levels") spQuery = spQuery.eq("year_of_study", yearLevel);
      if (minRating) spQuery = spQuery.gte("rating_average", Number(minRating));
      if (skill !== "All Skills") spQuery = spQuery.contains("skills", [skill]);

      const { data: studentProfiles } = await spQuery;
      const spMap: Record<string, any> = {};
      for (const sp of studentProfiles ?? []) spMap[sp.user_id] = sp;

      const { data: badges } = await (supabase as any)
        .from("student_skill_badges")
        .select("user_id, skill")
        .in("user_id", profiles.map((p) => p.id))
        .eq("passed", true);

      const badgeMap: Record<string, string[]> = {};
      for (const b of badges ?? []) {
        if (!badgeMap[b.user_id]) badgeMap[b.user_id] = [];
        badgeMap[b.user_id].push(b.skill);
      }

      return profiles
        .filter((p) => spMap[p.id])
        .map((p) => ({
          ...p,
          student: spMap[p.id] ?? null,
          badges: badgeMap[p.id] ?? [],
        }));
    },
  });

  const unlock = useMutation({
    mutationFn: async (studentId: string) => {
      if (!me) throw new Error("Not signed in");
      const { error } = await (supabase as any)
        .from("talent_unlocks")
        .insert({ searcher_id: me.id, student_id: studentId });
      if (error && error.code !== "23505") throw error;
      await supabase.from("notifications").insert({
        user_id: studentId,
        type: "profile_viewed",
        message: "A recruiter viewed your full profile on InTask.",
        link: "/app/profile/me",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-unlocks"] });
      toast.success("Profile unlocked");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not unlock profile"),
  });

  const canSearchTalent = mySub?.plan?.can_search_talent === true;
  const role = myProfile?.role;
  const canAccess = role === "company" || role === "individual" || role === "alumni";

  function handleSearch() {
    setHasSearched(true);
    refetch();
    if (me) {
      (supabase as any).from("talent_searches").insert({
        searcher_id: me.id,
        query: q,
        filters: { skill, university, yearLevel, minRating },
      });
    }
  }

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 pb-10 text-center">
        <Lock className="size-10 text-muted-foreground mx-auto mb-4" />
        <h1 className="text-xl font-semibold">Talent Search</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Talent search is available for companies, businesses, and alumni only.
        </p>
        <Button className="mt-4" onClick={() => window.history.back()}>Go back</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-2">
          <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="text-lg font-semibold">Talent Search</h1>
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="size-3.5" /> Filters
        </Button>
      </header>

      <div className="px-4 pt-4 space-y-3">
        {!canSearchTalent && (
          <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-warning">Pro feature</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Upgrade to the Pro plan to unlock full talent search with direct contact details.
              </p>
            </div>
            <Button size="sm" onClick={() => nav({ to: "/app/subscription" as any })}>
              Upgrade
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button onClick={handleSearch} disabled={isLoading}>
            {isLoading ? "..." : "Search"}
          </Button>
        </div>

        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Skill</label>
              <select value={skill} onChange={(e) => setSkill(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">University</label>
              <select value={university} onChange={(e) => setUniversity(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Year level</label>
                <select value={yearLevel} onChange={(e) => setYearLevel(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Min rating</label>
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Any rating</option>
                  <option value="3">3+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="4.5">4.5+ stars</option>
                </select>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setSkill("All Skills"); setUniversity("All Universities"); setYearLevel("All Levels"); setMinRating(""); }}>
              Clear filters
            </Button>
          </div>
        )}

        {!hasSearched && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Search className="size-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Search for talent</p>
            <p className="text-xs text-muted-foreground mt-1">Filter by skill, university, year level, and rating to find the right student for your needs.</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        )}

        {hasSearched && !isLoading && (results?.length ?? 0) === 0 && (
          <EmptyState icon={Search} title="No talent found" description="Try adjusting your filters or search terms." />
        )}

        {results && results.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{results.length} student{results.length === 1 ? "" : "s"} found</p>
            {results.map((p: any) => {
              const isUnlocked = (myUnlocks ?? []).includes(p.id);
              const showFullProfile = canSearchTalent && isUnlocked;

              return (
                <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <InitialsAvatar name={showFullProfile ? p.full_name : "??"} size={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground">
                          {showFullProfile ? p.full_name : `${p.full_name?.charAt(0) ?? "?"}*** ${p.full_name?.split(" ")[1]?.charAt(0) ?? "?"}***`}
                        </p>
                        <VerifiedBadge role={p.role} verified={p.student?.verified} />
                      </div>
                      {p.student?.university && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {p.student.university}
                          {p.student.year_of_study ? ` · ${p.student.year_of_study}` : ""}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        {(p.student?.rating_count ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="size-3 fill-warning text-warning" />
                            {Number(p.student.rating_average).toFixed(1)}
                          </span>
                        )}
                        {(p.student?.tasks_completed ?? 0) > 0 && (
                          <span>{p.student.tasks_completed} tasks done</span>
                        )}
                      </div>
                      {p.student?.skills && p.student.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.student.skills.slice(0, 3).map((s: string) => (
                            <span key={s} className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">{s}</span>
                          ))}
                          {p.student.skills.length > 3 && (
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">+{p.student.skills.length - 3}</span>
                          )}
                        </div>
                      )}
                      {p.badges && p.badges.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {p.badges.slice(0, 2).map((b: string) => (
                            <span key={b} className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                              <Award className="size-2.5" /> {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    {showFullProfile ? (
                      <Link to="/app/profile/$userId" params={{ userId: p.id }} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full gap-1">
                          <Unlock className="size-3.5" /> View full profile
                        </Button>
                      </Link>
                    ) : canSearchTalent ? (
                      <Button
                        size="sm"
                        className="flex-1 gap-1"
                        disabled={unlock.isPending}
                        onClick={() => unlock.mutate(p.id)}
                      >
                        <Unlock className="size-3.5" /> Unlock profile
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1 text-muted-foreground"
                        onClick={() => nav({ to: "/app/subscription" as any })}
                      >
                        <Lock className="size-3.5" /> Upgrade to unlock
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => nav({ to: "/app/tasks/create" as any })}
                    >
                      Invite to task
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}