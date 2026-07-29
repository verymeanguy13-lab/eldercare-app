# ARCHITECTURE.md — Eldercare Coordination App

_Last updated: Session 2 (complete)_

## What this app is
A Taiwan-focused family elder-care coordination app. Adult children
coordinate care for elderly parents; parents interact via LINE
(LIFF app / notifications). Working name TBD.

## Stack
- **Framework**: Next.js (App Router, TypeScript), deployed on Vercel
- **Database**: Neon Postgres (serverless), accessed via `@neondatabase/serverless`
  v1.x — no ORM. Pattern: a single `queryUnsafe(sql, params)` helper in
  `lib/db.ts` that returns rows as a plain array (not `.rows`).
- **Parent-facing / notifications**: LINE Messaging API + LIFF (Phase 2,
  needs its own separate LINE channel — see note below)
- **Payments**: NewebPay
- **Dev workflow**: VS Code locally + PowerShell (`git add`, `git commit`,
  `git push`) → GitHub → Vercel auto-deploy.
- **Repo**: public at github.com/verymeanguy13-lab/eldercare-app — Claude
  can browse this directly in future sessions to verify file contents,
  though it can only fetch a URL already surfaced in the conversation (a
  search result or a link already seen), not guess a file path cold.

## Data model (Session 2)
- **`circles`** — one row per family. Holds `tier` (`free`/`paid`) from
  day one so freemium gating (Session 24) never needs a schema migration
  to add it.
- **`members`** — one row per real person using the app (not the cared-for
  elder — they interact via LINE in Phase 2, not as a `member` row).
- **`cared_for_profiles`** — one row per elderly person being cared for.
  Modeled as its own table (not a column on `circles`) specifically so one
  circle can hold MULTIPLE cared-for people (e.g. both parents) without
  any future restructuring.
- **`circle_memberships`** — join table connecting members to circles,
  one row per (circle, member) pair, carrying a `role`
  (admin/family_member/caregiver/viewer). This is what allows a person to
  belong to more than one circle, and a circle to have members with
  different permission levels.
- Every circle-scoped table carries a `circle_id` column so row-level
  scoping can be enforced consistently everywhere (in application code now;
  Session 2.5 adds a database-level backstop via Postgres RLS).

## Repo structure so far
- app/layout.tsx — root layout (html/body wrapper)
- app/globals.css — minimal global styles
- app/page.tsx — homepage; DB wiring-check page
- lib/db.ts — queryUnsafe() Neon Postgres helper
- schema.sql — full current DB schema (source of truth)
- ARCHITECTURE.md — this file
- .env.example — documents required env vars (no real secrets)
- .env.local — real local secrets (gitignored, never committed)
- .gitignore
- next.config.mjs
- package.json
- tsconfig.json
- README.md

## Conventions to keep consistent in every future session
- DB access: always through queryUnsafe() from lib/db.ts. Always use
  parameterized queries ($1, $2, ...) — never string-concatenate user
  input into SQL.
- Components: default to Server Components. Only add 'use client' when a
  file genuinely needs browser interactivity.
- File delivery: every session, only files that changed are given in full.
- Path alias: @/ maps to the repo root (e.g. @/lib/db).
- Non-string/number values returned from Postgres (e.g. Date objects) must
  be explicitly converted (String(value)) before being rendered in JSX.
- Every circle-scoped table needs a circle_id column — this is the
  enforcement seam every permission check in the app will rely on.
- Primary keys are UUIDs (gen_random_uuid()) throughout, not serial
  integers — avoids leaking row counts/order and matches typical
  multi-tenant SaaS practice.

## Environment variables
| Variable | Where it lives | Purpose |
|---|---|---|
| `NEON_DATABASE_URL` | Vercel env vars + `.env.local` | Neon Postgres connection string |
| `LINE_CHANNEL_SECRET` | same | LINE channel secret (Session 13+) |
| `LINE_CHANNEL_ACCESS_TOKEN` | same | LINE channel access token (Session 13+) |
| `NEWEBPAY_MERCHANT_ID` | same | NewebPay merchant ID (Session 23+) |
| `NEWEBPAY_HASH_KEY` | same | NewebPay hash key (Session 23+) |
| `NEWEBPAY_HASH_IV` | same | NewebPay hash IV (Session 23+) |

## LINE channel note (relevant from Session 13 onward)
This app needs its OWN separate LINE Provider + Messaging API channel,
distinct from other existing projects. No action needed until Session 13.

## Design decisions & reasoning
- **No ORM**: consistency with the existing TaiwanScreen project; simpler
  mental model. Trade-off: schema.sql is manually kept in sync, no
  compile-time schema safety.
- **@neondatabase/serverless over pg**: works over HTTP, fits Vercel's
  serverless functions.
- **force-dynamic on pages reading live DB data**: prevents Next.js from
  caching a stale snapshot at build time.
- **cared_for_profiles as its own table, not a column on circles**: the
  whole point is supporting multiple cared-for people per circle from day
  one — retrofitting this later would mean a real migration, not a
  addition, so it's built correctly now while the schema is still small.
- **tier column on circles from Session 2, not deferred**: the product's
  whole monetization model (Session 24) is usage-based freemium gating,
  which needs a place to check "is this circle paid" from the very first
  feature that enforces a cap (Session 3's member-join flow). Adding it
  now avoids a migration later.
- **UUID primary keys via pgcrypto's gen_random_uuid()**: standard choice
  for multi-tenant apps; avoids sequential-ID guessing as an attack vector
  once real auth/permissions exist.

## Known technical debt
- **No Row-Level Security yet**: circle-scoping is currently enforced only
  by the application remembering to filter by circle_id in every query.
  This is a real gap — Session 2.5 (next) adds a database-level backstop
  via Postgres RLS specifically so an app-code bug can never leak another
  family's data. Until then, no application code exists yet that queries
  this data, so there's no live exposure — but this should not be treated
  as "done" until Session 2.5 lands.
- **Package version pinning** (from Session 1): resolved, but a reminder
  to verify package versions against current docs rather than assuming a
  remembered version number is current, in future sessions too.

## Deferred ideas (not built yet, not forgotten)
- Row-Level Security as a database-level backstop (Session 2.5 — next)
- Auth (Session 3)
- LINE webhook + LIFF integration (Session 13+)
- Payments via NewebPay (Session 23+)
- Migrations story: currently manual SQL run in Neon's console; revisit
  if schema complexity grows.

## Security considerations
- All secrets live only in Vercel env vars (production) and `.env.local`
  (local dev, gitignored).
- SQL injection prevented via parameterized queries through
  `queryUnsafe(sql, params)`.
- Circle-scoping currently application-level only — see "Known technical
  debt" above. No RLS yet.
- LINE webhook signature verification and NewebPay hash verification not
  yet implemented.

## Performance considerations
- Indexes added on circle_memberships(circle_id), circle_memberships
  (member_id), and cared_for_profiles(circle_id) — these cover the two
  lookup directions the app will do constantly ("who's in this circle" /
  "which circles is this person in") and the common "get this circle's
  cared-for people" query. Revisit once real query patterns from Session
  3+ exist.

## Session log
- **Session 1 (complete)**: Repo scaffold, Neon/Vercel/GitHub wiring,
  local VS Code dev environment.
- **Session 2 (complete)**: Data model v1 — circles, members,
  cared_for_profiles, circle_memberships tables with indexes and seed
  data. Verified via Neon SQL Editor (SELECT * FROM circles; returned the
  expected seed row).