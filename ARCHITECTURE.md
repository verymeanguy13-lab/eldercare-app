# ARCHITECTURE.md — Eldercare Coordination App

_Last updated: Session 3 (complete)_

## What this app is
A Taiwan-focused family elder-care coordination app. Adult children
coordinate care for elderly parents; parents interact via LINE
(LIFF app / notifications). Working name TBD.

## Stack
- **Framework**: Next.js (App Router, TypeScript), deployed on Vercel
- **Database**: Neon Postgres (serverless), accessed via `@neondatabase/serverless`
  v1.x — no ORM. Two connections: owner-level (`queryUnsafe`, bypasses
  RLS) and app_user-level (`queryAsMember`, RLS-enforced).
- **Auth**: Passwordless magic link email via Resend. Sessions are random
  tokens in a `sessions` table, stored in an HTTP-only cookie — no JWTs.
- **Parent-facing / notifications**: LINE Messaging API + LIFF (Phase 2)
- **Payments**: NewebPay
- **Dev workflow**: VS Code locally + PowerShell → GitHub → Vercel auto-deploy.
- **Repo**: public at github.com/verymeanguy13-lab/eldercare-app.

## Data model
- **`circles`** — one row per family. `tier` (free/paid), `invite_code`
  (added Session 3, used for the join flow).
- **`members`** — one row per real person; `email` now UNIQUE (Session 3),
  since it's the identity magic-link auth resolves to.
- **`cared_for_profiles`** — one row per elderly person being cared for;
  a circle can hold multiple.
- **`circle_memberships`** — join table, member↔circle with a `role`.
- **`sessions`**, **`magic_link_tokens`** (Session 3) — auth bookkeeping,
  deliberately NOT circle-scoped or RLS-protected (see below).

## Row-Level Security (Session 2.5, wired into real code in Session 3)
`queryAsMember(memberId, query, params)` in `lib/db.ts` bundles setting
`app.current_member_id` and running the actual query into one
`sql.transaction([...])` call, because Neon's HTTP driver treats each
`.query()` as an independent request with no memory between calls. This
is now ACTIVELY used (dashboard's circle list, `requireCircleMember`),
not just designed-but-unused as it was at the end of Session 2.5.

**Deliberate exception**: `app/api/circles/join/route.ts` looks up a
circle by invite code using the OWNER connection (`queryUnsafe`), not
`queryAsMember` — because RLS would correctly block seeing a circle
you're not yet a member of, but the invite code itself is the credential
proving the right to join. This is intentional, not a bypass of the
security model.

**Auth tables (`sessions`, `magic_link_tokens`) have no RLS** — they're
not circle-scoped, and access is controlled by possessing the secret
token itself. They're only ever touched via `queryUnsafe` (owner
connection), never `queryAsMember`.

## Auth flow (Session 3)
1. User submits email at `/login` → `POST /api/auth/request-link`
   creates a `magic_link_tokens` row, emails a link via Resend.
2. User clicks link → `GET /api/auth/verify?token=...` validates the
   token (single-use, 15-min expiry), finds-or-creates a `members` row
   by email, creates a `sessions` row, sets an HTTP-only cookie, redirects
   to `/dashboard`.
3. `lib/current-member.ts`'s `getCurrentMemberId()` reads that cookie and
   looks up the session on every subsequent request.
4. `lib/require-circle-member.ts`'s `requireCircleMember(circleId,
   minRole)` is the reusable gate every future circle-scoped route should
   call FIRST — it confirms sign-in AND role, using the RLS-protected
   `queryAsMember` connection, then returns the memberId for the route to
   use in its own queryAsMember calls.
5. Role hierarchy (lowest to highest): viewer < caregiver < family_member
   < admin. `hasRequiredRole()` in the same file does the comparison.

## Circle creation & joining (Session 3)
- `POST /api/circles` — creates a circle, generates an 8-hex-char invite
  code, makes the creator `admin`. Uses queryUnsafe (owner) since no
  circle_id exists to scope by yet at creation time.
- `POST /api/circles/join` — looks up circle by invite code (owner
  connection, deliberate RLS exception, see above), checks membership cap
  via `lib/caps.ts`, inserts a `family_member` row.
- `lib/caps.ts`'s `checkMemberCap()` does ONLY cap math, not access
  control — callers must already have a legitimate reason to know the
  circleId (via requireCircleMember or a validated invite code) before
  calling it.

## Repo structure so far
- app/layout.tsx, app/globals.css, app/page.tsx
- app/login/page.tsx — magic link request form
- app/dashboard/page.tsx (server) + dashboard-client.tsx (client) —
  circle list, create/join forms
- app/api/auth/request-link, verify, logout — auth routes
- app/api/circles, circles/join — circle management routes
- lib/db.ts — queryUnsafe (owner) + queryAsMember (RLS-enforced)
- lib/auth.ts — magic link + session token logic
- lib/current-member.ts — reads session cookie → memberId
- lib/require-circle-member.ts — requireCircleMember gate + role hierarchy
- lib/caps.ts — free-tier member cap logic (extended in Session 24)
- tests/require-circle-member.test.ts, tests/caps.test.ts — Vitest unit
  tests for the pure-logic pieces (role comparison, cap math)
- schema.sql, ARCHITECTURE.md, .env.example, .env.local (gitignored)
- .gitignore, next.config.mjs, package.json, tsconfig.json, README.md

## Conventions to keep consistent in every future session
- DB access: queryUnsafe (owner, bypasses RLS — auth/admin/invite-lookup
  only) vs queryAsMember (app_user, RLS-enforced — all circle-scoped data
  once a member is known). Getting this wrong in either direction is a
  real security bug, not just a style issue.
- Every circle-scoped route should call requireCircleMember() FIRST, then
  use the memberId it returns for queryAsMember calls.
- Components: default to Server Components; 'use client' only where
  interactivity is genuinely needed (forms, buttons with handlers).
- File delivery: only files that changed, given in full.
- Path alias: @/ maps to the repo root.
- Non-string/number Postgres values (e.g. Date) must be explicitly
  converted before rendering in JSX.
- Primary keys are UUIDs throughout.
- Pure logic (role comparisons, cap math) lives in small, dependency-free
  functions (hasRequiredRole, isWithinMemberCap) separate from the
  DB-querying wrapper functions around them, specifically so they're
  unit-testable with Vitest without needing a real database connection.

## Environment variables
| Variable | Where | Purpose |
|---|---|---|
| `NEON_DATABASE_URL` | Vercel + `.env.local` | Owner connection (queryUnsafe) |
| `NEON_APP_USER_DATABASE_URL` | Vercel + `.env.local` | app_user connection (queryAsMember, RLS-enforced) |
| `RESEND_API_KEY` | Vercel + `.env.local` | Sends magic link emails |
| `NEXT_PUBLIC_APP_URL` | Vercel + `.env.local` | Base URL for magic link generation — MUST differ between local (`http://localhost:3000`) and production (real Vercel URL); mixing these up breaks the login flow (see Known technical debt) |
| `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | same | Session 13+ |
| `NEWEBPAY_MERCHANT_ID` / `HASH_KEY` / `HASH_IV` | same | Session 23+ |

## Where are my secrets (running list)
- Neon dashboard: connection strings, app_user role password
- Resend dashboard: API key (shared account across this + another
  project — each project has its own separately-named key)
- Vercel dashboard: all environment variables
- GitHub: source code (public repo)

## LINE channel note (relevant from Session 13 onward)
This app needs its OWN separate LINE Provider + Messaging API channel,
distinct from other existing projects.

## Design decisions & reasoning
- **Magic link over passwords or NextAuth**: no password storage/reset
  burden for a non-technical family user base; avoids fighting NextAuth's
  ORM-shaped adapter expectations against this project's hand-rolled
  schema. Costs: an email-sending dependency (Resend) and a slightly
  unusual session mechanism to understand, versus a more "standard" but
  heavier auth library.
- **Sessions as plain DB tokens, not JWTs**: same reasoning as no-ORM
  elsewhere in this project — a database lookup is a pattern already used
  everywhere else, versus introducing JWT signing/verification as a new
  concept.
- **Two separate DB connections (owner vs app_user)**: RLS (Session 2.5)
  only applies to non-owner roles; queryAsMember is how that protection
  actually gets used by real application code.
- **Invite-code join deliberately bypasses RLS**: the code IS the
  credential; this is documented explicitly in both this file and the
  route's own code comment specifically so a future session doesn't
  "fix" it into requireCircleMember and break the join flow entirely
  (you can't require membership in the circle you're trying to join).
- **checkMemberCap does cap math only, not access control**: keeps a
  single responsibility per function; access control lives in
  requireCircleMember or the invite-code check, not duplicated into caps.ts.

## Known technical debt
- **Resend's shared testing address (`onboarding@resend.dev`) can only
  send to the ONE email address registered on the Resend account itself**
  — not just "your own domain," the literal single address. This meant
  Session 3 could NOT fully test the join-flow and free-tier cap (3
  members) with genuinely separate accounts; only the "already a member"
  rejection path was verified with a real second login. A verified
  sending domain (natural to set up alongside Session 13's LINE work,
  since that also benefits from professional branding) is needed before
  real multi-user testing — or before any real family uses this app, full
  stop.
- **Free-tier member cap (3) is unverified in practice**, though the pure
  logic (isWithinMemberCap) IS unit-tested via Vitest — the gap is
  specifically the end-to-end route behavior with real distinct accounts,
  not the underlying math.
- **NEXT_PUBLIC_APP_URL must be manually kept different between
  `.env.local` (localhost) and Vercel (production)** — this caused a real
  bug this session (a magic link generated locally pointed at production,
  404ing). Worth double-checking this value specifically anytime login
  links misbehave in the future.
- **Invite codes are short** (8 hex characters, 32 bits) — fine for
  testing, worth lengthening or rate-limiting the join endpoint before
  real families use this, since it's currently guessable at scale.
- **Package version pinning** (Session 1): resolved.

## Deferred ideas (not built yet, not forgotten)
- Verified Resend sending domain — needed for both real deliverability
  and to unblock full multi-account testing (natural to pair with
  Session 13)
- LINE webhook + LIFF integration (Session 13+)
- Payments via NewebPay (Session 23+)
- Migrations story: currently manual SQL run in Neon's console.
- Pulling the free-tier cap number out of caps.ts's hardcoded constant
  into config/a tier table (Session 24, when billing exists)

## Security considerations
- Two real layers of circle isolation now BOTH active: RLS (database,
  proven in 2.5) AND application-level requireCircleMember (Session 3).
  The queryAsMember/queryUnsafe split is the load-bearing convention that
  keeps this working — see "Conventions" above.
- Sessions: HTTP-only, secure, sameSite=lax cookies; 30-day expiry;
  magic link tokens: single-use, 15-minute expiry.
- SQL injection prevented via parameterized queries throughout.
- Invite codes are the join credential — see "Known technical debt" re:
  length/rate-limiting before real use.
- LINE webhook signature verification and NewebPay hash verification not
  yet implemented.
- **A real secret (Resend API key) and a real DB password were pasted
  into this Claude conversation during debugging.** Recommended: rotate
  both (new Resend API key + `ALTER ROLE app_user PASSWORD '...'` in
  Neon) before this app handles any real family's data — not urgent
  today, but shouldn't be forgotten indefinitely either.

## Performance considerations
- Indexes on circle_memberships(circle_id), circle_memberships(member_id),
  cared_for_profiles(circle_id).
- RLS policies use a SECURITY DEFINER helper function (my_circle_ids())
  rather than inline subqueries, both for correctness (avoids recursion)
  and to keep query plans predictable — worth an EXPLAIN ANALYZE pass
  once real data volume exists.

## Session log
- **Session 1 (complete)**: Repo scaffold, Neon/Vercel/GitHub wiring,
  local VS Code dev environment.
- **Session 2 (complete)**: Data model v1.
- **Session 2.5 (complete)**: Row-Level Security, designed and proven via
  direct SQL testing (not yet wired into application code).
- **Session 3 (complete)**: Magic link auth (Resend), sessions, circle
  creation, invite-code join flow, free-tier member cap (logic verified
  via unit tests; full end-to-end multi-account test blocked by Resend's
  single-recipient testing restriction — flagged as technical debt).
  queryAsMember wired into real routes for the first time, activating
  Session 2.5's RLS design in actual application code.