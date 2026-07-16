## InTask MVP — Build Plan

A task marketplace for Nigerian students. Mobile-first (375px), Inter font, blue/green/amber palette, Naira-only, Paystack escrow.

### Phase 1 — Foundations
- Enable **Lovable Cloud** (auth, Postgres, storage, realtime, server functions).
- Design system in `src/styles.css`: oklch tokens for the brand palette, Inter via `<link>` in `__root.tsx`, 8px/12px radii, subtle card shadow, mobile-first base.
- Shared shell: bottom nav (Home/Browse/Messages/Profile), top bar, mode toggle, badges (Verified Student, Alumni, Business), Naira formatter, empty/loading states.

### Phase 2 — Auth & onboarding
- Supabase Auth (email/password). 6-step signup with step-pill indicator, role selection, university dropdown (top ~50 NG unis + Other), verification (email OTP via server fn, or ID upload to storage with `pending_review`), skills picker (max 5), welcome card.
- `_authenticated/route.tsx` gate; `/auth` public route; role-based redirect after login.

### Phase 3 — Schema (migrations + GRANTs + RLS)
Tables per spec: `profiles` (base), `student_profiles`, `company_profiles`, `tasks`, `applications`, `transactions`, `conversations`, `messages`, `reviews`, `notifications`. `user_roles` table + `has_role()` for admin/dispute review. RLS scoped to `auth.uid()` with `service_role` for escrow release.

### Phase 4 — Core loop (in build order from brief)
1. Dashboard shell + Find/Post mode toggle, stats, filter chips.
2. Task feed + task detail.
3. Post-a-task form (single scroll) + success.
4. Apply sheet + applications.
5. Applicants list + Accept confirmation.
6. **Paystack escrow** — initialize via server fn with `PAYSTACK_SECRET_KEY`; webhook at `/api/public/webhooks/paystack` (signature verified) flips transaction to `in_escrow`. Release fn deducts 8% fee and marks `released`. Test keys.
7. Messages: conversations + chat with Supabase Realtime, WhatsApp deep link.
8. Delivery submit → poster approve/revise → release payment → mutual review.
9. Profile page (own + public), portfolio CRUD.
10. Notifications (Realtime, unread badge).
11. Dispute form.
12. Landing page (hero, how-it-works, categories, trust, footer).

### Phase 5 — Polish
- Loading + empty states on every async surface.
- Escrow reassurance copy near every money mention.
- Verified badge on every student card/row/review.
- Naira formatting helper used everywhere.
- SEO: per-route `head()`, sitemap.xml, robots.txt.

### Technical notes
- TanStack Start file-based routes under `src/routes/`; auth-gated app under `src/routes/_authenticated/`; public landing/auth top-level.
- Server fns in `src/lib/*.functions.ts` with `requireSupabaseAuth`; Paystack webhook as a server route under `src/routes/api/public/`.
- Paystack secret stored via `add_secret` (`PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET`); public key in code.
- File uploads (student ID, delivery files, portfolio images) via Supabase Storage with per-user RLS.

### Secrets I'll request from you
- `PAYSTACK_SECRET_KEY` (test `sk_test_...`)
- Paystack **public** key (paste in chat, goes in code)

### Scope check before I start
This is a very large MVP (~17 routes, payments, realtime, file uploads). I'll build it in the order above and ship Phase 1+2+3 first, then iterate. Confirm you want the full thing built in one go, or I can stop after each phase for review.

### Out of scope (per brief)
AI matching, subscriptions, video profiles, social feed, SMS, mobile app, social login.
