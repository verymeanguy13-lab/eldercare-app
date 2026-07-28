# ARCHITECTURE.md — Eldercare Coordination App

_Last updated: Session 1_

## What this app is
A Taiwan-focused family elder-care coordination app. Adult children
coordinate care for elderly parents; parents interact via LINE
(LIFF app / notifications). Working name TBD.

## Stack
- **Framework**: Next.js (App Router, TypeScript), deployed on Vercel
- **Database**: Neon Postgres (serverless), accessed via `@neondatabase/serverless`
  — no ORM. Pattern: a single `queryUnsafe(sql, params)` helper in `lib/db.ts`
  that returns rows as a plain array (not `.rows`), matching the
  TaiwanScreen project's convention.
- **Parent-facing / notifications**: LINE Messaging API + LIFF
- **Payments**: NewebPay
- **Dev workflow**: TRANSITIONING — see "Dev workflow decision" below.
  Session 1 was built entirely through GitHub's web UI (Add file → Create
  new file → paste → commit), with no local dev environment. Starting
  Session 2, the plan is to switch to a local VS Code + Git setup instead.

## Dev workflow decision (flag for next session)
During Session 1, it became clear the original blueprint's assumption
("no local dev environment, GitHub web UI only") no longer matches
reality — the person has prior VS Code + Git + Vercel experience from other
projects. Session 1 was completed via the web UI to avoid a messy
half-and-half session, but Session 2 should start with a short VS Code
setup walkthrough (installing Node.js and Git, cloning this repo locally,
running npm install, and how to commit/push from VS Code) before any new
feature work begins.

Action needed on the master blueprint document (outside of any Claude
session — this can't be carried automatically): the Standing Context Block
sentence "I manage code entirely through GitHub's web interface — no local
dev environment, no Claude Code, I am not an experienced developer" should
be replaced with something like "I code locally using VS Code with Git,
and push to GitHub from there. I'm still relatively new to this — explain
commands before I run them, and give me full file contents rather than
partial diffs." A few session-specific "Steps to do yourself" sections
elsewhere in the blueprint (e.g. Session 6.5's staging branch instructions)
were also written assuming the GitHub web UI and may need light adjustment
once on VS Code — not urgent, but worth a glance when reached.

## Repo structure so far
- app/layout.tsx — root layout (html/body wrapper)
- app/globals.css — minimal global styles
- app/page.tsx — homepage; DB wiring-check page
- lib/db.ts — queryUnsafe() Neon Postgres helper
- schema.sql — full current DB schema (source of truth)
- ARCHITECTURE.md — this file
- .env.example — documents required env vars (no real secrets)
- .gitignore
- next.config.mjs
- package.json
- tsconfig.json
- README.md — created by GitHub at repo creation; unused so far

## Conventions to keep consistent in every future session
- DB access: always through queryUnsafe() from lib/db.ts. Always use
  parameterized queries ($1, $2, ...) — never string-concatenate
  user input into SQL.
- Components: default to Server Components. Only add 'use client'
  when a file genuinely needs browser interactivity (state, event handlers).
- File delivery: every session, only files that changed are given in
  full; unrelated files are left untouched and unmentioned.
- Path alias: @/ maps to the repo root (e.g. @/lib/db).

## Environment variables (set in Vercel, not committed)
| Variable | Purpose |
|---|---|
| NEON_DATABASE_URL | Neon Postgres pooled connection string |
| LINE_CHANNEL_SECRET | LINE channel secret (webhook signature verification) |
| LINE_CHANNEL_ACCESS_TOKEN | LINE channel access token (sending messages) |
| NEWEBPAY_MERCHANT_ID | NewebPay merchant ID |
| NEWEBPAY_HASH_KEY | NewebPay hash key (payment signing) |
| NEWEBPAY_HASH_IV | NewebPay hash IV (payment signing) |

## Design decisions & reasoning
- No ORM: chosen for consistency with the existing TaiwanScreen project
  and to keep the mental model simple for a beginner maintaining raw SQL
  directly. Trade-off: no compile-time schema safety, no migrations tool —
  schema.sql is manually kept in sync and is the single source of truth.
- @neondatabase/serverless over pg: works over HTTP, which fits
  Vercel's serverless/edge functions without connection-pooling headaches
  that a traditional TCP driver would hit in a serverless environment.
- force-dynamic on the homepage: without it, Next.js could statically
  render the page at build time and freeze the DB timestamp instead of
  querying live. Any future page that reads live DB data should also set
  this (or use another dynamic API like cookies()/headers()) unless
  static rendering is intentional.

## Known technical debt
- None yet from a code standpoint — this session was pure scaffolding.
- Process debt: the dev workflow assumption baked into the blueprint (see
  "Dev workflow decision" above) needs correcting before Session 2 starts
  writing more files, or every future session will keep defaulting to the
  slower file-by-file GitHub web UI pattern unnecessarily.

## Deferred ideas (not built yet, not forgotten)
- Data model for family circles / users / elders (Session 2+)
- Auth
- LINE webhook + LIFF integration
- Payments via NewebPay
- Migrations story: currently manual SQL run in Neon's console; revisit
  if the schema grows complex enough that manual tracking becomes error-prone.

## Security considerations
- All secrets live only in Vercel env vars, never committed. .env.example
  documents names only.
- SQL injection is prevented by consistently using parameterized queries
  via queryUnsafe(sql, params) — this must be maintained as a hard rule
  in every future session.
- LINE webhook signature verification and NewebPay hash verification are
  not yet implemented — required before either integration goes live.

## Performance considerations
- Nothing meaningful yet at this scale (one query, one page). Revisit
  connection/query patterns once the app has real read/write volume.

## Session log
- Session 1: Repo scaffold — Next.js App Router + TypeScript project
  structure, Neon DB helper (queryUnsafe pattern), homepage wiring-check
  querying SELECT NOW(), .env.example, initial schema.sql (empty)
  and this ARCHITECTURE.md. Built via GitHub's web UI. Decided mid-session
  to switch to local VS Code + Git for Session 2 onward — see "Dev workflow
  decision" above.
