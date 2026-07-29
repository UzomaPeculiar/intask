import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">About InTask</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          InTask is a marketplace that connects Nigerian university students and alumni with clients who need quality work done quickly.
          We focus on verified profiles, secure escrow payments, and fair outcomes for both clients and freelancers.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Our mission is simple: help students earn, build experience, and grow professional confidence while still in school.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/auth/signup" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Create account</Link>
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
