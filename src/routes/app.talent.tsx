import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MVP_FEATURES } from "@/lib/mvp-features";
import { SKILLS } from "@/lib/constants";
import { InitialsAvatar } from "@/components/intask/Avatar";
import { VerifiedBadge } from "@/components/intask/Badges";
import { EmptyState } from "@/components/intask/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, Star, Lock, Unlock, Award } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/talent")({
  head: () => ({ meta: [{ title: "Talent Search — InTask" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    q: (search.q as string) || "",
  }),
  component: TalentSearchPage,
});

const UNIVERSITIES = [
  "All Universities", "UNILAG", "University of Ibadan", "OAU", "ABU Zaria",
  "FUTA", "LASU", "UNIPORT", "UNIBEN", "UNN", "UNIABUJA",
  "Covenant University", "Babcock University", "Other",
];

const YEAR_LEVELS = ["All Levels", "100 level", "200 level", "300 level", "400 level", "500 level and above"];

function TalentSearchPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ);
  const [submittedQ, setSubmittedQ] = useState(initialQ);
  const [skill, setSkill] = useState("All Skills");
  const [university, setUniversity] = useState("All Universities");
  const [yearLevel, setYearLevel] = useState("All Levels");
  const [minRating, setMinRating] = useState("");
  const [hasSearched, setHasSearched] = useState(true);

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
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

  const { data: results, isLoading } = useQuery({
    queryKey: ["talent-search", submittedQ, skill, university, yearLevel, minRating],
    enabled: !!me?.id,
    queryFn: async () => {
      // Apply filters directly on student_profiles (no 50-row truncation), then
      // fetch the matching profiles by id so filters work against all students.
      let spQuery = supabase
        .from("student_profiles")
        .select("user_id, university, year_of_study, skills, rating_average, rating_count, tasks_completed, verified");

      if (university !== "All Universities") {
        if (university === "Other") {
          // Exclude every university listed in the dropdown so only
          // universities NOT in the list remain.
          const listed = UNIVERSITIES.filter((u) => u !== "All Universities" && u !== "Other");
          for (const u of listed) {
            spQuery = spQuery.not("university", "ilike", `%${u}%`);
          }
        } else {
          spQuery = spQuery.ilike("university", `%${university}%`);
        }
      }
      if (yearLevel !== "All Levels") spQuery = spQuery.eq("year_of_study", yearLevel);
      if (minRating) spQuery = spQuery.gte("rating_average", Number(minRating));
      if (skill !== "All Skills") spQuery = spQuery.contains("skills", [skill]);

      // Search bar: match by skill name or by student name.
      const q = submittedQ.trim();
      const matchingSkills = q
        ? SKILLS.filter((s) => s.toLowerCase().includes(q.toLowerCase()))
        : [];
      const searchingBySkill = matchingSkills.length > 0;
      if (searchingBySkill) {
        spQuery = spQuery.overlaps("skills", matchingSkills);
      }

      const { data: studentProfiles } = await spQuery;
      const userIds = (studentProfiles ?? []).map((sp) => sp.user_id);
      if (userIds.length === 0) return [];

      let profilesQuery = supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("id", userIds)
        .in("role", ["student", "alumni"]);

      // Only filter by name when the query didn't match any known skill.
      if (q && !searchingBySkill) {
        profilesQuery = profilesQuery.ilike("full_name", `%${q}%`);
      }

      const { data: profiles } = await profilesQuery;
      if (!profiles || profiles.length === 0) return [];

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

      const spMap: Record<string, any> = {};
      for (const sp of studentProfiles ?? []) spMap[sp.user_id] = sp;

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

  const canSearchTalent = !MVP_FEATURES.subscriptions || mySub?.plan?.can_search_talent === true;

  function handleSearch() {
    setHasSearched(true);
    setSubmittedQ(q);
    if (me) {
      (supabase as any).from("talent_searches").insert({
        searcher_id: me.id,
        query: q,
        filters: { skill, university, yearLevel, minRating },
      });
    }
  }

  function clearFilters() {
    setSkill("All Skills");
    setUniversity("All Universities");
    setYearLevel("All Levels");
    setMinRating("");
  }

  const filtersActive = skill !== "All Skills" || university !== "All Universities" || yearLevel !== "All Levels" || !!minRating;

  const countLabel = isLoading
    ? "Searching talent…"
    : results
      ? `${results.length} student${results.length === 1 ? "" : "s"} found`
      : "Find verified student talent";

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1240px] bg-[#eff8ea] px-5 py-7 text-[#1a1e16] lg:px-9">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.history.back()}
            className="grid size-9 place-items-center rounded-full border border-[#c4deb8] bg-white"
            aria-label="Back"
          >
            <ArrowLeft className="size-4" />
          </button>
          <h1 className="[font-family:'Space_Grotesk',sans-serif] text-[1.4rem] font-bold text-[#1a1e16]">Talent Search</h1>
        </div>
        <p className="text-[0.8rem] text-[#6a8064]">{countLabel}</p>
      </header>

      {MVP_FEATURES.subscriptions && !canSearchTalent && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-[14px] border border-[#e6c79a] bg-[#f7ecd9] p-4 shadow-sm">
          <div>
            <p className="text-[0.85rem] font-semibold text-[#8b5f17]">Pro feature</p>
            <p className="mt-0.5 text-[0.8rem] text-[#8b5f17]/90">
              Upgrade to the Pro plan to unlock full talent search with direct contact details.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => nav({ to: "/app/subscription" as any })}
            className="shrink-0 rounded-[10px] bg-[#3dcb6c] px-4 text-[0.8rem] font-semibold text-white hover:bg-[#35b860]"
          >
            Upgrade
          </Button>
        </div>
      )}

      <div className="mb-4 flex gap-2.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#6a8064]" />
          <Input
            placeholder="Search by name, skill, or keyword..."
            className="h-11 rounded-[10px] border-[#c4deb8] bg-white pl-10 text-[0.9rem]"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          type="button"
          onClick={handleSearch}
          disabled={isLoading}
          className="h-11 min-w-[106px] rounded-[10px] bg-[#3dcb6c] px-5 text-[0.85rem] font-semibold text-white hover:bg-[#35b860]"
        >
          {isLoading ? "Searching…" : "Search"}
        </Button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value)}
          className="h-9 rounded-lg border border-[#c4deb8] bg-white px-3 text-[0.8rem]"
        >
          <option value="All Skills">All Skills</option>
          {SKILLS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={university}
          onChange={(e) => setUniversity(e.target.value)}
          className="h-9 rounded-lg border border-[#c4deb8] bg-white px-3 text-[0.8rem]"
        >
          {UNIVERSITIES.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <select
          value={yearLevel}
          onChange={(e) => setYearLevel(e.target.value)}
          className="h-9 rounded-lg border border-[#c4deb8] bg-white px-3 text-[0.8rem]"
        >
          {YEAR_LEVELS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={minRating}
          onChange={(e) => setMinRating(e.target.value)}
          className="h-9 rounded-lg border border-[#c4deb8] bg-white px-3 text-[0.8rem]"
        >
          <option value="">Rating: Any</option>
          <option value="3">3+ stars</option>
          <option value="4">4+ stars</option>
          <option value="4.5">4.5+ stars</option>
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[0.8rem] font-medium text-[#1a7a42] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-[14px] border border-[#c4deb8] bg-white" />
          ))}
        </div>
      )}

      {hasSearched && !isLoading && results && results.length === 0 && (
        <EmptyState icon={Search} title="No talent found" description="Try adjusting your filters or search terms." />
      )}

      {results && results.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {results.map((p: any) => {
            const isUnlocked = (myUnlocks ?? []).includes(p.id);
            const showFullProfile = canSearchTalent && isUnlocked;

            return (
              <div
                key={p.id}
                className="flex min-h-[240px] flex-col rounded-[14px] border border-[#c4deb8] bg-white p-[18px]"
              >
                <div className="flex items-start gap-3">
                  <InitialsAvatar name={showFullProfile ? p.full_name : "??"} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="[font-family:'Space_Grotesk',sans-serif] text-[0.95rem] font-semibold leading-[1.3] text-[#1a1e16]">
                        {showFullProfile ? p.full_name : `${p.full_name?.charAt(0) ?? "?"}*** ${p.full_name?.split(" ")[1]?.charAt(0) ?? "?"}***`}
                      </p>
                      <VerifiedBadge role={p.role} verified={p.student?.verified} />
                    </div>
                    {p.student?.university && (
                      <p className="mt-0.5 text-[0.75rem] text-[#6a8064]">
                        {p.student.university}
                        {p.student.year_of_study ? ` · ${p.student.year_of_study}` : ""}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-[0.75rem] text-[#6a8064]">
                      {(p.student?.rating_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="size-3 fill-[#b5771a] text-[#b5771a]" />
                          <span className="font-semibold text-[#1a1e16]">{Number(p.student.rating_average).toFixed(1)}</span>
                        </span>
                      )}
                      {(p.student?.tasks_completed ?? 0) > 0 && (
                        <span>{p.student.tasks_completed} tasks done</span>
                      )}
                    </div>
                  </div>
                </div>

                {p.student?.skills && p.student.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.student.skills.slice(0, 3).map((s: string) => (
                      <span key={s} className="rounded-full bg-[#f4fbf0] px-2 py-0.5 text-[0.6rem] font-medium text-[#6a8064]">{s}</span>
                    ))}
                    {p.student.skills.length > 3 && (
                      <span className="rounded-full bg-[#f4fbf0] px-2 py-0.5 text-[0.6rem] font-medium text-[#6a8064]">+{p.student.skills.length - 3}</span>
                    )}
                  </div>
                )}

                {p.badges && p.badges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.badges.slice(0, 2).map((b: string) => (
                      <span key={b} className="inline-flex items-center gap-1 rounded-full border border-[#1a7a42] bg-[#d8f5e4] px-2 py-0.5 text-[0.6rem] font-medium text-[#1a7a42]">
                        <Award className="size-2.5" /> {b}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-auto flex gap-2 pt-4">
                  {showFullProfile ? (
                    <Link to="/app/profile/$userId" params={{ userId: p.id }} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-full gap-1 rounded-[10px] border-[#c4deb8] bg-transparent text-[0.8rem] font-semibold text-[#1a1e16] hover:border-[#3dcb6c] hover:bg-[#d8f5e4]"
                      >
                        <Unlock className="size-3.5" /> View full profile
                      </Button>
                    </Link>
                  ) : canSearchTalent ? (
                    <Button
                      size="sm"
                      className="h-9 flex-1 gap-1 rounded-[10px] bg-[#3dcb6c] text-[0.8rem] font-semibold text-white hover:bg-[#35b860]"
                      disabled={unlock.isPending}
                      onClick={() => unlock.mutate(p.id)}
                    >
                      <Unlock className="size-3.5" /> Unlock profile
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1 gap-1 rounded-[10px] border-[#c4deb8] bg-transparent text-[0.8rem] font-semibold text-[#6a8064] hover:border-[#3dcb6c] hover:bg-[#d8f5e4]"
                      onClick={() => nav({ to: "/app/subscription" as any })}
                    >
                      <Lock className="size-3.5" /> Upgrade to unlock
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-[10px] border-[#c4deb8] bg-transparent px-3 text-[0.8rem] font-semibold text-[#1a1e16] hover:border-[#3dcb6c] hover:bg-[#d8f5e4]"
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
  );
}
