import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/intask/EmptyState";
import { ArrowLeft, Award, CheckCircle2, Clock, Star } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/app/assessments")({
  head: () => ({ meta: [{ title: "Skill Assessments — InTask" }] }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const nav = useNavigate();
  const [activeAssessment, setActiveAssessment] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finished, setFinished] = useState(false);
  const [score, setScore] = useState(0);
  const qc = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: assessments, isLoading } = useQuery({
    queryKey: ["assessments"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("skill_assessments")
        .select("id, skill, title, description, passing_score, questions")
        .order("skill", { ascending: true });
      return data ?? [];
    },
  });

  const { data: myBadges } = useQuery({
    queryKey: ["my-badges", me?.id],
    enabled: !!me?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("student_skill_badges")
        .select("*")
        .eq("user_id", me!.id);
      return data ?? [];
    },
  });

  const badgeMap: Record<string, any> = {};
  for (const b of myBadges ?? []) badgeMap[b.skill] = b;

  function startAssessment(assessment: any) {
    setActiveAssessment(assessment);
    setCurrentQuestion(0);
    setAnswers({});
    setFinished(false);
    setScore(0);
  }

  function selectAnswer(questionId: number, answerIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
  }

  async function submitAssessment() {
    if (!activeAssessment || !me) return;
    const questions = activeAssessment.questions;
    let correct = 0;
    for (const q of questions) {
      if (answers[q.id] === q.correct) correct++;
    }
    const finalScore = Math.round((correct / questions.length) * 100);
    const passed = finalScore >= activeAssessment.passing_score;
    setScore(finalScore);
    setFinished(true);

    const existing = badgeMap[activeAssessment.skill];
    if (existing) {
      await (supabase as any)
        .from("student_skill_badges")
        .update({
          score: finalScore,
          passed: passed || existing.passed,
          attempts: existing.attempts + 1,
          earned_at: passed ? new Date().toISOString() : existing.earned_at,
        })
        .eq("id", existing.id);
    } else {
      await (supabase as any)
        .from("student_skill_badges")
        .insert({
          user_id: me.id,
          skill: activeAssessment.skill,
          score: finalScore,
          passed,
          attempts: 1,
          earned_at: new Date().toISOString(),
        });
    }
    qc.invalidateQueries({ queryKey: ["my-badges"] });
    qc.invalidateQueries({ queryKey: ["profile", me.id] });
  }

  if (activeAssessment && !finished) {
    const questions = activeAssessment.questions;
    const q = questions[currentQuestion];
    const totalQ = questions.length;
    const answered = Object.keys(answers).length;

    return (
      <div className="mx-auto max-w-md pb-10">
        <header className="flex items-center justify-between px-4 pt-4">
          <button onClick={() => setActiveAssessment(null)} className="grid size-9 place-items-center rounded-full border border-border bg-card">
            <ArrowLeft className="size-4" />
          </button>
          <p className="text-sm font-medium text-muted-foreground">{currentQuestion + 1} / {totalQ}</p>
        </header>

        <div className="px-4 pt-4">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-6">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((currentQuestion + 1) / totalQ) * 100}%` }} />
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{activeAssessment.skill} Assessment</p>
          <h2 className="text-lg font-semibold text-foreground mb-6">{q.question}</h2>

          <div className="space-y-3">
            {q.options.map((option: string, i: number) => (
              <button
                key={i}
                onClick={() => selectAnswer(q.id, i)}
                className={`w-full rounded-xl border p-4 text-left text-sm transition-colors ${
                  answers[q.id] === i
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                {option}
              </button>
            ))}
          </div>

          <div className="mt-8 flex gap-3">
            {currentQuestion > 0 && (
              <Button variant="outline" className="flex-1" onClick={() => setCurrentQuestion((p) => p - 1)}>
                Previous
              </Button>
            )}
            {currentQuestion < totalQ - 1 ? (
              <Button
                className="flex-1"
                disabled={answers[q.id] === undefined}
                onClick={() => setCurrentQuestion((p) => p + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                className="flex-1"
                disabled={answered < totalQ}
                onClick={submitAssessment}
              >
                {answered < totalQ ? `Answer all questions (${answered}/${totalQ})` : "Submit assessment"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (activeAssessment && finished) {
    const passed = score >= activeAssessment.passing_score;
    return (
      <div className="mx-auto max-w-md pb-10 px-4 pt-10 text-center">
        <div className={`grid size-20 place-items-center rounded-full mx-auto mb-4 ${passed ? "bg-success/15" : "bg-destructive/15"}`}>
          {passed ? (
            <Award className="size-10 text-success" />
          ) : (
            <Clock className="size-10 text-destructive" />
          )}
        </div>
        <h1 className="text-2xl font-semibold text-foreground">
          {passed ? "Badge earned! 🎉" : "Not quite there"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          You scored <span className="font-semibold text-foreground">{score}%</span> on the {activeAssessment.skill} assessment.
          {passed ? " Your badge is now visible on your profile." : ` You need ${activeAssessment.passing_score}% to pass.`}
        </p>

        {passed && (
          <div className="mt-6 rounded-xl border border-success/30 bg-success/10 p-4">
            <div className="flex items-center justify-center gap-2">
              <Award className="size-5 text-success" />
              <p className="font-semibold text-success">{activeAssessment.skill} — Verified</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setActiveAssessment(null)}>
            Back to assessments
          </Button>
          {!passed && (
            <Button className="flex-1" onClick={() => startAssessment(activeAssessment)}>
              Try again
            </Button>
          )}
          {passed && (
            <Button className="flex-1" onClick={() => nav({ to: "/app/profile/$userId" as any, params: { userId: "me" } })}>
              View profile
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md pb-10">
      <header className="flex items-center gap-2 px-4 pt-4">
        <button onClick={() => window.history.back()} className="grid size-9 place-items-center rounded-full border border-border bg-card">
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold">Skill Assessments</h1>
      </header>

      <div className="px-4 pt-4">
        <p className="text-sm text-muted-foreground mb-4">
          Take short assessments to earn verified skill badges on your profile. Badges show employers you have tested knowledge.
        </p>

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        )}

        {!isLoading && (assessments?.length ?? 0) === 0 && (
          <EmptyState icon={Award} title="No assessments yet" description="Check back soon — assessments are being added." />
        )}

        <div className="space-y-3">
          {assessments?.map((a: any) => {
            const badge = badgeMap[a.skill];
            const hasPassed = badge?.passed;
            const hasAttempted = !!badge;

            return (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{a.title}</p>
                      {hasPassed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                          <CheckCircle2 className="size-3" /> Verified
                        </span>
                      )}
                      {hasAttempted && !hasPassed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                          Score: {badge.score}%
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="size-3" /> {a.questions.length} questions</span>
                      <span className="flex items-center gap-1"><Star className="size-3" /> Pass: {a.passing_score}%</span>
                      {hasAttempted && <span>{badge.attempts} attempt{badge.attempts === 1 ? "" : "s"}</span>}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={hasPassed ? "outline" : "default"}
                  className="mt-3 w-full"
                  onClick={() => startAssessment(a)}
                >
                  {hasPassed ? "Retake assessment" : hasAttempted ? "Try again" : "Start assessment"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}