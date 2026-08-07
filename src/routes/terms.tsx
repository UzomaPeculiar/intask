import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  const updatedAt = "August 6, 2026";

  const sections = [
    {
      title: "1. Agreement",
      body: [
        "By accessing or using InTask, you agree to be bound by these Terms, our Privacy Policy, and our platform safety and moderation rules.",
        "If you do not agree to these Terms, do not use the service.",
      ],
    },
    {
      title: "2. The Service",
      body: [
        "InTask is a marketplace platform where users can post tasks, apply to tasks, collaborate, complete deliveries, and use escrow-linked payment and wallet workflows.",
        "Core use of the platform requires an account. Platform access is generally free, while transaction-related fees may apply as disclosed in-product.",
        "To keep the service fair and available for all users, InTask may apply anti-abuse, moderation, and operational limits.",
      ],
    },
    {
      title: "3. Eligibility",
      body: [
        "You must be at least 18 years old, or the age of majority in your jurisdiction, to use InTask for paid marketplace activity.",
        "By using InTask, you confirm that you meet the applicable age and legal-capacity requirements.",
      ],
    },
    {
      title: "4. Accounts",
      body: [
        "You must provide accurate, complete registration and profile information and keep it current.",
        "You are responsible for safeguarding account access and for all actions taken under your account.",
        "You must notify InTask promptly of unauthorized use or account compromise.",
      ],
    },
    {
      title: "5. Acceptable Use",
      body: [
        "You may not submit or distribute illegal content, child sexual abuse material, hateful content, harassment, or content that infringes intellectual property, privacy, or publicity rights.",
        "You may not scrape, crawl, reverse engineer, bypass safeguards, abuse payment flows, or automate access beyond normal intended use.",
        "You may not submit content or requests that you do not have the legal right to submit.",
        "InTask may investigate violations, block sessions or accounts, and pursue legal remedies where appropriate.",
      ],
    },
    {
      title: "6. Your Content",
      body: [
        "You retain ownership of content you submit to InTask, including profile data, task posts, messages, deliverables, and attachments.",
        "You grant InTask a limited, non-exclusive, request-scoped and service-scoped license to process, store, and display your content solely to operate the platform, including trust and safety, dispute handling, and legal compliance.",
        "You represent that you have all rights necessary to submit your content and that your submission does not violate law or third-party rights.",
      ],
    },
    {
      title: "7. Generated or Automated Platform Output",
      body: [
        "InTask may produce automated platform outputs such as moderation flags, ranking signals, or account risk indicators.",
        "You are responsible for reviewing task and payment decisions and for verifying any platform output before relying on it.",
        "InTask is not a legal, compliance, financial, or factual certification authority.",
      ],
    },
    {
      title: "8. AI Disclaimer",
      body: [
        "Where automated systems are used, outputs are probabilistic and may contain errors or false positives.",
        "InTask is a productivity and marketplace tool, not a guaranteed source of factual or legal truth.",
      ],
    },
    {
      title: "9. Third-Party Services",
      body: [
        "InTask uses third-party providers, including Supabase for backend infrastructure, Paystack for payment processing, and Netlify for hosting and server execution.",
        "Use of those integrated services may be subject to their terms and privacy policies.",
      ],
    },
    {
      title: "10. Service Availability and No SLA",
      body: [
        "Unless otherwise stated in a separate written agreement, InTask is provided on a best-effort basis without a guaranteed service-level agreement.",
        "InTask may rate-limit, modify, pause, or discontinue features at any time, including for maintenance, safety, fraud prevention, or legal compliance.",
      ],
    },
    {
      title: "11. Intellectual Property",
      body: [
        "InTask and its licensors own the platform brand, code, UI, workflows, and related intellectual property.",
        "These Terms do not grant you rights to copy, modify, distribute, or reverse engineer InTask intellectual property except as permitted by law.",
      ],
    },
    {
      title: "12. Termination",
      body: [
        "You may stop using InTask at any time.",
        "InTask may suspend or terminate access for policy violations, security risk, fraud indicators, legal requirements, or operational integrity.",
        "Sections that by their nature should survive termination remain in effect, including disclaimers, limitations, indemnity, and governing law.",
      ],
    },
    {
      title: "13. Disclaimer of Warranties",
      body: [
        "THE SERVICE IS PROVIDED ON AN AS IS AND AS AVAILABLE BASIS, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.",
        "INTASK DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR THAT AUTOMATED OUTPUTS WILL ALWAYS BE ACCURATE, COMPLETE, OR SUITABLE FOR YOUR USE CASE.",
      ],
    },
    {
      title: "14. Limitation of Liability",
      body: [
        "To the maximum extent permitted by law, InTask is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenues, data, goodwill, or business opportunity.",
        "To the extent permitted by law, InTask total liability for all claims relating to the service is limited to the greater of NGN 100,000 or the total fees paid by you to InTask in the 12 months before the claim.",
        "Some jurisdictions do not allow certain exclusions or limitations. In those jurisdictions, liability is limited to the maximum extent permitted by law.",
      ],
    },
    {
      title: "15. Indemnity",
      body: [
        "You will indemnify and hold harmless InTask, its affiliates, and personnel from claims, damages, liabilities, losses, and expenses (including reasonable legal fees) arising from your content, your conduct, your use of the platform, or your violation of these Terms or applicable law.",
      ],
    },
    {
      title: "16. Governing Law and Venue",
      body: [
        "These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflict-of-law principles.",
        "Disputes will be brought exclusively in the competent courts of Lagos State, Nigeria.",
        "If a party cannot lawfully bring a claim in Lagos due to mandatory jurisdiction rules, the parties consent to the courts of Abuja, Nigeria as an alternate forum.",
      ],
    },
    {
      title: "17. Changes",
      body: [
        "We may update these Terms from time to time and will post material changes with a new Last updated date.",
        "Your continued use of InTask after changes are posted constitutes acceptance of the revised Terms.",
      ],
    },
    {
      title: "18. Contact",
      body: [
        "Terms and support inquiries: support@intask.ng.",
        "Copyright and takedown notices: support@intask.ng with the subject line Copyright Notice.",
        "InTask aims to respond to legal and policy requests within 30 days.",
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {updatedAt}</p>

        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          These Terms apply to InTask as a two-sided digital marketplace for individuals, students, alumni, and companies.
          If you are using InTask on behalf of an organization, you represent that you have authority to bind that organization.
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

        <div className="mt-6">
          <Link to="/" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
