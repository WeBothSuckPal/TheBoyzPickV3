# Design: Three Feature Improvements
**Date:** 2026-03-22
**Project:** Clubhouse Lines (theboyzpick)
**Status:** Approved

---

## Overview

Three self-contained improvements shipping together in a single branch:

1. **Settlement Toasts** — real-time win/loss notification when a bet slip settles
2. **Admin Ops Health Page** — `/admin/ops` showing cron job history and anomaly alerts
3. **Odds Line Movement** — store and display opening-vs-current odds delta on game cards

---

## Feature 1: Settlement Toasts

### Goal
When a user's slip is settled (win/loss/push/void), they see an immediate on-screen toast without refreshing.

### Architecture
- **Channel type:** Public Pusher channel `user-{clerkUserId}` (no auth endpoint needed). Note: clerkUserId is not a secret, but in a closed private club with trusted members this is an acceptable trade-off vs. the complexity of a Pusher auth endpoint.
- **Trigger:** `runSettlementSweepLive()` in `src/lib/live-clubhouse.ts` — after each slip is written to DB, fire a Pusher event. The settlement loop already has `slip.userProfileId`; join `userProfiles` to resolve `clerkUserId` before the loop (batch query, not per-slip).
- **Event:** `slip.settled` with payload `{ slipId: string, result: "won" | "lost" | "push" | "void", payoutCents: number }`
- **Client:** `<SettlementListener />` — a `"use client"` component. Uses `useUser()` from `@clerk/nextjs` to get the clerkUserId client-side, then subscribes to `user-{clerkUserId}` via `getPusherClient()`. Rendered inside the authenticated layout (`src/app/(app)/layout.tsx` or equivalent authenticated wrapper).
- **Toast container:** Fixed `bottom-right` of viewport, `z-50`, toasts stack vertically with gap, max 3 visible at once. Auto-dismisses after 6 seconds. Duplicate prevention: maintain a `Set<string>` of seen `slipId`s in component state; ignore events for already-displayed slipIds.
- **Toast style:** Dark panel (`--panel` bg), `rounded-2xl`, accent colors per result.
  - Won → green, "Your slip WON — +$47.50"
  - Lost → red (`--accent: #CC2936`), "Your slip LOST"
  - Push → muted, "Your slip PUSHED — stake returned"
  - Void → muted, "Your slip was voided — stake returned"

### Data Flow
```
runSettlementSweepLive()
  → batch fetch clerkUserId for all openSlipRows' userProfileIds
  → settle slip in DB transaction
  → pusher.trigger(`user-${clerkUserId}`, "slip.settled", { slipId, result, payoutCents })

<SettlementListener /> (client component, in authenticated layout)
  → const { user } = useUser()
  → pusher.subscribe(`user-${user.id}`)
  → on "slip.settled" → showToast(result, payoutCents, slipId)
```

### Error Handling
- Pusher trigger failure must not throw or block settlement — wrap in try/catch, log warning only.
- If Pusher is not configured (missing env vars), `getPusherServer()` returns null — `dispatchPusherEvent` already handles this gracefully.
- `<SettlementListener />` only subscribes when `user` is defined; renders null otherwise.

---

## Feature 2: Admin Ops Health Page

### Goal
Give the commissioner visibility into cron job history and anomaly alerts without digging through logs.

### Architecture
- **Route:** `src/app/admin/ops/page.tsx` — server component, guarded by `requireAdmin()` from `src/lib/auth.ts` (checks `viewer.role === "owner_admin"` via `userProfiles`, redirects non-admins to `/today`)
- **Data function:** `getOpsHealthLive()` in `src/lib/live-clubhouse.ts`
- **Navigation:** Add "Ops Health" button/link on existing `/admin` page

### Data Sources
The app records audit logs for cron jobs with these actions:
- `ran_odds_sync` (target: `"odds-sync"`)
- `ran_settlement_sweep` (target: `"settlement"`)
- `ran_ai_ops_autopilot` (target: `"ai-autopilot"`, mode in metadata)

`getOpsHealthLive()` queries:
1. **Last run per cron job** — `DISTINCT ON (action)` from `adminAuditLogs` for the 3 cron actions above. PostgreSQL requires: `ORDER BY action, createdAt DESC` (DISTINCT ON column must come first in ORDER BY)
2. **Latest AI health reports** — most recent `ops_health_reports` row per `mode` ("hourly" / "nightly"), showing `score`, `summary`, `findings`, `remediations`
3. **Active anomaly alerts** — `anomaly_alerts` where `resolvedAt IS NULL`, ordered by severity (CASE: `critical=3, warning=2, info=1` DESC), then `createdAt DESC`

### Page Layout

**Cron Last-Run Cards** (one per job: odds-sync, settlement, ai-autopilot):
- Job name, last run timestamp (relative: "2 hours ago"), outcome (success/fail based on `outcome` column)
- If never run: "Never run" gray state

**AI Health Summary** (latest hourly + nightly report):
- Score badge, summary text, collapsible findings/remediations list

**Anomaly Alerts Table:**
- Columns: Timestamp, Category, Severity, Title, Detail
- Severity values (from codebase): `"critical"`, `"warning"`, `"info"`
- Severity badge colors: critical=red (`--accent`), warning=amber, info=muted-foreground
- Sort order CASE: `critical=3, warning=2, info=1` DESC
- Empty state: "No active anomaly alerts"

**Manual Refresh:** `router.refresh()` button — no real-time.

### Error Handling
- If `adminAuditLogs` has no rows with the relevant `action` value, show "Never run" per card (applies to any outcome — success or fail — since at least one run is needed to show status).
- Page is admin-gated; non-admins redirected by `requireAdmin()`.

---

## Feature 3: Odds Line Movement

### Goal
Show bettors whether odds have moved since first recorded, on game cards everywhere and more prominently in the slip builder.

### Database Change

**Drizzle schema update** (`src/lib/db/schema.ts`) — add four nullable columns to `oddsQuotes`:
```typescript
openingPoint: numeric("opening_point"),
openingAmericanOdds: integer("opening_american_odds"),
```
(Two columns cover both spread/total point and ML odds — `openingPoint` maps to spread or total; `openingAmericanOdds` maps to the American odds at opening. This matches the existing `point` and `americanOdds` columns.)

**Migration SQL:**
```sql
ALTER TABLE odds_quotes ADD COLUMN opening_point NUMERIC;
ALTER TABLE odds_quotes ADD COLUMN opening_american_odds INTEGER;
```

### Odds Sync Logic Update (`runOddsSyncLive()`)

Current pattern: query old quotes → delete → insert fresh quotes.

Updated pattern (keep delete+insert, thread opening values through):
1. Before delete: collect existing quotes into a map keyed by `(market, selectionSide)` → `{ openingPoint, openingAmericanOdds }` (gameId is already scoped per-game in the loop)
2. If the row already has non-null `openingPoint`, use those stored opening values
3. If the row has null `openingPoint` (first sync), opening = current values
4. Delete as before
5. Re-insert with `openingPoint` and `openingAmericanOdds` populated from step 2/3

This preserves opening lines across syncs without changing the delete+insert pattern.

**First-sync note:** For quotes already in production at migration time, the first sync after migration will treat current odds as opening odds — there is no historical backfill. This is acceptable; opening indicators will populate gradually as games are re-synced.

### UI — All Game Cards

Compute delta:
- **Spread/Total point delta:** `current_point - opening_point` (numeric)
- **Odds delta:** `current_american_odds - opening_american_odds` (integer)

Display:
- Show small badge next to odds line: `▲ +5` (amber) or `▼ -8` (blue) using raw integer/decimal delta
- No badge if delta is 0 or opening data is null
- Use raw delta format for both point and ML (not percentage — American odds percentage change is not standard)

### UI — Slip Builder (more prominent)

- Show delta inline on the same line as the odds, immediately after: `-110 ▲+20` — delta in small colored text (`text-xs`), does not wrap
- Tooltip on hover: "Moved from opening line"

### Error Handling
- If `openingPoint` is null (no opening data yet), show no indicator — no error state.
- Delta of 0 shows no indicator.

---

## Implementation Order

All 3 features ship in a single branch:

1. DB migration + Drizzle schema update (Feature 3)
2. Odds sync opening line logic (Feature 3 backend)
3. Settlement Pusher events + clerkUserId batch join (Feature 1 backend)
4. `getOpsHealthLive()` data function (Feature 2 backend)
5. `/admin/ops` page (Feature 2 UI)
6. `<SettlementListener />` + toast component (Feature 1 UI)
7. Odds movement delta badges on game cards + slip builder (Feature 3 UI)
8. Tests pass, TypeScript clean, deploy

---

## Verification

- **Settlement toasts:** Trigger manual settlement sweep from `/admin`, confirm toast appears for the correct user with correct result + payout
- **Ops page:** Navigate to `/admin/ops`, confirm cron last-run cards and anomaly table render; verify empty states when no data
- **Odds movement:** After two odds syncs, confirm delta badge appears on game cards and slip builder; confirm no badge when opening = current
- Run `npm test` — all 17 tests pass
- Run `npx tsc --noEmit` — no errors
- Deploy with `npx vercel --prod`
