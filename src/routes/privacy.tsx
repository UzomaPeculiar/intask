import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          InTask collects only the information needed to run the marketplace, such as profile details, communication metadata, and transaction records.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          We use this information to provide account access, task matching, escrow operations, and platform safety. We do not sell personal data.
        </p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          You may request account updates or deletion subject to legal and payment-record requirements.
        </p>
        <div className="mt-6">
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
