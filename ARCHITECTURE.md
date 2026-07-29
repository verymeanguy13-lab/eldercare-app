# ARCHITECTURE.md — Eldercare Coordination App

_Last updated: Session 2.5 (complete)_

## What this app is
A Taiwan-focused family elder-care coordination app. Adult children
coordinate care for elderly parents; parents interact via LINE
(LIFF app / notifications). Working name TBD.

## Stack
- **Framework**: Next.js (App Router, TypeScript), deployed on Vercel
- **Database**: Neon Postgres (serverless), accessed via `@neondatabase/serverless`
  v1.x — no ORM. Pattern: a single `queryUnsafe(sql, params)` helper in
  `lib/db.ts` that returns rows as a plain array (not `.rows`).
- **Parent-facing / notifications**: LINE Messaging API + LIFF (Phase 2)
- **Payments**: NewebPay
- **Dev workflow**: VS Code locally + PowerShell → GitHub → Vercel auto-deploy.
- **Repo**: public at github.com/verymeanguy13-lab/eldercare-app.

## Data model (Session 2)
- **`circles`** — one row per family. `tier` (free/paid) present from day one.
- **`members`** — one row per real person using the app.
- **`cared_for_profiles`** — one row per elderly person being cared for;
  a circle can hold multiple.
- **`circle_memberships`** — join table, member↔circle with a `role`.

## Row-Level Security (Session 2.5)
Every circle-scoped table (circles, cared_for_profiles, circle_memberships,
members) now has RLS enabled with policies enforcing "you can only see rows
belonging to a circle you're a member of." This is a DATABASE-LEVEL
backstop underneath application-level checks — even a future bug in the
app's own permission-checking code cannot leak another family's data,
because Postgres itself refuses to return the rows.

**How the database knows who's asking**: a Postgres session variable,
`app.current_member_id`, is set per-connection via
`SET app.current_member_id = '<uuid>';`. All RLS policies check this
value. **Session 3's auth system is responsible for setting this on every
real request** — this is a hard dependency, not optional.

**IMPORTANT constraint for Session 3, flagged now**: `lib/db.ts` uses
Neon's HTTP-based driver, where each `.query()` call is an independent
HTTP request with no memory of a previous "SET" between calls. Setting
`app.current_member_id` and then running the actual query MUST be
bundled together using Neon's `sql.transaction([...])` feature so they
travel as one atomic unit — otherwise the session variable won't be in
effect when the real query runs, silently breaking the RLS protection
Session 2.5 built. This needs to be a core part of how `queryUnsafe` (or
a new circle-scoped variant of it) works from Session 3 onward.

**Why a separate `app_user` role exists**: Neon's default connection role
is the table owner, and table owners bypass RLS by default (otherwise
routine admin work would lock itself out). `app_user` is a deliberately
lower-privileged role that RLS actually applies to — this is the role the
real application will connect as, once Session 3 wires its password into
`NEON_DATABASE_URL` (a new connection string using `app_user`'s
credentials, separate from the owner connection string used for admin/
migration work).

**The recursion gotcha (for future sessions adding new circle-scoped
tables)**: a policy that queries `circle_memberships` directly, on a
policy attached to `circle_memberships` itself, causes infinite recursion
(Postgres error 42P17). The fix used here: a `SECURITY DEFINER` helper
function (`my_circle_ids()`) that looks up the current member's circles
while bypassing RLS internally, so policies call the function instead of
querying the table directly. **Any future table needing similar
recursive-feeling policies should reuse `my_circle_ids()`, not
re-implement a direct subquery.**

**Verified via**: a real control-group circle ("Wang Family") that
genuinely exists in the database. Querying as `app_user` with
`app.current_member_id` set to a real Chen Family member returned ONLY
Chen Family; the identical query run back as the table owner returned
both circles. This proves the restriction is enforced by Postgres itself,
independent of the fact that no application code exists yet to add its
own filtering.

## Repo structure so far
- app/layout.tsx — root layout
- app/globals.css — minimal global styles
- app/page.tsx — homepage; DB wiring-check page
- lib/db.ts — queryUnsafe() Neon Postgres helper (NOTE: does not yet set
  app.current_member_id per request — this is Session 3's job, see RLS
  section above)
- schema.sql — full current DB schema (source of truth)
- ARCHITECTURE.md — this file
- .env.example / .env.local
- .gitignore / next.config.mjs / package.json / tsconfig.json / README.md

## Conventions to keep consistent in every future session
- DB access: always through queryUnsafe() from lib/db.ts. Always use
  parameterized queries.
- Components: default to Server Components.
- File delivery: only files that changed, given in full.
- Path alias: @/ maps to the repo root.
- Non-string/number Postgres values (e.g. Date) must be explicitly
  converted before rendering in JSX.
- Every circle-scoped table needs a circle_id column AND, per Session
  2.5's pattern, an RLS policy using my_circle_ids() — not a fresh
  direct subquery on circle_memberships.
- Primary keys are UUIDs (gen_random_uuid()) throughout.

## Environment variables
| Variable | Where it lives | Purpose |
|---|---|---|
| `NEON_DATABASE_URL` | Vercel env vars + `.env.local` | Currently the OWNER connection string. Session 3 will need to decide: switch this to app_user's credentials, or add a second variable for the app-facing connection, keeping owner creds for migrations only. Flagging this decision point for Session 3, not deciding it here. |
| `LINE_CHANNEL_SECRET` | same | LINE channel secret (Session 13+) |
| `LINE_CHANNEL_ACCESS_TOKEN` | same | LINE channel access token (Session 13+) |
| `NEWEBPAY_MERCHANT_ID` | same | NewebPay merchant ID (Session 23+) |
| `NEWEBPAY_HASH_KEY` | same | NewebPay hash key (Session 23+) |
| `NEWEBPAY_HASH_IV` | same | NewebPay hash IV (Session 23+) |

## Where are my secrets (running list)
- Neon dashboard: database connection strings, `app_user` role password
  (saved separately in the person's own password manager, not in this repo)
- Vercel dashboard: all environment variables, deployment settings
- GitHub: source code (public repo)

## LINE channel note (relevant from Session 13 onward)
This app needs its OWN separate LINE Provider + Messaging API channel,
distinct from other existing projects.

## Design decisions & reasoning
- **No ORM**: consistency with the TaiwanScreen project.
- **@neondatabase/serverless over pg**: HTTP-based, fits Vercel serverless.
- **force-dynamic on pages reading live DB data**: prevents stale
  build-time caching.
- **cared_for_profiles as its own table**: supports multiple cared-for
  people per circle without future restructuring.
- **tier column on circles from Session 2**: avoids a migration when
  Session 24's freemium gating needs it.
- **UUID primary keys**: standard for multi-tenant apps, avoids
  sequential-ID guessing.
- **RLS as a backstop, not the only layer (Session 2.5)**: application-
  level checks (Session 3's requireCircleMember) are still the PRIMARY,
  more specific enforcement (they can express role-based nuance RLS
  policies here don't attempt, like "caregiver can't see documents").
  RLS exists specifically so a bug in that application logic degrades to
  "nothing shown" rather than "another family's data leaked."

## Known technical debt
- **queryUnsafe doesn't set app.current_member_id yet**: RLS policies
  exist and are proven correct, but lib/db.ts's current queryUnsafe
  function has no concept of "who's asking" yet — it still runs as the
  unrestricted owner role. This is intentional and expected at this
  stage (no auth exists yet), but Session 3 MUST address this — see the
  RLS section above for the exact mechanism (sql.transaction bundling)
  it needs to use.
- Package version pinning (Session 1): resolved.

## Deferred ideas (not built yet, not forgotten)
- Auth (Session 3) — must also wire up app_user connection + the
  sql.transaction pattern described above
- LINE webhook + LIFF integration (Session 13+)
- Payments via NewebPay (Session 23+)
- Migrations story: currently manual SQL run in Neon's console.

## Security considerations
- Two layers of circle isolation now exist in principle: RLS (database,
  Session 2.5, proven working) and application-level checks (Session 3,
  not yet built). Until Session 3 lands, RLS alone is NOT sufficient
  protection for a real app, because no code yet sets
  app.current_member_id per request — the app currently just uses the
  unrestricted owner connection for everything. This is fine for a
  wiring-check page with no real user data; it must change before any
  real feature ships.
- All secrets live only in Vercel env vars (production) and `.env.local`
  (local dev, gitignored).
- SQL injection prevented via parameterized queries.
- LINE webhook signature verification and NewebPay hash verification not
  yet implemented.

## Performance considerations
- Indexes on circle_memberships(circle_id), circle_memberships(member_id),
  cared_for_profiles(circle_id).
- RLS policies each involve a subquery via my_circle_ids() — fine at
  current scale; worth revisiting query plans (EXPLAIN ANALYZE) once
  real data volume exists, since RLS subqueries can sometimes defeat
  index usage if not written carefully.

## Session log
- **Session 1 (complete)**: Repo scaffold, Neon/Vercel/GitHub wiring,
  local VS Code dev environment.
- **Session 2 (complete)**: Data model v1 — circles, members,
  cared_for_profiles, circle_memberships, with indexes and seed data.
- **Session 2.5 (complete)**: Row-Level Security on all four tables.
  Fixed an infinite-recursion bug (circle_memberships policy querying
  itself) via a SECURITY DEFINER helper function, my_circle_ids().
  Verified with a real control-group circle: RLS correctly hides it from
  an unrelated member, while the table owner sees everything. Flagged a
  hard dependency for Session 3 (the sql.transaction bundling needed for
  Neon's HTTP driver to make SET app.current_member_id actually take
  effect).