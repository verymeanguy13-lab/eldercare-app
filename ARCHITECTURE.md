# ARCHITECTURE.md — Eldercare Coordination App

_Last updated: Session 5 (complete)_

## What this app is
A Taiwan-focused family elder-care coordination app. Adult children
coordinate care for elderly parents; parents interact via LINE
(LIFF app / notifications). Working name TBD.

## Stack
- **Framework**: Next.js (App Router, TypeScript), deployed on Vercel
- **Database**: Neon Postgres, `@neondatabase/serverless` v1.x — no ORM.
  queryUnsafe (owner) / queryAsMember (RLS-enforced).
- **Auth**: Passwordless magic link via Resend. DB-token sessions.
- **File storage**: Vercel Blob, PRIVATE access mode.
- **Parent-facing / notifications**: LINE Messaging API + LIFF (Phase 2)
- **Payments**: NewebPay
- **Dev workflow**: VS Code + PowerShell → GitHub → Vercel auto-deploy.
  Vercel CLI also in use (Blob credentials).
- **Repo**: public at github.com/verymeanguy13-lab/eldercare-app.

## Data model
- `circles`, `members`, `cared_for_profiles`, `circle_memberships` — see
  Session 2/2.5.
- `sessions`, `magic_link_tokens` (Session 3) — auth bookkeeping, not RLS.
- `posts` (Session 4, extended Session 5) — now has `post_type`
  (status_update / photo / note / system). `system` is schema-ready but
  not yet creatable by any code — reserved for Session 7's automated
  escalation posts, specifically so that session needs no further
  migration.
- `reactions` (Session 5) — one row per (post, member) pair, enforced by
  a UNIQUE constraint; tapping the same emoji twice removes it (toggle),
  tapping a different one replaces it. One reaction per person per post.

## Posts & reactions shared logic (Session 5)
`lib/posts.ts`'s `getPostsForCircle(memberId, circleId)` is the SINGLE
source of "fetch posts with their reaction summary," used by both the
feed page (initial server-rendered load) and the posts/react API routes
(which return the full refreshed list after any mutation, rather than
just the single changed item — kept the frontend's state management
simple at the cost of a slightly larger response per action, a reasonable
tradeoff at current scale). Any future session touching how posts are
fetched should update THIS file, not duplicate the query elsewhere.

**A real bug caught and fixed during this session's testing**: the
original post_type logic let an attached photo silently override an
explicit 小提醒 (note) selection — meaning a deliberately-chosen post type
could be overwritten just by also attaching an image, with no visual
distinction even from a plain status update (photo type had no distinct
styling initially). Fixed so the person's explicit choice always wins;
'photo' is now only an automatic classification for the unmodified
default case, and has its own distinct visual treatment (blue left
border) so it's no longer indistinguishable from status_update.

## Vercel Blob — private storage (Session 4, unchanged)
Private access mode; authenticated serving route
(`/api/circles/[circleId]/posts/photo`) with pathname-prefix validation.
Local dev uses a static `BLOB_READ_WRITE_TOKEN` (passed explicitly via
`token:` in put()/get() calls) rather than OIDC, due to a per-environment
OIDC scoping issue hit in Session 4. Production uses OIDC automatically.
This asymmetry is intentional and documented, not accidental.

## Auth flow (Session 3, unchanged)
Magic link → session cookie (secure flag MUST be environment-conditional,
not hardcoded true — a real bug from Session 3, fixed during Session 4's
testing) → `getCurrentMemberId()` → `requireCircleMember(circleId, minRole)`
gates every circle-scoped route.

## Circle creation & joining (Session 3, unchanged)
Free-tier cap logic (lib/caps.ts) unit-tested but still not verified
end-to-end with genuinely separate real accounts — Resend's testing
restriction, unresolved across three sessions now (see technical debt).

## Repo structure so far
- app/layout.tsx, globals.css, page.tsx
- app/login/page.tsx
- app/dashboard/page.tsx + dashboard-client.tsx
- app/circles/[circleId]/feed/page.tsx + feed-client.tsx
- app/api/auth/request-link, verify, logout
- app/api/circles, circles/join
- app/api/circles/[circleId]/posts/route.ts
- app/api/circles/[circleId]/posts/photo/route.ts
- app/api/circles/[circleId]/posts/[postId]/react/route.ts (Session 5)
- lib/db.ts, auth.ts, current-member.ts, require-circle-member.ts, caps.ts
- lib/posts.ts (Session 5) — shared post+reaction fetching logic
- tests/require-circle-member.test.ts, caps.test.ts
- schema.sql, ARCHITECTURE.md, .env.example, .env.local (gitignored)
- .gitignore, next.config.mjs, package.json, tsconfig.json, README.md

## Conventions to keep consistent in every future session
- DB access: queryUnsafe (owner) vs queryAsMember (RLS-enforced).
- Every circle-scoped route calls requireCircleMember FIRST.
- Every NEW circle-scoped table needs: circle_id column, RLS policy via
  my_circle_ids(), AND an explicit GRANT to app_user (not automatic).
- Shared fetch/query logic used by more than one route belongs in its own
  lib/ file (established this session with lib/posts.ts) rather than
  duplicated inline in each route — prevents behavior drift between
  routes that should stay in sync.
- Any route that mutates a resource identified by an ID in the URL
  (e.g. postId) should verify that resource actually belongs to the
  circle in the URL before touching it — established in Session 4's
  photo route, repeated in Session 5's react route.
- Private files: authenticated serving route, not public URLs, for
  anything genuinely sensitive.
- Session cookies: `secure` must be environment-conditional.
- Components: default Server Components; 'use client' only where needed.
- Path alias: @/ maps to repo root. Primary keys: UUIDs throughout.

## Environment variables
(unchanged from Session 4 — see prior log entry for the full table)

## Where are my secrets (running list)
(unchanged from Session 4)

## LINE channel note (relevant from Session 13 onward)
This app needs its OWN separate LINE Provider + Messaging API channel.

## Design decisions & reasoning
- Magic link, DB-token sessions, two DB connections, invite-code RLS
  exception, private Blob storage, static-token local dev — all
  unchanged from Sessions 3–4, see prior log entries.
- **POST endpoints returning the full refreshed post list, not just the
  single changed item**: keeps frontend state management simple (one
  re-render path) at a real but currently-acceptable cost of larger
  responses. Worth revisiting if/when a circle's post history grows
  large — pagination would need to be introduced alongside changing this
  pattern, not before.
- **`system` post_type added to the schema now, ahead of any code that
  creates it**: Session 7 needs to insert automated escalation posts;
  adding the enum value now means that session's migration doesn't need
  to touch the posts table's CHECK constraint at all, reducing risk on a
  safety-critical session.

## Known technical debt
- **Resend's single-recipient testing restriction** — now spanning
  THREE sessions (3, 4, 5 all deferred proper multi-account testing to
  varying degrees). Free-tier cap still genuinely unverified end-to-end.
  Worth seriously reconsidering timing — deferred again this session
  since no domain exists yet (reasonable, tied to still-undecided app
  branding), but this is accumulating risk the longer it's deferred.
- **Local Blob auth diverges from production** (Session 4) — unresolved,
  low urgency.
- **Invite codes are short** (Session 3) — unresolved.
- **Free-tier cap hardcoded constant** (Session 3) — deferred to Session
  24 as planned, unchanged.
- **Package version pinning** — pattern now established (Sessions 1, 4);
  no new instance this session, but worth continued vigilance for any
  future new package.

## Deferred ideas (not built yet, not forgotten)
- Verified Resend sending domain — blocked on app name/branding decision
- OIDC properly scoped to development environment (optional cleanup)
- LINE webhook + LIFF integration (Session 13+)
- Payments via NewebPay (Session 23+)
- Migrations story: currently manual SQL run in Neon's console.
- Cap constant → config/tier table (Session 24)
- Reply threads under posts — explicitly deferred by this session's own
  scope (reactions only, no threaded replies yet), not forgotten.

## Security considerations
- RLS + requireCircleMember, now covering posts AND reactions.
- React route re-validates the post genuinely belongs to the circle in
  the URL before mutating anything — same defensive pattern as the photo
  route, applied consistently.
- Private Blob storage with authenticated serving + pathname validation.
- Sessions: HTTP-only, environment-conditional secure flag, sameSite=lax.
- SQL injection prevented via parameterized queries throughout.
- Still-unrotated Resend API key / DB password from Session 3's chat
  exposure — still not urgent, still not forgotten, still not done.

## Performance considerations
- Index on posts(circle_id, created_at DESC); reactions(post_id).
- getPostsForCircle does one query for posts, one for all their
  reactions (grouped), rather than N+1 queries per post — worth
  preserving this pattern as more per-post data (e.g. future comments)
  gets added.

## Session log
- **Session 1 (complete)**: Repo scaffold, Neon/Vercel/GitHub wiring,
  local VS Code dev environment.
- **Session 2 (complete)**: Data model v1.
- **Session 2.5 (complete)**: Row-Level Security.
- **Session 3 (complete)**: Magic link auth, sessions, circle
  creation/joining.
- **Session 4 (complete)**: Shared feed with private photo storage.
- **Session 5 (complete)**: Post types (status_update/photo/note/system)
  with distinct visual styling, and toggleable emoji reactions. Fixed a
  real bug where photo attachment silently overrode an explicit type
  selection, and added missing visual distinction for the photo type.
  Introduced lib/posts.ts as shared fetch logic to prevent the feed page
  and API routes from drifting apart. Verified end-to-end: all three
  user-facing post type stylings visually distinct, reaction add/toggle-
  off/swap all confirmed working.