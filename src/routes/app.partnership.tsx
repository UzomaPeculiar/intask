import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, GraduationCap, CheckCircle2, Users, Briefcase, DollarSign } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/partnership")({
  head: () => ({ meta: [{ title: "University Partnership — InTask" }] }),
  component: PartnershipPage,
});

function PartnershipPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [universityName, setUniversityName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  async function submit() {
    if (!universityName.trim() || !contactName.trim() || !contactEmail.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    const { error } = await (supabase as any)
      .from("university_partnerships")
      .insert({
        university_name: universityName.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        notes: notes.trim() || null,
        status: "pending",
      });
    setLoading(false);
    if (error) { toast.error("Could not submit request. Please try again."); return; }
    setSubmitted(true);
  }

  const benefits = [
    { icon: Users, title: "Student employability", body: "Give your students access to real paid work while they study. Build their CVs before graduation." },
    { icon: Briefcase, title: "Graduate readiness", body: "Students who use InTask graduate with verified work experience and professional reviews." },
    { icon: DollarSign, title: "Student income", body: "Nigerian students earn real income without leaving campus. Reduces financial pressure on families." },
    { icon: GraduationCap, title: "Institution visibility", body: "Your university appears as a verified partner on InTask, attracting top students and employers." },
  ];

  if (submitted) {
    return (
      <div className="mx-auto max-w-md px-4 pt-10 pb-10 text-center">
        <div className="grid size-20 place-items-center rounded-full bg-success/15 mx-auto mb-4">
          <CheckCircle2 className="size-10 text-success" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Request submitted</h1>
        <p className="mt-3 text-muted-foreground">
          Thank you for your interest in partnering with InTask. Our team will review your request and reach out to <span className="font-medium text-foreground">{contactEmail}</span> within 3 business days.
        </p>
        <div className="mt-6 rounded-xl border border-border bg-card p-4 text-left space-y-2">
          <p className="text-sm font-medium text-foreground">What happens next</p>
          <p className="text-xs text-muted-foreground">1. Our team reviews your request</p>
          <p className="text-xs text-muted-foreground">2. We schedule a brief call to discuss the partnership</p>
          <p className="text-xs text-muted-foreground">3. We set up your university on InTask</p>
          <p className="text-xs text-muted-foreground">4. Your students get access to verified opportunities</p>
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
        <h1 className="text-lg font-semibold">University Partnership</h1>
      </header>

      <div className="px-4 pt-4 space-y-6">
        <div className="rounded-xl border border-warning/30 bg-gradient-to-br from-warning/10 to-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <GraduationCap className="size-6 text-warning" />
            <p className="font-semibold text-foreground">Partner with InTask</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Join Nigerian universities already preparing their students for the real world through InTask. Free for institutions — we only earn when your students do.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {benefits.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-3">
              <Icon className="size-5 text-primary mb-2" />
              <p className="text-xs font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-1">{body}</p>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Request a partnership</h2>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">University name *</label>
            <Input value={universityName} onChange={(e) => setUniversityName(e.target.value)} placeholder="e.g. University of Lagos" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contact person name *</label>
            <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="e.g. Dr. Adeyemi Johnson" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Contact email *</label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="e.g. careers@unilag.edu.ng" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Additional notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell us about your institution and what you hope to achieve..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>
          <Button className="w-full" size="lg" disabled={loading} onClick={submit}>
            {loading ? "Submitting..." : "Submit partnership request"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Partnership is free for universities. We earn a small commission only when your students complete paid tasks.
          </p>
        </div>
      </div>
    </div>
  );
}