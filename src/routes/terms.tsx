import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          By using InTask, you agree to use the platform lawfully and respectfully. Users are responsible for the accuracy of posted tasks,
          submitted work, and profile information.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Payments for eligible tasks are processed using escrow flows. Disputes are reviewed by InTask according to platform policy.
          Abuse, fraud, and harassment may result in account restrictions or removal.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          These terms may be updated periodically. Continued use of the platform means acceptance of updates.
        </p>
        <div className="mt-6">
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
