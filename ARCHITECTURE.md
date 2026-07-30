# ARCHITECTURE.md — Eldercare Coordination App

_Last updated: Session 4 (complete)_

## What this app is
A Taiwan-focused family elder-care coordination app. Adult children
coordinate care for elderly parents; parents interact via LINE
(LIFF app / notifications). Working name TBD.

## Stack
- **Framework**: Next.js (App Router, TypeScript), deployed on Vercel
- **Database**: Neon Postgres, `@neondatabase/serverless` v1.x — no ORM.
  Two connections: owner-level (queryUnsafe, bypasses RLS) and
  app_user-level (queryAsMember, RLS-enforced).
- **Auth**: Passwordless magic link email via Resend. Sessions are random
  tokens in a `sessions` table, HTTP-only cookie.
- **File storage**: Vercel Blob, PRIVATE access mode (Session 4) —
  see dedicated section below, this has real implementation implications.
- **Parent-facing / notifications**: LINE Messaging API + LIFF (Phase 2)
- **Payments**: NewebPay
- **Dev workflow**: VS Code locally + PowerShell → GitHub → Vercel auto-deploy.
- **Repo**: public at github.com/verymeanguy13-lab/eldercare-app.
- **Vercel CLI now in use** (Session 4) — `vercel login`, `vercel link`,
  `vercel env pull .env.local` — needed specifically for Blob's OIDC
  credential flow. This is a genuinely new tool beyond the GitHub-web/VS
  Code workflow used through Session 3; see "Vercel Blob" section below
  for why, and why local dev ended up using a static token instead of
  OIDC despite this setup.

## Data model
- **`circles`**, **`members`**, **`cared_for_profiles`**,
  **`circle_memberships`** — see Session 2/2.5 notes below, unchanged
  this session.
- **`sessions`**, **`magic_link_tokens`** (Session 3) — auth bookkeeping,
  not RLS-protected (see Session 3 notes).
- **`posts`** (Session 4) — one row per feed post: circle_id,
  author_member_id, text, photo_url. `photo_url` stores a Blob
  **pathname** (e.g. `posts/{circleId}/{timestamp}-{filename}`), NOT a
  usable URL — private blobs have no directly-loadable URL. RLS-protected
  via the same `my_circle_ids()` pattern as every other circle-scoped
  table.

## Vercel Blob — private storage (Session 4)
**Why private, not public**: this app's photos can include genuinely
sensitive content (a parent in a care setting, medication labels, home
interiors) — a "public" blob is permanently viewable by anyone who ever
obtains its URL, no login required, forever. That's an unacceptable
exposure for this kind of app, so private storage was chosen even though
it costs real implementation complexity (below), unlike every other
"just make it work" default in this project so far.

**What private storage actually requires, that public wouldn't**:
1. Files aren't referenceable by a plain `<img src="...">` — they need to
   be fetched through a route that authenticates the request first, then
   streams the file back. This is `/api/circles/[circleId]/posts/photo/route.ts`
   — it calls `requireCircleMember` before ever touching Blob, AND
   separately validates the requested pathname actually starts with
   `posts/{circleId}/`, specifically to stop someone who's a legitimate
   member of circle A from guessing at circle B's photo paths.
2. Authentication to Vercel Blob itself needs credentials. Vercel's
   modern approach is OIDC (short-lived, auto-rotating tokens) — this
   works automatically in production with zero setup, but for LOCAL
   development, this session hit real, working-as-designed friction:
   Vercel's per-project OIDC setting wasn't enabled for the "development"
   environment specifically (separate from Production/Preview), and even
   after pulling an OIDC token via `vercel env pull`, a stale
   `VERCEL_OIDC_TOKEN` value sitting in `.env.local` caused the SDK to
   keep attempting (and failing) OIDC rather than falling back cleanly.

**The decision made**: rather than debug Vercel's per-environment OIDC
settings further, local development uses a STATIC `BLOB_READ_WRITE_TOKEN`
(generated from the Blob store's own Tokens page), passed EXPLICITLY via
`token: process.env.BLOB_READ_WRITE_TOKEN` in both `put()` and `get()`
calls — rather than relying on the SDK's automatic OIDC detection. This
was a pragmatic choice given real time already spent, not an ideal one:
it means local dev's file-storage credential handling is now genuinely
different from every other secret in this project's local vs. production
symmetry so far. **Production is unaffected and still gets Vercel's
automatic, more-secure OIDC handling** — this is purely a local-dev-only
divergence. Worth knowing if a future session's Blob-related code
behaves differently locally vs. deployed; check this asymmetry first.

**Package version note**: `@vercel/blob` needed to be `^2.6.1`, not the
older version originally specified — same pattern as Session 1's Neon
package version issue. General lesson reinforced twice now: verify
package versions against current npm/docs rather than trusting a
remembered number, especially for any package whose specific feature
(private storage, in this case) might postdate an older assumed version.

## Auth flow (Session 3, unchanged this session)
1. `/login` → `POST /api/auth/request-link` → magic_link_tokens row,
   Resend email.
2. Click link → `GET /api/auth/verify` → validates token, finds/creates
   member, creates session, sets cookie, redirects to `/dashboard`.
   **Cookie's `secure` flag must be `process.env.NODE_ENV === 'production'`,
   NOT a hardcoded `true`** — a hardcoded `true` silently breaks session
   persistence over local `http://localhost` (browsers won't
   store/send `secure` cookies over plain HTTP). This was a real bug hit
   and fixed in Session 4's testing, even though the code itself
   originated in Session 3.
3. `getCurrentMemberId()` reads the cookie each request.
4. `requireCircleMember(circleId, minRole)` — the gate every circle-scoped
   route calls first.

## Circle creation & joining (Session 3, unchanged this session)
- `POST /api/circles`, `POST /api/circles/join` — see Session 3 notes.
- Free-tier cap logic (lib/caps.ts) unit-tested but still NOT verified
  end-to-end with genuinely separate real accounts — see "Known technical
  debt" below, unchanged from Session 3.

## Posts / feed (Session 4)
- `GET/POST /api/circles/[circleId]/posts` — list/create posts.
  `requireCircleMember(circleId, 'viewer')` gates both; any circle member
  (any role) can post and view.
- `GET /api/circles/[circleId]/posts/photo?pathname=...` — the
  authenticated photo-serving route described above.
- `/circles/[circleId]/feed` — the actual feed page (server component
  fetches via queryAsMember, passes to a client component for the
  post/upload form).
- **Answering the "no client-supplied circleId alone determines access"
  question explicitly, since it's a recurring design principle**: circleId
  comes from the URL, but every route call is preceded by
  requireCircleMember, which checks real circle_memberships via the
  RLS-protected connection — verified in this session via direct URL
  tampering to an unrelated circle (Wang Family, Session 2.5's control
  group), which correctly redirected to /dashboard rather than exposing
  anything.

## Repo structure so far
- app/layout.tsx, globals.css, page.tsx
- app/login/page.tsx
- app/dashboard/page.tsx + dashboard-client.tsx
- app/circles/[circleId]/feed/page.tsx + feed-client.tsx (Session 4)
- app/api/auth/request-link, verify, logout
- app/api/circles, circles/join
- app/api/circles/[circleId]/posts/route.ts (Session 4)
- app/api/circles/[circleId]/posts/photo/route.ts (Session 4)
- lib/db.ts — queryUnsafe + queryAsMember
- lib/auth.ts, current-member.ts, require-circle-member.ts, caps.ts
- tests/require-circle-member.test.ts, caps.test.ts
- schema.sql, ARCHITECTURE.md, .env.example, .env.local (gitignored)
- .gitignore, next.config.mjs, package.json, tsconfig.json, README.md

## Conventions to keep consistent in every future session
- DB access: queryUnsafe (owner) vs queryAsMember (RLS-enforced) — see
  Session 3 notes, unchanged.
- Every circle-scoped route calls requireCircleMember FIRST.
- Every NEW circle-scoped table needs: a circle_id column, an RLS policy
  via my_circle_ids(), AND an explicit GRANT to app_user — this last step
  is easy to forget (it's not automatic) and was called out explicitly
  in Session 4's migration for exactly that reason.
- Files/photos: if ever storing something genuinely private, default to
  Blob's `access: 'private'` and build an authenticated serving route —
  do not default to 'public' for convenience. This session's extra
  complexity was a deliberate, justified tradeoff, not something to avoid
  next time similar data shows up (e.g. documents in a later session).
- Session cookies: `secure` must be environment-conditional, never a
  hardcoded `true`, or local testing silently breaks.
- Components: default Server Components; 'use client' only where needed.
- Path alias: @/ maps to repo root. Primary keys: UUIDs throughout.

## Environment variables
| Variable | Where | Purpose |
|---|---|---|
| `NEON_DATABASE_URL` | Vercel + `.env.local` | Owner connection |
| `NEON_APP_USER_DATABASE_URL` | Vercel + `.env.local` | app_user connection (RLS) |
| `RESEND_API_KEY` | Vercel + `.env.local` | Magic link emails |
| `NEXT_PUBLIC_APP_URL` | Vercel + `.env.local` | MUST differ: localhost locally, real URL in prod |
| `BLOB_READ_WRITE_TOKEN` | `.env.local` only (Session 4) | Static fallback token for LOCAL Blob access — NOT used in production, which relies on automatic OIDC instead |
| `BLOB_STORE_ID`, `BLOB_WEBHOOK_PUBLIC_KEY` | Vercel + `.env.local` | Auto-provisioned with the Blob store; not directly used by current code but harmless to keep |
| `VERCEL_OIDC_TOKEN` | `.env.local` (from `vercel env pull`) | Present but NOT actually relied upon by current code — see Vercel Blob section for why the static token is used instead |
| `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | same | Session 13+ |
| `NEWEBPAY_MERCHANT_ID` / `HASH_KEY` / `HASH_IV` | same | Session 23+ |

## Where are my secrets (running list)
- Neon dashboard: connection strings, app_user role password
- Resend dashboard: API key (shared account, separately-named key)
- Vercel dashboard: env vars; Blob store's own Tokens page (the static
  BLOB_READ_WRITE_TOKEN specifically — separate from the main project
  Environment Variables page)
- GitHub: source code (public repo)

## LINE channel note (relevant from Session 13 onward)
This app needs its OWN separate LINE Provider + Messaging API channel.

## Design decisions & reasoning
- Magic link over passwords/NextAuth, sessions as DB tokens not JWTs,
  two DB connections, invite-code RLS exception, cap-checking separated
  from access control — all unchanged from Session 3, see prior log.
- **Private Blob storage over public**: see dedicated section above —
  the single largest design decision and largest source of real
  implementation friction this session, made deliberately given the
  sensitivity of family care photos.
- **Static token over OIDC for local dev specifically**: pragmatic,
  time-boxed decision given real friction hit; NOT a judgment that OIDC
  is wrong — production still uses it. A future session could revisit
  properly enabling OIDC for the development environment if the token
  rotation hassle becomes annoying, but it's not urgent.

## Known technical debt
- **Local Blob auth uses a static long-lived token, diverging from
  production's OIDC** — see Vercel Blob section. Low urgency (local-only,
  doesn't affect production security posture) but worth remembering as
  an asymmetry.
- **Resend's single-recipient testing restriction** (Session 3) — still
  unresolved; free-tier cap still unverified end-to-end with real
  separate accounts. A verified sending domain would fix both this AND
  unlock proper OIDC trust configuration questions later, so there's a
  case for prioritizing it.
- **Invite codes are short** (Session 3) — unresolved.
- **Free-tier cap hardcoded constant** (Session 3) — unresolved, deferred
  to Session 24 as planned.
- **Package version pinning** — TWICE now (Neon in Session 1, Blob in
  Session 4) a specified version predated a feature the code needed.
  Worth treating this as a standing pattern: after adding ANY new
  package this project hasn't used before, a quick "is this the current
  version, and does it support the specific feature I'm using" check is
  cheap insurance against losing a debugging session to it.

## Deferred ideas (not built yet, not forgotten)
- Verified Resend sending domain (Session 13-ish, or sooner per Session
  3's Health Check note)
- Properly scoping OIDC to the development environment (optional
  cleanup, not urgent)
- LINE webhook + LIFF integration (Session 13+)
- Payments via NewebPay (Session 23+)
- Migrations story: currently manual SQL run in Neon's console.
- Cap constant → config/tier table (Session 24)

## Security considerations
- RLS + requireCircleMember, both active (Session 3), now also covering
  `posts` (Session 4).
- Private Blob storage with an authenticated serving route + explicit
  pathname-prefix validation — see Vercel Blob section.
- Sessions: HTTP-only, environment-conditional secure flag, sameSite=lax,
  30-day expiry. Magic links: single-use, 15-minute expiry.
- SQL injection prevented via parameterized queries throughout.
- A real secret (Resend API key) and DB password were pasted into this
  chat during Session 3 debugging — rotation still recommended, still
  not done, still not urgent but shouldn't be forgotten indefinitely.

## Performance considerations
- Index on posts(circle_id, created_at DESC) — matches the feed's actual
  query pattern (all posts for one circle, newest first).
- Other indexes unchanged from Session 2/2.5.

## Session log
- **Session 1 (complete)**: Repo scaffold, Neon/Vercel/GitHub wiring,
  local VS Code dev environment.
- **Session 2 (complete)**: Data model v1.
- **Session 2.5 (complete)**: Row-Level Security, designed and proven.
- **Session 3 (complete)**: Magic link auth, sessions, circle
  creation/joining, queryAsMember wired into real routes for the first
  time.
- **Session 4 (complete)**: Shared feed with text + private photo posts.
  Real, hard-won implementation of private Vercel Blob storage
  (authenticated serving route, pathname validation, static-token local
  auth as a pragmatic OIDC workaround). Fixed a real Session-3-origin bug
  (hardcoded `secure: true` cookie flag breaking local session
  persistence) discovered during this session's testing. Verified
  end-to-end: posting, photo display, and cross-circle access denial via
  direct URL tampering.