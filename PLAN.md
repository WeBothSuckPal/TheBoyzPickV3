# Clubhouse Lines — Full Site Audit Plan

## PHASE 1: Static Analysis & Build Integrity
Automated checks. Any failure blocks all later phases.

- [ ] **1.1** Run `npx tsc --noEmit` — expect zero errors
- [ ] **1.2** Run `npm run lint` — expect clean exit
- [ ] **1.3** Run `npm run build` — expect success, note any warnings (bundle size, dynamic vs static pages)
- [ ] **1.4** Run `npm run test` (vitest) — all 6 test files pass (ai, betting, env, odds-api, security, time)
- [ ] **1.5** Run `npx tsx scripts/predeploy-check.ts` — document any failures, reconcile cron schedule mismatch (script expects `*/15` and `*/5`, vercel.json has `0 */2 * * *` and `0 * * * *`)

---

## PHASE 2: Configuration & Environment Audit

- [ ] **2.1 Environment variables** — Cross-check `env.ts` schema against Vercel dashboard. Confirm all 6 required production keys are set: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `ODDS_API_KEY`, `CRON_SECRET`, `ADMIN_EMAILS`. Confirm `CRON_SECRET` >= 32 chars. Check optional: `RESEND_API_KEY`, `EMAIL_FROM`.
- [ ] **2.2 Cron schedules** — Verify all 4 crons in `vercel.json` match route files. Reconcile `predeploy-check.ts` expectations with actual schedules.
- [ ] **2.3 Security headers** — Review `next.config.ts`: CSP (script-src, connect-src, frame-ancestors), HSTS, X-Content-Type-Options, X-Frame-Options, CORP, COOP, Referrer-Policy, Permissions-Policy, poweredByHeader:false. Flag `unsafe-eval` in CSP if present — document why needed.
- [ ] **2.4 Middleware route matching** — Confirm protected routes (`/today`, `/slips`, `/wallet`, `/admin`, `/api/admin`) require auth. Confirm `/leaderboards` is intentionally public. Confirm `/api/cron/*` uses Bearer token auth in handlers (not middleware). Confirm fail-closed redirect for missing config.
- [ ] **2.5 Database schema** — List migration files in `drizzle/`. Confirm schema.ts matches migrations. Check foreign keys, unique indexes, timestamp timezone settings.

---

## PHASE 3: Auth & Authorization Flows

- [ ] **3.1 Public routes render unauthenticated** — `/` (landing page with social proof wall), `/sign-in` (Clerk component + back-to-home link), `/sign-up` (Clerk component + back-to-home link), `/suspended`, `/maintenance`, `/leaderboards`
- [ ] **3.2 Protected routes redirect when unauthenticated** — `/today`, `/slips`, `/wallet`, `/admin` all redirect to sign-in. `POST /api/admin/sync` and `/api/admin/settle` return 401.
- [ ] **3.3 Demo mode fallback** — When Clerk keys missing: `getOptionalViewer()` returns demo admin, sign-in shows "Clerk setup required" card, root layout skips `<ClerkProvider>`.
- [ ] **3.4 Authenticated member flow** — Sign in as member. `AppShell` shows display name, role, wallet balance. Nav shows 4 items (Today, Build Slip, Wallet, Leaderboards). Admin link hidden.
- [ ] **3.5 Admin access** — Sign in as admin (email in `ADMIN_EMAILS`). `/admin` renders. Admin nav link visible. Non-admin visiting `/admin` redirected to `/today`.
- [ ] **3.6 Suspended user** — User with `status: "suspended"` redirected to `/suspended` from all protected routes.
- [ ] **3.7 Maintenance mode** — When enabled: members redirect to `/maintenance`, admins still access everything.
- [ ] **3.8 Sign-out mechanism** — Confirm a sign-out button/link exists somewhere (Clerk UserButton or custom). If missing, flag as issue.

---

## PHASE 4: Server Actions & API Routes

- [ ] **4.1 Auth gating** — Every action in `actions.ts` starts with `requireViewer()` or `requireAdmin()`. Catalog which uses which.
- [ ] **4.2 Rate limiting** — Every action calls `assertRateLimit`. Document all policies and limits.
- [ ] **4.3 Input validation** — Check each action's Zod schema or manual validation:
  - `submitTopUpRequestAction`: amount 5-500 integer, note max 120 chars
  - `placeSlipAction`: stake 5-200 integer, selectionIds array 1-10 strings
  - `saveLockPickAction`: selectionId required, note max 140 chars
  - `approveTopUpAction`: requestId required
  - `updateMemberAccessAction`: targetUserId required, role/status type safety (flag if using `as` cast without validation)
- [ ] **4.4 Revalidation paths** — Confirm each action revalidates all affected routes (wallet, slips, leaderboards, admin, today).
- [ ] **4.5 API routes** — `POST /api/admin/sync` and `/api/admin/settle`: confirm auth, rate limit, error handling.
- [ ] **4.6 Cron routes** — All 4 crons: confirm `assertCronAuthorization`, rate limit, correct HTTP method (GET for Vercel crons). Test wrong/missing Bearer token returns 401.

---

## PHASE 5: Data Layer & Business Logic

- [ ] **5.1 Demo vs Live mode** — Confirm `getAppMode()` returns correct mode. Landing page functions (`getPublicLeaderboards`, `getPublicWeekLocks`, `getPublicFeed`) return demo data without DB, live data with DB.
- [ ] **5.2 Betting calculations** — Review `betting.ts`:
  - `americanToDecimal`: +150 -> 2.5, -110 -> ~1.909
  - `calculateStraightPayout` / `calculateParlayPayout`: verify math
  - `scoreSpreadLeg`: home/away spread application, win/loss/push
  - `scoreTotalsLeg`: over/under scoring, push on exact
  - `settleSlip`: straight (void=refund, push=refund, win=payout, loss=0), parlay (any loss=lost, all void=void, mixed push/void=refund)
- [ ] **5.3 Wallet/ledger integrity** — Trace `placeSlip`: atomic stake deduction, ledger entry, no negative balance. Trace `requestTopUp`/`approveTopUp`: pending->approved credits wallet. Unique index prevents double-credit.
- [ ] **5.4 Lock pick constraints** — Unique index `(userProfileId, weekKey)` enforces one lock per user per week. `saveLockPick` handles upsert correctly.
- [ ] **5.5 Numeric type handling** — Drizzle `numeric(6,2)` columns return strings. Confirm conversion to `number` before betting calculations (check `numericToNumber` usage).

---

## PHASE 6: UI/UX & Page Rendering

- [ ] **6.1 Landing page (`/`)** — 3-column wall renders (Locks, Feed, Standings). Empty states work. `formatCurrency`/`formatSpread`/`formatOdds` correct. "Full leaderboard" link works. Hero CTA: "Sign in" when unauthed, "Enter Clubhouse" when authed. "Request access" only shows when Clerk configured + not signed in. `?setup=incomplete` shows warning banner.
- [ ] **6.2 Today page (`/today`)** — Game cards render. Lock pick form works (select + note + submit). Activity feed shows items. Current lock banner displays with note.
- [ ] **6.3 Slips page (`/slips`)** — Slip builder: select games, choose market/side, set stake. Validation errors display. Bet history list renders with status badges. `?error=...` query param shows error.
- [ ] **6.4 Wallet page (`/wallet`)** — Balance display. Ledger table with transaction history. Top-up request form. Admin approval section (admin only).
- [ ] **6.5 Admin page (`/admin`)** — Member management table. Pending top-ups. Ops controls (sync, settle, AI). Audit trail. `?error=...` displays.
- [ ] **6.6 Leaderboards (`/leaderboards`)** — Renders with or without auth. Full leaderboard table.
- [ ] **6.7 AppShell navigation** — 4 items for members, 5 for admins. Active tab highlighting. Logo/app name links home.
- [ ] **6.8 Responsive design** — Test at mobile (375px), tablet (768px), desktop (1280px+). Landing page grid breakpoints. AppShell nav wraps correctly.
- [ ] **6.9 Dark theme** — CSS custom properties defined in globals.css. All components use theme vars. No hardcoded colors breaking dark mode.
- [ ] **6.10 Link integrity** — Every link on every page points to a valid route. No 404s. Back-to-home on sign-in/sign-up works.

---

## PHASE 7: Production & Infrastructure

- [ ] **7.1 Vercel deployment** — Project builds and deploys. Node engine constraint (`>=22 <23`) compatible with Vercel runtime.
- [ ] **7.2 Custom domain** — `theboyzpick.com` and `www.theboyzpick.com` configured in Vercel. SSL active. HTTP->HTTPS redirect. HSTS served.
- [ ] **7.3 Clerk domain config** — Authorized redirect URIs include `theboyzpick.com`. Production Clerk instance (not dev). Sign-in/sign-up work on custom domain.
- [ ] **7.4 Cron jobs** — All 4 appear in Vercel cron dashboard. `CRON_SECRET` set. Manual trigger returns 200.
- [ ] **7.5 Database connectivity** — `DATABASE_URL` points to correct Neon DB. Serverless driver used. Connection works from Vercel functions.
- [ ] **7.6 Email (Resend)** — `RESEND_API_KEY` set and valid. `EMAIL_FROM` matches verified sender domain. Settlement emails send on slip settlement.
- [ ] **7.7 Odds API** — `ODDS_API_KEY` valid. CSP allows `api.the-odds-api.com`. `PRIMARY_BOOKMAKER` matches available bookmaker.

---

## Known Issues to Investigate

1. **Cron schedule mismatch** — `predeploy-check.ts` vs `vercel.json` disagree on odds-sync and settle frequencies
2. **CSP `unsafe-eval`** — Can it be removed? Document why it's needed.
3. **Sign-out mechanism** — Is there a visible sign-out button? If not, users can't log out.
4. **`updateMemberAccessAction` type safety** — `role` and `status` cast with `as` without Zod validation
5. **Drizzle numeric->number conversion** — Confirm all `numeric` DB columns are converted before math operations

---

## Execution Approach

Each phase runs sequentially. Within a phase, independent checks run in parallel. Findings documented inline with severity:
- **BLOCKER** — Must fix before launch
- **WARNING** — Should fix, not breaking
- **INFO** — Noted for future improvement

~50 individual checks across 7 phases.
