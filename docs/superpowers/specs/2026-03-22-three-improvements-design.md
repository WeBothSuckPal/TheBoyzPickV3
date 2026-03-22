# Design: Three Feature Improvements
**Date:** 2026-03-22
**Project:** Clubhouse Lines (theboyzpick)
**Status:** Approved

---

## Overview

Three self-contained improvements shipping together in a single branch:

1. **Settlement Toasts** — real-time win/loss notification when a bet slip settles
2. **Admin Ops Health Page** — `/admin/ops` showing cron job status and anomaly alerts
3. **Odds Line Movement** — store and display opening-vs-current odds delta on game cards

---

## Feature 1: Settlement Toasts

### Goal
When a user's slip is settled (win/loss/push/void), they see an immediate on-screen toast without refreshing.

### Architecture
- **Trigger:** `runSettlementSweepLive()` in `src/lib/live-clubhouse.ts` — after each slip status is written, fire a Pusher event.
- **Channel:** `private-user-{clerkUserId}` (private channel, user-scoped)
- **Event:** `slip.settled` with payload `{ result: "won" | "lost" | "push" | "void", payoutCents: number }`
- **Client:** `<SettlementListener />` component rendered inside the authenticated root layout (`src/app/layout.tsx` or equivalent). Subscribes on mount, unsubscribes on unmount.
- **Toast:** Custom toast component using the existing design system (dark panel, rounded-[28px], accent color for wins). Auto-dismisses after 6 seconds.
  - Win → green accent, "Your slip WON — +$47.50"
  - Loss → red (`--accent: #CC2936`), "Your slip LOST"
  - Push → muted, "Your slip PUSHED — stake returned"
  - Void → muted, "Your slip was voided — stake returned"

### Data Flow
```
runSettlementSweepLive()
  → settle slip in DB
  → pusher.trigger(`private-user-${clerkUserId}`, "slip.settled", { result, payoutCents })

<SettlementListener /> (client component)
  → pusher.subscribe(`private-user-${clerkUserId}`)
  → on "slip.settled" → showToast(result, payoutCents)
```

### Error Handling
- Pusher trigger failure must not throw or block settlement — wrap in try/catch, log error.
- If Pusher is not configured (missing env vars), skip silently.

---

## Feature 2: Admin Ops Health Page

### Goal
Give the commissioner visibility into cron job health and anomaly alerts without digging through logs.

### Architecture
- **Route:** `src/app/admin/ops/page.tsx` — server component, requires `owner_admin` role (uses `requireAdmin()`)
- **Data function:** `getOpsHealthLive()` in `src/lib/live-clubhouse.ts` — queries `ops_health_reports` and `anomaly_alerts` tables
- **Navigation:** Add "Ops Health" link/button on existing `/admin` page

### Page Layout
**Cron Status Cards** (one per job):
- Jobs: `odds-sync`, `settle`, `ai-hourly`, `ai-nightly`, `daily-digest`
- Each card shows: job name, last run timestamp, status (pass/fail), duration ms
- Status color: green = pass, red = fail, gray = never run

**Anomaly Alerts Table:**
- Columns: Timestamp, Type, Severity, Description
- Sorted by severity desc, then timestamp desc
- Empty state: "No active anomaly alerts"

**Manual Refresh:** Standard Next.js `router.refresh()` button — no real-time.

### Data Queries
```sql
-- Latest report per cron type
SELECT DISTINCT ON (cron_type) * FROM ops_health_reports ORDER BY cron_type, created_at DESC;

-- Unresolved anomaly alerts
SELECT * FROM anomaly_alerts WHERE resolved_at IS NULL ORDER BY severity DESC, created_at DESC;
```

### Error Handling
- If tables are empty (no cron has run yet), show empty state per card rather than error.
- Page is admin-gated; non-admins are redirected by `requireAdmin()`.

---

## Feature 3: Odds Line Movement

### Goal
Show bettors whether odds have moved since they were first recorded, surfaced on game cards everywhere and more prominently in the slip builder.

### Database Change
**Migration:** Add four nullable columns to `odds_quotes`:
```sql
ALTER TABLE odds_quotes ADD COLUMN opening_spread DECIMAL;
ALTER TABLE odds_quotes ADD COLUMN opening_total DECIMAL;
ALTER TABLE odds_quotes ADD COLUMN opening_ml_home INTEGER;
ALTER TABLE odds_quotes ADD COLUMN opening_ml_away INTEGER;
```

**Upsert logic in `runOddsSyncLive()`:**
- On **INSERT**: set `opening_*` = current values
- On **UPDATE** (conflict): leave `opening_*` columns unchanged (use `onConflictDoUpdate` with explicit column list excluding opening fields)

### UI — All Game Cards
- Compute delta: `current - opening` for spread and total; percentage change for ML
- Show small badge next to odds: `▲ +5` (amber) for line moved up, `▼ -8` (blue) for moved down
- No badge if no movement or opening data not yet available

### UI — Slip Builder (more prominent)
- Show delta inline with the odds selection button
- Example: `-110 ▲+5` with the delta in a slightly larger, colored indicator
- Tooltip or small label: "Line moved since opening"

### Error Handling
- If `opening_*` is null (first sync), show no indicator — no error state needed.
- Delta of 0 shows no indicator.

---

## Implementation Strategy

All 3 features ship in a single branch. Order of implementation:

1. **DB migration** (Feature 3 schema change) — run first since it's non-breaking
2. **Backend: odds sync upsert logic** (Feature 3 backend)
3. **Backend: settlement Pusher events** (Feature 1 backend)
4. **Backend: `getOpsHealthLive()` data function** (Feature 2 backend)
5. **Frontend: `/admin/ops` page** (Feature 2 UI)
6. **Frontend: `<SettlementListener />` + toast** (Feature 1 UI)
7. **Frontend: odds movement indicators** (Feature 3 UI)
8. **Tests pass, TypeScript clean, deploy**

---

## Verification

- Settlement: trigger a manual settlement sweep from `/admin`, confirm toast appears on the member's screen
- Ops page: navigate to `/admin/ops`, confirm cron cards and alert table render correctly
- Odds movement: after two odds syncs with different data, confirm delta badge appears on game cards and slip builder
- Run `npm test` — all 17 tests pass
- Run `npx tsc --noEmit` — no errors
- Deploy with `npx vercel --prod`
