# Clubhouse Lines

Private, invite-only sports picks club built with Next.js for Vercel.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- Clerk authentication
- Neon Postgres + Drizzle ORM schema scaffolding
- Vercel Cron endpoints for odds sync and settlement

## What is implemented

- Mobile-first member dashboard for daily lines, slips, wallet, and leaderboards
- Admin dashboard for top-up approvals, sync runs, and audit visibility
- Club-credit wallet and append-only ledger flow
- Straight bets and parlays up to four legs
- Lock of the Day picks and rivalry leaderboard calculations
- Cron-safe endpoints for schedule sync and settlement sweeps
- Seeded in-memory club engine for local/demo use, with Neon + Drizzle schema and deployment scaffolding ready in-repo
- Pre-launch security hardening: durable roles, maintenance mode, rate limiting, stricter cron auth, security headers, and idempotent ledger constraints

## Environment

Copy `.env.example` to `.env.local` and fill in the values you want to enable.

```powershell
Copy-Item .env.example .env.local
```

Required for production:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `ODDS_API_KEY`
- `CRON_SECRET`
- `ADMIN_EMAILS`

Optional:

- `PRIMARY_BOOKMAKER`
- `BANKROLL_PAYMENT_INSTRUCTIONS`

Production safety behavior:

- Protected pages, admin APIs, and cron routes fail closed with `503` when required production env values are missing.
- Production sign-up requires an invitation ticket in the URL (`__clerk_ticket`/`ticket`) in addition to Clerk invitation settings.

## Local development

```bash
nvm use
npm install
npm run dev
```

The shipped runtime uses a seeded in-memory club engine so the full product flow can be exercised immediately. Clerk auth, Neon, Drizzle schema generation, and Vercel cron wiring are already scaffolded in the repo for the persistent production pass.

## Database

The Drizzle schema is in [src/lib/db/schema.ts](/C:/Users/Administrator/Documents/New%20project/src/lib/db/schema.ts).

Generate migrations with:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run predeploy:check
# optional strict env validation:
# npm run predeploy:check -- --production-env
```

Node runtime target: `22` (see [.nvmrc](/C:/Users/Administrator/Documents/New%20project/.nvmrc)).

## Deployment

Deployment steps are documented in [DEPLOYMENT.md](/C:/Users/Administrator/Documents/New%20project/DEPLOYMENT.md).
