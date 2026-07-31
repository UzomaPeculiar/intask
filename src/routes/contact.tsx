import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Contact InTask</h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Need help with your account, payments, or disputes? Reach out and our team will respond as quickly as possible.
        </p>

        <div className="mt-6 space-y-3 text-sm text-foreground">
          <p><span className="font-medium">Email:</span> support@intask.ng</p>
          <p><span className="font-medium">Hours:</span> Mon–Fri, 9:00 AM – 5:00 PM (WAT)</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/auth/signup" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Create account</Link>
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
