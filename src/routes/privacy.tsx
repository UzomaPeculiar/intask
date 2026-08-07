import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  const updatedAt = "August 6, 2026";

  const sections = [
    {
      title: "1. Who We Are",
      body: [
        "InTask is the operator of the InTask marketplace platform.",
        "InTask helps users post, apply for, collaborate on, and complete paid and unpaid tasks through an account-based web platform.",
        "Contact: support@intask.ng.",
      ],
    },
    {
      title: "2. What InTask Does",
      body: [
        "InTask is an account-based marketplace service. Users create profiles, post tasks, submit applications, exchange messages, deliver work, and receive payment via escrow and wallet flows.",
        "Some platform features involve payment facilitation and verification workflows.",
      ],
    },
    {
      title: "3. Information We Collect",
      body: [
        "What we do not collect: we do not collect your card PIN, we do not sell personal data, and we do not request your contact list or address book.",
        "Data you submit: profile details, task posts, applications, messages, dispute details, reports, and uploaded verification or task files.",
        "Generated platform data: status labels, moderation and safety flags, transaction records, audit records, and operational logs.",
        "Analytics and technical data: browser, device, route-level usage, server and security logs, and anti-abuse telemetry.",
        "Account and payment metadata: wallet balances, escrow records, withdrawal requests, payout references, and payment status fields.",
      ],
    },
    {
      title: "4. How We Use Information",
      body: [
        "We use data to provide service features, process tasks and payments, support verification and dispute resolution, prevent abuse, improve operations, and meet legal obligations.",
        "AI model training disclosure: InTask does not use your submitted marketplace content to train third-party foundation AI models for public model improvement.",
      ],
    },
    {
      title: "5. Cookies",
      body: [
        "InTask primarily uses session storage for auth state in the browser. We do not use advertising cookies for cross-site behavioral profiling.",
        "Where infrastructure-level cookies are present, they are used for session security and service reliability.",
      ],
    },
    {
      title: "6. Third-Party Processors",
      body: [
        "InTask uses third-party processors for infrastructure, hosting, and payments.",
      ],
    },
    {
      title: "7. Data Retention",
      body: [
        "Account and profile data: retained while your account is active and for a limited period after closure as required for legal, fraud, and dispute purposes.",
        "Task, messaging, and dispute records: retained for platform integrity, conflict resolution, and legal compliance.",
        "Payment, wallet, and withdrawal records: retained as required for reconciliation, fraud prevention, and regulatory obligations.",
        "Server and security logs: typically retained for up to 30 days unless longer retention is needed for abuse investigation or legal duties.",
      ],
    },
    {
      title: "8. Your Rights",
      body: [
        "Depending on your jurisdiction, you may have rights to access, correction, deletion, restriction, portability, and objection.",
        "For GDPR/UK users, we generally respond within 30 days where applicable.",
        "For California users, InTask does not sell personal information.",
      ],
    },
    {
      title: "9. International Transfers",
      body: [
        "Data may be processed in countries where InTask and its service providers operate.",
        "Where required, transfer safeguards such as contractual protections are used.",
      ],
    },
    {
      title: "10. Children",
      body: [
        "InTask is not directed to children under 13 and is not intended for users who cannot lawfully enter binding platform agreements.",
        "If you believe a child submitted data in violation of this policy, contact support@intask.ng for review and deletion steps.",
      ],
    },
    {
      title: "11. Security",
      body: [
        "We use TLS/HTTPS in transit, managed infrastructure controls, access restrictions, and operational monitoring.",
        "No system is perfectly secure, but InTask applies reasonable safeguards and incident response controls.",
      ],
    },
    {
      title: "12. Changes",
      body: [
        "We may update this Privacy Policy periodically and will post a revised Last updated date when changes are made.",
        "Material updates may also be communicated through in-product notices.",
      ],
    },
    {
      title: "13. Contact",
      body: [
        "Privacy requests and questions: support@intask.ng.",
        "InTask aims to respond within 30 days for verifiable privacy requests.",
      ],
    },
    {
      title: "14. Regional Supplements",
      body: [
        "EEA/UK supplement: processing may rely on consent, contract, legal obligations, and legitimate interests; data subjects may lodge complaints with their supervisory authority.",
        "California supplement: InTask does not sell or share personal information for cross-context behavioral advertising and supports rights requests subject to verification.",
      ],
    },
  ];

  const cookieRows = [
    {
      cookie: "No advertising cookies",
      purpose: "InTask does not currently run ad-tracking cookies for cross-site profiling",
      duration: "N/A",
      optOut: "N/A",
    },
    {
      cookie: "Infrastructure/session cookies (if set by hosting runtime)",
      purpose: "Session continuity, routing reliability, and security",
      duration: "Session to short-lived",
      optOut: "Browser controls; some essential cookies are required for core functionality",
    },
  ];

  const processorRows = [
    {
      provider: "Supabase",
      purpose: "Database, authentication, storage, backend services",
      policy: "https://supabase.com/privacy",
    },
    {
      provider: "Paystack",
      purpose: "Payment processing and payout rails",
      policy: "https://paystack.com/privacy",
    },
    {
      provider: "Netlify",
      purpose: "Hosting and server function delivery",
      policy: "https://www.netlify.com/privacy/",
    },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updatedAt}</p>

        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          This policy is written for InTask as an account-based marketplace product. It covers profile, messaging,
          task, wallet, payment, and verification data handling.
        </p>

        <div className="mt-6 space-y-6">
          {sections.map((section) => (
            <section key={section.title} className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Cookie Details</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Cookie</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Duration</th>
                  <th className="px-3 py-2 font-medium">How to Opt Out</th>
                </tr>
              </thead>
              <tbody>
                {cookieRows.map((row) => (
                  <tr key={row.cookie} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{row.cookie}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.purpose}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.duration}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.optOut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold text-foreground">Processor Details</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Provider</th>
                  <th className="px-3 py-2 font-medium">Purpose</th>
                  <th className="px-3 py-2 font-medium">Privacy Policy</th>
                </tr>
              </thead>
              <tbody>
                {processorRows.map((row) => (
                  <tr key={row.provider} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{row.provider}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.purpose}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <a href={row.policy} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                        {row.policy}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-8 text-xs leading-6 text-muted-foreground">
          Legal note: this page is provided as a product policy baseline and should be reviewed by qualified legal counsel for
          jurisdiction-specific compliance obligations.
        </p>

        <div className="mt-6">
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
