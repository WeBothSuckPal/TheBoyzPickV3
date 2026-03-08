# Deployment

## GitHub

1. Create a new GitHub repository.
2. Add the remote:

```powershell
git remote add origin https://github.com/<your-org-or-user>/clubhouse-lines.git
```

3. Push the repo (default branch `main` recommended):

```powershell
git add .
git commit -m "Initial Clubhouse Lines app"
git branch -M main
git push -u origin main
```

## Vercel

1. Create a Neon Postgres database and copy `DATABASE_URL`.
2. Create a Clerk application and set invitation-only access in Clerk (disable public sign-up).
3. Add the env vars from [.env.example](/C:/Users/Administrator/Documents/New%20project/.env.example) in Vercel.
   Use a strong `CRON_SECRET` with at least 32 random characters.
   Set `CLUB_TIME_ZONE` to the club's home state so weekly lock picks reset on the correct local Monday.
   `ODDS_API_KEY` is required for sync and settlement jobs; the app now returns a `503` for those jobs if it is missing.
4. Import the GitHub repository into Vercel.
5. In Vercel project settings, enable Deployment Protection for preview environments.
6. Confirm cron jobs exist from [vercel.json](/C:/Users/Administrator/Documents/New%20project/vercel.json).
7. Use Node `22` for local and CI consistency (see [.nvmrc](/C:/Users/Administrator/Documents/New%20project/.nvmrc)).

## First production run

1. Run all migrations in order:
   - [drizzle/0000_messy_night_thrasher.sql](/C:/Users/Administrator/Documents/New%20project/drizzle/0000_messy_night_thrasher.sql)
   - [drizzle/0001_damp_scream.sql](/C:/Users/Administrator/Documents/New%20project/drizzle/0001_damp_scream.sql)
   - [drizzle/0002_serious_mimic.sql](/C:/Users/Administrator/Documents/New%20project/drizzle/0002_serious_mimic.sql)
   - [drizzle/0003_faithful_chat.sql](/C:/Users/Administrator/Documents/New%20project/drizzle/0003_faithful_chat.sql)
   Or run:

```bash
npm run db:migrate
```

2. Sign in with the commissioner email listed in `ADMIN_EMAILS`.
3. Visit `/admin` and run `Run odds sync`.
4. Confirm games and spreads appear on `/today`.
5. Place a test top-up and slip.
6. Run preflight checks locally before tagging release:

```bash
npm run predeploy:check
# optional strict env validation:
# npm run predeploy:check -- --production-env
```

## Troubleshooting sign-in and leaderboards

- `/sign-in` fails:
  - verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in Vercel Production env
  - verify Clerk "Allowed redirect URLs" and domain settings include your Vercel production domain
- `/leaderboards` redirects away:
  - this route is protected and requires auth; sign in first
  - if it redirects to `/?setup=incomplete`, required production env keys are missing
  - verify `DATABASE_URL`, `ODDS_API_KEY`, `CRON_SECRET` (32+ chars), and `ADMIN_EMAILS`

## Current blocker on this machine

- No GitHub remote is configured.
- No GitHub CLI credentials are available.
- No Vercel credentials or token are available.

Once those credentials exist, the repo is ready to be pushed and imported.
