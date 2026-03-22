# Three Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three features together — real-time settlement toasts via Pusher, an admin ops health page at `/admin/ops`, and odds line movement delta badges on game cards.

**Architecture:** Feature 3 (odds movement) requires a DB schema change first since its types flow through the data layer into the UI. Feature 1 (toasts) is a backend event + client listener. Feature 2 (ops page) is a pure read-only server page. All three share no state; order is schema → backend → UI.

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM, Neon PostgreSQL, Pusher, Clerk Auth v7, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-22-three-improvements-design.md`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/db/schema.ts` | Modify | Add `openingPoint`, `openingAmericanOdds` to `oddsQuotes` |
| `src/lib/types.ts` | Modify | Add `openingPoint?`, `openingAmericanOdds?` to `GameOption` |
| `src/lib/live-clubhouse.ts` | Modify | 4 changes: `buildGameCards`, `runOddsSyncLive`, `runSettlementSweepLive`, add `getOpsHealthLive` |
| `src/lib/clubhouse.ts` | Modify | Add `getOpsHealth()` with live dispatch + demo stub |
| `src/components/settlement-listener.tsx` | Create | Client component: Pusher subscription + toast stack |
| `src/components/app-shell.tsx` | Modify | Render `<SettlementListener />` in authenticated shell |
| `src/app/(app)/admin/ops/page.tsx` | Create | Admin ops health page |
| `src/app/(app)/admin/page.tsx` | Modify | Add "Ops Health" link |
| `src/app/(app)/slips/slip-builder.tsx` | Modify | Add opening delta inline on odds button + summary |
| `src/app/(app)/slips/page.tsx` | Modify | Pass `openingPoint`, `openingAmericanOdds` through to SlipBuilder |
| `src/app/(app)/today/league-filter.tsx` | Modify | Add opening delta badge on game card odds |
| `src/app/(app)/today/page.tsx` | Modify | Pass `openingPoint`, `openingAmericanOdds` through to LeagueFilter |

---

## Task 1: Add Opening Line Columns to Schema

**Files:**
- Modify: `src/lib/db/schema.ts` (oddsQuotes table, ~line 164)

- [ ] **Step 1: Add two nullable columns to `oddsQuotes` in schema.ts**

In `src/lib/db/schema.ts`, inside the `oddsQuotes` pgTable column definitions, add after `isPrimary`:

```typescript
openingPoint: numeric("opening_point", { precision: 6, scale: 2 }),
openingAmericanOdds: integer("opening_american_odds"),
```

- [ ] **Step 2: Generate the migration**

```bash
npm run db:generate
```

Expected: A new SQL file created in `drizzle/` (e.g. `0007_*.sql`) containing two `ALTER TABLE odds_quotes ADD COLUMN` statements.

- [ ] **Step 3: Apply migration to Neon**

```bash
npm run db:migrate
```

Expected: `drizzle-kit migrate` runs successfully, prints the migration as applied.

- [ ] **Step 4: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/schema.ts drizzle/
git commit -m "feat: add opening_point and opening_american_odds columns to odds_quotes"
```

---

## Task 2: Add Opening Fields to GameOption Type

**Files:**
- Modify: `src/lib/types.ts` (~line 105)

- [ ] **Step 1: Add optional fields to `GameOption` interface**

In `src/lib/types.ts`, update the `GameOption` interface:

```typescript
export interface GameOption {
  id: string;
  team: string;
  side: SelectionSide;
  spread: number;
  americanOdds: number;
  market: BetMarket;
  bookmaker: string;
  quoteTimestamp: string;
  intelligence?: BetIntelligence;
  openingPoint?: number;           // ADD
  openingAmericanOdds?: number;    // ADD
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors (fields are optional so existing call sites are unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add openingPoint and openingAmericanOdds to GameOption type"
```

---

## Task 3: Thread Opening Values Through buildGameCards

**Files:**
- Modify: `src/lib/live-clubhouse.ts` (`buildGameCards` function, ~line 800)

- [ ] **Step 1: Update GameOption construction in `buildGameCards`**

In `buildGameCards()`, find the `option` object construction inside the `for (const row of quoteRows)` loop. Add the two opening fields:

```typescript
const option: GameOption = {
  id: row.id,
  team: row.selectionTeam,
  side: row.selectionSide as GameOption["side"],
  spread: numericToNumber(row.point),
  americanOdds: row.americanOdds,
  market: row.market as GameOption["market"],
  bookmaker: row.bookmakerKey,
  quoteTimestamp: toIso(row.quoteTimestamp)!,
  intelligence: buildSpreadIntelligence({ /* existing */ }),
  openingPoint: row.openingPoint != null ? numericToNumber(row.openingPoint) : undefined,       // ADD
  openingAmericanOdds: row.openingAmericanOdds ?? undefined,                                    // ADD
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 17 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/live-clubhouse.ts
git commit -m "feat: thread opening line fields through buildGameCards"
```

---

## Task 4: Preserve Opening Values in runOddsSyncLive

**Files:**
- Modify: `src/lib/live-clubhouse.ts` (`runOddsSyncLive`, ~line 2320)

The current pattern inside the per-game loop is:
1. Query `oldQuotes` (spread only, for shift detection)
2. Delete all quotes for the game
3. Insert fresh quotes

We need to snapshot opening values (for ALL markets, not just spreads) before the delete and preserve them on re-insert.

- [ ] **Step 1: Before the existing delete, add a broader opening snapshot**

Directly after the existing `oldQuotes` query (the one scoped to `market: "spreads"`), add:

```typescript
// Snapshot opening values for ALL markets before deleting
const openingMap = new Map<string, { openingPoint: string | null; openingAmericanOdds: number | null }>();
const allCurrentQuotes = await db
  .select({
    market: oddsQuotes.market,
    selectionSide: oddsQuotes.selectionSide,
    openingPoint: oddsQuotes.openingPoint,
    openingAmericanOdds: oddsQuotes.openingAmericanOdds,
    point: oddsQuotes.point,
    americanOdds: oddsQuotes.americanOdds,
  })
  .from(oddsQuotes)
  .where(
    and(
      eq(oddsQuotes.gameId, gameId),
      eq(oddsQuotes.bookmakerKey, settings.primaryBookmaker),
    ),
  );

for (const q of allCurrentQuotes) {
  const key = `${q.market}:${q.selectionSide}`;
  openingMap.set(key, {
    // If opening values already exist, preserve them; otherwise treat current as opening
    openingPoint: q.openingPoint ?? q.point,
    openingAmericanOdds: q.openingAmericanOdds ?? q.americanOdds,
  });
}
```

- [ ] **Step 2: Update the insert to include opening values**

Find the `await db.insert(oddsQuotes).values(...)` call and update the mapped values:

```typescript
await db.insert(oddsQuotes).values(
  event.outcomes.map((outcome) => {
    const key = `${outcome.market}:${outcome.side}`;
    const opening = openingMap.get(key);
    return {
      gameId,
      bookmakerKey: settings.primaryBookmaker,
      market: outcome.market,
      selectionTeam: outcome.team,
      selectionSide: outcome.side,
      point: String(outcome.spread),
      americanOdds: outcome.americanOdds,
      quoteTimestamp: new Date(outcome.quoteTimestamp),
      isPrimary: true,
      // Preserve opening values if they existed; use current values on first insert
      openingPoint: opening ? opening.openingPoint : String(outcome.spread),
      openingAmericanOdds: opening ? opening.openingAmericanOdds : outcome.americanOdds,
    };
  }),
);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 17 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-clubhouse.ts
git commit -m "feat: preserve opening odds values through sync delete+insert cycle"
```

---

## Task 5: Fire Pusher Event on Slip Settlement

**Files:**
- Modify: `src/lib/live-clubhouse.ts` (`runSettlementSweepLive`, ~line 2493)

- [ ] **Step 1: Batch-fetch clerkUserId before the slip loop**

Find the line `const settledEmailPayloads: SettledSlipRecord[] = [];`. Just before it, add a batch join to build a `clerkUserIdByProfileId` map:

```typescript
// Build clerkUserId lookup for Pusher events
const profileRows = openSlipRows.length > 0
  ? await db
      .select({ id: userProfiles.id, clerkUserId: userProfiles.clerkUserId })
      .from(userProfiles)
      .where(inArray(userProfiles.id, [...new Set(openSlipRows.map((s) => s.userProfileId))]))
  : [];
const clerkUserIdByProfileId = new Map(profileRows.map((p) => [p.id, p.clerkUserId]));
```

- [ ] **Step 2: Fire Pusher event after each successful settlement**

Find the block `if (!updatedSlip) { continue; }` and `settledSlips += 1;`. Directly after `settledSlips += 1;`, add:

```typescript
// Fire real-time toast event for the user
const clerkUserId = clerkUserIdByProfileId.get(slip.userProfileId);
if (clerkUserId) {
  try {
    await dispatchPusherEvent(`user-${clerkUserId}`, "slip.settled", {
      slipId: slip.id,
      result: settlement.status,
      payoutCents: settlement.payoutCents,
    });
  } catch {
    console.warn("[settlement] pusher event failed for slip", slip.id);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 17 pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/live-clubhouse.ts
git commit -m "feat: fire pusher slip.settled event on settlement for real-time toasts"
```

---

## Task 6: Add getOpsHealthLive and getOpsHealth

**Files:**
- Modify: `src/lib/live-clubhouse.ts` (add new export at end of file)
- Modify: `src/lib/clubhouse.ts` (add `getOpsHealth` export)

- [ ] **Step 1: Add `OpsHealthData` type to `src/lib/types.ts`**

Add at the end of the types file:

```typescript
export interface CronJobStatus {
  action: string;
  label: string;
  lastRunAt: string | null;   // ISO string or null
  outcome: string | null;     // "success" | "fail" | null
}

export interface OpsHealthData {
  cronJobs: CronJobStatus[];
  latestHourlyReport: { score: number; summary: string; findings: unknown[]; remediations: unknown[]; createdAt: string } | null;
  latestNightlyReport: { score: number; summary: string; findings: unknown[]; remediations: unknown[]; createdAt: string } | null;
  anomalyAlerts: { id: string; category: string; severity: string; title: string; detail: string; createdAt: string }[];
}
```

- [ ] **Step 2: Add `getOpsHealthLive()` in `src/lib/live-clubhouse.ts`**

Add a new export at the end of the file:

```typescript
const CRON_JOBS: { action: string; label: string }[] = [
  { action: "ran_odds_sync", label: "Odds Sync" },
  { action: "ran_settlement_sweep", label: "Settlement Sweep" },
  { action: "ran_ai_ops_autopilot", label: "AI Autopilot" },
];

export async function getOpsHealthLive(): Promise<OpsHealthData> {
  const db = dbOrThrow();

  // Last run per cron action — DISTINCT ON requires action first in ORDER BY
  const lastRunRows = await db.execute(
    sql`SELECT DISTINCT ON (action) action, outcome, created_at
        FROM admin_audit_logs
        WHERE action IN ('ran_odds_sync', 'ran_settlement_sweep', 'ran_ai_ops_autopilot')
        ORDER BY action, created_at DESC`,
  );

  const lastRunByAction = new Map(
    (lastRunRows as { action: string; outcome: string; created_at: Date }[]).map((r) => [
      r.action,
      { outcome: r.outcome, createdAt: r.created_at.toISOString() },
    ]),
  );

  const cronJobs: CronJobStatus[] = CRON_JOBS.map(({ action, label }) => {
    const row = lastRunByAction.get(action);
    return {
      action,
      label,
      lastRunAt: row?.createdAt ?? null,
      outcome: row?.outcome ?? null,
    };
  });

  // Latest ops health reports (hourly + nightly)
  const reportRows = await db
    .select()
    .from(opsHealthReports)
    .orderBy(desc(opsHealthReports.createdAt))
    .limit(10);

  const latestHourly = reportRows.find((r) => r.mode === "hourly") ?? null;
  const latestNightly = reportRows.find((r) => r.mode === "nightly") ?? null;

  // Active anomaly alerts, sorted by severity then time
  const alertRows = await db.execute(
    sql`SELECT id, category, severity, title, detail, created_at
        FROM anomaly_alerts
        WHERE resolved_at IS NULL
        ORDER BY CASE severity WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END DESC,
                 created_at DESC`,
  );

  return {
    cronJobs,
    latestHourlyReport: latestHourly
      ? {
          score: latestHourly.score,
          summary: latestHourly.summary,
          findings: latestHourly.findings as unknown[],
          remediations: latestHourly.remediations as unknown[],
          createdAt: latestHourly.createdAt.toISOString(),
        }
      : null,
    latestNightlyReport: latestNightly
      ? {
          score: latestNightly.score,
          summary: latestNightly.summary,
          findings: latestNightly.findings as unknown[],
          remediations: latestNightly.remediations as unknown[],
          createdAt: latestNightly.createdAt.toISOString(),
        }
      : null,
    anomalyAlerts: (
      alertRows as { id: string; category: string; severity: string; title: string; detail: string; created_at: Date }[]
    ).map((r) => ({
      id: r.id,
      category: r.category,
      severity: r.severity,
      title: r.title,
      detail: r.detail,
      createdAt: r.created_at.toISOString(),
    })),
  };
}
```

Also add `OpsHealthData` to the imports at the top of `live-clubhouse.ts`:
```typescript
import type { ..., OpsHealthData } from "@/lib/types";
```

And add `opsHealthReports` to the schema imports:
```typescript
import { ..., opsHealthReports } from "@/lib/db/schema";
```

- [ ] **Step 3: Add `getOpsHealth()` to `src/lib/clubhouse.ts`**

Add the import in `clubhouse.ts`:
```typescript
import { ..., getOpsHealthLive } from "@/lib/live-clubhouse";
```

Add the export function:
```typescript
export async function getOpsHealth(): Promise<OpsHealthData> {
  if (isDatabaseConfigured()) {
    return getOpsHealthLive();
  }
  // Demo stub — no cron history in demo mode
  return {
    cronJobs: [
      { action: "ran_odds_sync", label: "Odds Sync", lastRunAt: null, outcome: null },
      { action: "ran_settlement_sweep", label: "Settlement Sweep", lastRunAt: null, outcome: null },
      { action: "ran_ai_ops_autopilot", label: "AI Autopilot", lastRunAt: null, outcome: null },
    ],
    latestHourlyReport: null,
    latestNightlyReport: null,
    anomalyAlerts: [],
  };
}
```

Also import `OpsHealthData` in `clubhouse.ts`:
```typescript
import type { ..., OpsHealthData } from "@/lib/types";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 17 pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/live-clubhouse.ts src/lib/clubhouse.ts
git commit -m "feat: add getOpsHealth data function with cron history and anomaly alerts"
```

---

## Task 7: Create /admin/ops Page

**Files:**
- Create: `src/app/(app)/admin/ops/page.tsx`
- Modify: `src/app/(app)/admin/page.tsx`

- [ ] **Step 1: Create `src/app/(app)/admin/ops/page.tsx`**

```tsx
import { Activity, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { getOpsHealth } from "@/lib/clubhouse";
import { relativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "critical") return <Badge className="bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/30">{severity}</Badge>;
  if (severity === "warning") return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{severity}</Badge>;
  return <Badge className="bg-white/10 text-[var(--muted-foreground)] border-white/10">{severity}</Badge>;
}

export default async function AdminOpsPage() {
  await requireAdmin();
  const ops = await getOpsHealth();

  return (
    <div className="grid gap-6">
      {/* Cron Job Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            Cron Jobs
          </CardTitle>
          <CardDescription>Last run time and outcome for each scheduled job.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            {ops.cronJobs.map((job) => (
              <div
                key={job.action}
                className="rounded-2xl border border-white/10 bg-black/15 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{job.label}</span>
                  {job.outcome === null ? (
                    <Clock className="size-4 text-[var(--muted-foreground)]" />
                  ) : job.outcome === "success" ? (
                    <CheckCircle className="size-4 text-green-400" />
                  ) : (
                    <XCircle className="size-4 text-[var(--accent)]" />
                  )}
                </div>
                <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                  {job.lastRunAt
                    ? relativeTime(job.lastRunAt)
                    : "Never run"}
                </div>
                {job.outcome && (
                  <div className={`mt-1 text-xs font-mono ${job.outcome === "success" ? "text-green-400" : "text-[var(--accent)]"}`}>
                    {job.outcome}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Health Reports */}
      {(ops.latestHourlyReport || ops.latestNightlyReport) && (
        <div className="grid gap-6 sm:grid-cols-2">
          {[
            { label: "Hourly Report", report: ops.latestHourlyReport },
            { label: "Nightly Report", report: ops.latestNightlyReport },
          ].map(({ label, report }) =>
            report ? (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-base">{label}</CardTitle>
                  <CardDescription>{relativeTime(report.createdAt)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-white">{report.score}</span>
                    <span className="text-sm text-[var(--muted-foreground)]">/ 100 health score</span>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">{report.summary}</p>
                  {(report.findings as string[]).length > 0 && (
                    <details className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-white">
                        {(report.findings as string[]).length} finding(s)
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {(report.findings as string[]).map((f, i) => (
                          <li key={i} className="text-xs text-[var(--muted-foreground)]">• {String(f)}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </CardContent>
              </Card>
            ) : null,
          )}
        </div>
      )}

      {/* Anomaly Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5" />
            Active Anomaly Alerts
          </CardTitle>
          <CardDescription>Unresolved alerts from the AI ops autopilot.</CardDescription>
        </CardHeader>
        <CardContent>
          {ops.anomalyAlerts.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">No active anomaly alerts.</p>
          ) : (
            <div className="space-y-3">
              {ops.anomalyAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-sm font-semibold text-white">{alert.title}</span>
                    <span className="ml-auto text-xs text-[var(--muted-foreground)]">{relativeTime(alert.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{alert.detail}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]/60">{alert.category}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Add `relativeTime` if missing from utils**

Check `src/lib/utils.ts` for `relativeTime`. If it doesn't exist, add:

```typescript
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
```

- [ ] **Step 3: Add "Ops Health" link to `/admin/ops` on the admin page**

In `src/app/(app)/admin/page.tsx`, add an import for `Link` (if not present) and add a link in the Operations card near the top of `<CardContent>`:

```tsx
<Link
  href="/admin/ops"
  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-[var(--muted-foreground)] transition hover:text-white"
>
  <Activity className="size-4" />
  Ops Health
</Link>
```

Add `import { Activity } from "lucide-react";` to the admin page imports.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 17 pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/admin/ops/page.tsx src/app/\(app\)/admin/page.tsx src/lib/utils.ts
git commit -m "feat: add /admin/ops page with cron health, AI reports, and anomaly alerts"
```

---

## Task 8: Create SettlementListener Component

**Files:**
- Create: `src/components/settlement-listener.tsx`
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Create `src/components/settlement-listener.tsx`**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { CheckCircle, XCircle, MinusCircle } from "lucide-react";
import { getPusherClient } from "@/lib/pusher";
import { formatCurrency } from "@/lib/utils";

type SlipResult = "won" | "lost" | "push" | "void";

interface SettlementToast {
  id: string;        // slipId — used for dedup
  result: SlipResult;
  payoutCents: number;
}

export function SettlementListener() {
  const { user } = useUser();
  const [toasts, setToasts] = useState<SettlementToast[]>([]);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(`user-${user.id}`);

    channel.bind("slip.settled", (data: { slipId: string; result: SlipResult; payoutCents: number }) => {
      if (seenIds.current.has(data.slipId)) return;
      seenIds.current.add(data.slipId);

      const toast: SettlementToast = {
        id: data.slipId,
        result: data.result,
        payoutCents: data.payoutCents,
      };

      setToasts((prev) => [...prev.slice(-2), toast]); // max 3 visible

      // Auto-dismiss after 6 seconds
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 6000);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(`user-${user.id}`);
    };
  }, [user]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-lg backdrop-blur-sm animate-fade-in ${
            toast.result === "won"
              ? "border-green-500/30 bg-green-500/15 text-white"
              : toast.result === "lost"
                ? "border-[var(--accent)]/30 bg-[var(--accent)]/15 text-white"
                : "border-white/15 bg-[var(--panel)] text-white"
          }`}
        >
          {toast.result === "won" ? (
            <CheckCircle className="size-5 shrink-0 text-green-400" />
          ) : toast.result === "lost" ? (
            <XCircle className="size-5 shrink-0 text-[var(--accent)]" />
          ) : (
            <MinusCircle className="size-5 shrink-0 text-[var(--muted-foreground)]" />
          )}
          <div>
            <div className="text-sm font-semibold">
              {toast.result === "won" && `Your slip WON — +${formatCurrency(toast.payoutCents)}`}
              {toast.result === "lost" && "Your slip LOST"}
              {toast.result === "push" && "Your slip PUSHED — stake returned"}
              {toast.result === "void" && "Your slip was voided — stake returned"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add `<SettlementListener />` to `AppShell`**

In `src/components/app-shell.tsx`, add the import:
```tsx
import { SettlementListener } from "@/components/settlement-listener";
```

Inside the return JSX, add `<SettlementListener />` just before the closing `</div>` of the root container:
```tsx
      <SettlementListener />
    </div>
  );
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 17 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/settlement-listener.tsx src/components/app-shell.tsx
git commit -m "feat: add SettlementListener for real-time settlement toasts via Pusher"
```

---

## Task 9: Odds Delta Badge on Today Page Game Cards

**Files:**
- Modify: `src/app/(app)/today/league-filter.tsx`
- Modify: `src/app/(app)/today/page.tsx`

- [ ] **Step 1: Update the local `GameOption` interface in `league-filter.tsx`**

Find the local `interface GameOption` in `src/app/(app)/today/league-filter.tsx` and add:

```typescript
interface GameOption {
  id: string;
  team: string;
  side: string;
  spread: number;
  americanOdds: number;
  market: string;
  openingPoint?: number;         // ADD
  openingAmericanOdds?: number;  // ADD
}
```

- [ ] **Step 2: Add a `LineDeltaBadge` helper component in `league-filter.tsx`**

Add this small component just before the main component export:

```tsx
function LineDeltaBadge({ current, opening }: { current: number; opening: number | undefined }) {
  if (opening == null) return null;
  const delta = current - opening;
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span className={`ml-1 text-[10px] font-mono ${up ? "text-amber-400" : "text-sky-400"}`}>
      {up ? "▲" : "▼"}{up ? "+" : ""}{delta}
    </span>
  );
}
```

- [ ] **Step 3: Render `LineDeltaBadge` next to the odds in the game card**

Find the existing odds rendering line in `league-filter.tsx`:
```tsx
{formatSpread(option.spread)} | {formatOdds(option.americanOdds)}
```

Replace with:
```tsx
{formatSpread(option.spread)}
<LineDeltaBadge current={option.spread} opening={option.openingPoint} />
{" | "}
{formatOdds(option.americanOdds)}
<LineDeltaBadge current={option.americanOdds} opening={option.openingAmericanOdds} />
```

- [ ] **Step 4: Pass `openingPoint` and `openingAmericanOdds` through in `today/page.tsx`**

In `src/app/(app)/today/page.tsx`, find the `filterableGames` mapping. Add the two fields to each option object:

```tsx
options: game.options.map((option) => ({
  id: option.id,
  team: option.team,
  side: option.side,
  spread: option.spread,
  americanOdds: option.americanOdds,
  market: option.market,
  openingPoint: option.openingPoint,              // ADD
  openingAmericanOdds: option.openingAmericanOdds, // ADD
})),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 17 pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/today/league-filter.tsx src/app/\(app\)/today/page.tsx
git commit -m "feat: add odds line movement delta badges on today page game cards"
```

---

## Task 10: Odds Delta Inline in Slip Builder

**Files:**
- Modify: `src/app/(app)/slips/slip-builder.tsx`
- Modify: `src/app/(app)/slips/page.tsx`

- [ ] **Step 1: Update the local `GameOption` interface in `slip-builder.tsx`**

Find `interface GameOption` in `slip-builder.tsx` and add:

```typescript
interface GameOption {
  id: string;
  team: string;
  side: string;
  spread: number;
  americanOdds: number;
  market: string;
  openingPoint?: number;         // ADD
  openingAmericanOdds?: number;  // ADD
}
```

- [ ] **Step 2: Add `LineDeltaBadge` helper in `slip-builder.tsx`**

Add the same helper as in Task 9 (copy it):

```tsx
function LineDeltaBadge({ current, opening }: { current: number; opening: number | undefined }) {
  if (opening == null) return null;
  const delta = current - opening;
  if (delta === 0) return null;
  const up = delta > 0;
  return (
    <span className={`ml-1 text-[10px] font-mono ${up ? "text-amber-400" : "text-sky-400"}`}>
      {up ? "▲" : "▼"}{up ? "+" : ""}{delta}
    </span>
  );
}
```

- [ ] **Step 3: Render delta in the odds selection button**

In `slip-builder.tsx`, find the odds display inside the selection button:
```tsx
{formatOdds(option.americanOdds)}
```
(Inside the `<div className={...font-mono text-xs...}>` element)

Replace with:
```tsx
{formatOdds(option.americanOdds)}
<LineDeltaBadge current={option.americanOdds} opening={option.openingAmericanOdds} />
```

Also add the spread delta (more prominent in slip builder). Find `getPickLabel(option)` display div and add after it:
```tsx
{option.market !== "h2h" && option.openingPoint != null && option.openingPoint !== option.spread && (
  <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)]" title="Moved from opening line">
    <LineDeltaBadge current={option.spread} opening={option.openingPoint} />
    <span className="ml-1">from open</span>
  </div>
)}
```

- [ ] **Step 4: Pass opening fields through in `slips/page.tsx`**

In `src/app/(app)/slips/page.tsx`, find the `availableGames` mapping options:

```tsx
options: game.options.map((option) => ({
  id: option.id,
  team: option.team,
  side: option.side,
  spread: option.spread,
  americanOdds: option.americanOdds,
  market: option.market,
  openingPoint: option.openingPoint,               // ADD
  openingAmericanOdds: option.openingAmericanOdds,  // ADD
})),
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Run tests**

```bash
npm test
```

Expected: 17 pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/slips/slip-builder.tsx src/app/\(app\)/slips/page.tsx
git commit -m "feat: add inline odds line movement delta in slip builder"
```

---

## Task 11: Final Verification and Deploy

- [ ] **Step 1: Full test suite**

```bash
npm test
```

Expected: 17/17 pass.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Push to remote**

```bash
git push origin main
```

- [ ] **Step 4: Deploy to production**

```bash
npx vercel --prod --yes
```

Expected: Build succeeds, all 24 routes compiled, deployment aliased to `theboyzpick.vercel.app`.

- [ ] **Step 5: Smoke test in production**

- Navigate to `/admin/ops` — confirm cron job cards and anomaly table render
- Trigger a manual settlement from `/admin` — confirm toast appears on member screen
- Check game cards on `/today` and `/slips` — confirm delta badges show after next odds sync
