import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";

import { buildSpreadIntelligence, rankAnomalyAlerts, summarizeOpsHealth } from "@/lib/ai";
import {
  calculateParlayPayout,
  calculateStraightPayout,
  scoreSpreadLeg,
  scoreTotalsLeg,
  settleSlip,
} from "@/lib/betting";
import {
  defaultSettings,
  defaultStartingBalanceCents,
  leagueProviders,
} from "@/lib/constants";
import { getDb } from "@/lib/db/client";
import {
  aiMarketSnapshots,
  anomalyAlerts,
  adminAuditLogArchives,
  adminAuditLogs,
  appSettings,
  betLegs,
  betSlips,
  comments,
  games,
  leagues,
  lockPicks,
  oddsQuotes,
  reactions,
  opsHealthReports,
  topUpRequests,
  userProfiles,
  walletAccounts,
  walletLedgerEntries,
} from "@/lib/db/schema";
import { sendSettlementEmails, type SettledSlipRecord } from "@/lib/email";
import { getAdminEmails, getAppMode, getClubTimeZone } from "@/lib/env";
import { fetchLeagueOdds, fetchLeagueScores } from "@/lib/odds-api";
import { getWeekKey, isDateOnOrAfterWeekKey } from "@/lib/time";
import type {
  AdminAnomalyAlert,
  AdminSnapshot,
  AppSettings,
  AuditItem,
  BetLegView,
  BetSlipView,
  GameCard,
  GameOption,
  LeaderboardEntry,
  LockPickView,
  MemberSnapshot,
  OpsAutopilotMode,
  OpsFinding,
  OpsHealthReport,
  OpsRemediation,
  RivalryEntry,
  SelectionReference,
  TopUpRequestView,
  ViewerProfile,
  WalletLedgerEntry,
  WalletView,
  WeekLockFeedEntry,
} from "@/lib/types";

type AuditMetadata = Record<string, unknown> | undefined;
type DbInstance = NonNullable<ReturnType<typeof getDb>>;
type DbTransaction = Parameters<Parameters<DbInstance["transaction"]>[0]>[0];

function dbOrThrow() {
  const db = getDb();
  if (!db) {
    throw new Error("DATABASE_URL is required for live data operations.");
  }

  return db;
}

function now() {
  return new Date();
}

function toIso(value: Date | string | null | undefined) {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function numericToNumber(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

function currentWeekKey() {
  return getWeekKey(new Date(), getClubTimeZone());
}

async function ensureCoreData() {
  const db = dbOrThrow();

  await Promise.all(
    Object.entries(leagueProviders).map(([slug, provider]) =>
      db
        .insert(leagues)
        .values({
          slug,
          label: provider.label,
          sportKey: provider.sportKey,
          enabled: true,
          sortOrder: provider.sortOrder,
        })
        .onConflictDoUpdate({
          target: leagues.slug,
          set: {
            label: provider.label,
            sportKey: provider.sportKey,
            sortOrder: provider.sortOrder,
          },
        }),
    ),
  );

  const rows = [
    ["primaryBookmaker", defaultSettings.primaryBookmaker],
    ["minStakeCents", defaultSettings.minStakeCents],
    ["maxStakeCents", defaultSettings.maxStakeCents],
    ["maxOpenSlipsPerUser", defaultSettings.maxOpenSlipsPerUser],
    ["bankrollInstructions", defaultSettings.bankrollInstructions],
    ["maintenanceMode", defaultSettings.maintenanceMode],
  ] as const;

  await Promise.all(
    rows.map(([key, value]) =>
      db.insert(appSettings).values({ key, value: { value } }).onConflictDoNothing(),
    ),
  );
}

export async function loadSettingsLive(): Promise<AppSettings> {
  await ensureCoreData();
  const db = dbOrThrow();
  const [leagueRows, settingRows] = await Promise.all([
    db.select().from(leagues).orderBy(asc(leagues.sortOrder)),
    db.select().from(appSettings),
  ]);

  const settingMap = new Map(settingRows.map((row) => [row.key, row.value?.value]));

  return {
    enabledLeagues: leagueRows
      .filter((row) => row.enabled)
      .map((row) => row.slug as AppSettings["enabledLeagues"][number]),
    primaryBookmaker:
      (settingMap.get("primaryBookmaker") as string | undefined) ??
      defaultSettings.primaryBookmaker,
    minStakeCents: Number(settingMap.get("minStakeCents") ?? defaultSettings.minStakeCents),
    maxStakeCents: Number(settingMap.get("maxStakeCents") ?? defaultSettings.maxStakeCents),
    maxOpenSlipsPerUser: Number(
      settingMap.get("maxOpenSlipsPerUser") ?? defaultSettings.maxOpenSlipsPerUser,
    ),
    bankrollInstructions:
      (settingMap.get("bankrollInstructions") as string | undefined) ??
      defaultSettings.bankrollInstructions,
    maintenanceMode: Boolean(
      settingMap.get("maintenanceMode") ?? defaultSettings.maintenanceMode,
    ),
  };
}

function mapViewer(row: typeof userProfiles.$inferSelect): ViewerProfile {
  return {
    id: row.id,
    clerkUserId: row.clerkUserId,
    email: row.email,
    displayName: row.displayName,
    nickname: row.nickname,
    imageUrl: row.imageUrl ?? undefined,
    role: row.role,
    status: row.status,
    joinedAt: toIso(row.createdAt)!,
  };
}

function mapLedger(row: typeof walletLedgerEntries.$inferSelect): WalletLedgerEntry {
  return {
    id: row.id,
    userId: row.userProfileId,
    type: row.entryType as WalletLedgerEntry["type"],
    amountCents: row.amountCents,
    balanceAfterCents: row.balanceAfterCents,
    note: row.note,
    referenceId: row.referenceId ?? undefined,
    createdAt: toIso(row.createdAt)!,
  };
}

function mapTopUp(row: typeof topUpRequests.$inferSelect): TopUpRequestView {
  return {
    id: row.id,
    userId: row.userProfileId,
    amountCents: row.amountCents,
    status: row.status,
    note: row.note ?? undefined,
    requestedAt: toIso(row.requestedAt)!,
    approvedAt: toIso(row.approvedAt),
    approvedBy: row.approvedByUserProfileId ?? undefined,
  };
}

function mapAudit(row: typeof adminAuditLogs.$inferSelect): AuditItem {
  return {
    id: row.id,
    actorUserId: row.actorUserProfileId ?? undefined,
    actorEmail: row.actorEmail ?? undefined,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    requestId: row.requestId ?? undefined,
    ipHash: row.ipHash ?? undefined,
    outcome: row.outcome,
    metadata: row.metadata ?? undefined,
    createdAt: toIso(row.createdAt)!,
  };
}

function mapLockPick(row: typeof lockPicks.$inferSelect): LockPickView {
  return {
    id: row.id,
    userId: row.userProfileId,
    gameId: row.gameId,
    weekKey: row.weekKey,
    selectionId: row.selectionId,
    selectionTeam: row.selectionTeam,
    selectionSide: row.selectionSide as LockPickView["selectionSide"],
    spread: numericToNumber(row.spread),
    americanOdds: row.americanOdds,
    bookmaker: row.bookmakerKey,
    quoteTimestamp: toIso(row.quoteTimestamp)!,
    result: row.result,
    note: row.note ?? undefined,
    createdAt: toIso(row.createdAt)!,
  };
}

function mapOpsHealthReport(row: typeof opsHealthReports.$inferSelect): OpsHealthReport {
  return {
    id: row.id,
    mode: row.mode as OpsAutopilotMode,
    score: row.score,
    summary: row.summary,
    findings: (row.findings as unknown as OpsFinding[]) ?? [],
    remediations: (row.remediations as unknown as OpsRemediation[]) ?? [],
    createdAt: toIso(row.createdAt)!,
  };
}

function mapAnomalyAlert(row: typeof anomalyAlerts.$inferSelect): AdminAnomalyAlert {
  return {
    id: row.id,
    category: row.category as AdminAnomalyAlert["category"],
    severity: row.severity as AdminAnomalyAlert["severity"],
    title: row.title,
    detail: row.detail,
    userIds: row.userIds ?? [],
    createdAt: toIso(row.createdAt)!,
  };
}

async function ensureWalletTx(
  tx: DbTransaction,
  userId: string,
) {
  const existing = await tx
    .select()
    .from(walletAccounts)
    .where(eq(walletAccounts.userProfileId, userId))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const inserted = await tx
    .insert(walletAccounts)
    .values({
      userProfileId: userId,
      balanceCents: defaultStartingBalanceCents,
    })
    .onConflictDoNothing()
    .returning();

  const wallet =
    inserted[0] ??
    (
      await tx
        .select()
        .from(walletAccounts)
        .where(eq(walletAccounts.userProfileId, userId))
        .limit(1)
    )[0];

  if (!wallet) {
    throw new Error("Unable to initialize wallet.");
  }

  if (inserted[0]) {
    await tx.insert(walletLedgerEntries).values({
      userProfileId: userId,
      entryType: "seed",
      amountCents: defaultStartingBalanceCents,
      balanceAfterCents: defaultStartingBalanceCents,
      note: "Opening club bankroll",
      referenceId: `wallet_seed:${userId}`,
    });
  }

  return wallet;
}

async function creditWalletTx(
  tx: DbTransaction,
  userId: string,
  amountCents: number,
  type: WalletLedgerEntry["type"],
  note: string,
  referenceId?: string,
) {
  await ensureWalletTx(tx, userId);
  const updated = await tx
    .update(walletAccounts)
    .set({
      balanceCents: sql`${walletAccounts.balanceCents} + ${amountCents}`,
      updatedAt: now(),
    })
    .where(eq(walletAccounts.userProfileId, userId))
    .returning();

  const wallet = updated[0];
  if (!wallet) {
    throw new Error("Wallet not found for credit operation.");
  }

  await tx.insert(walletLedgerEntries).values({
    userProfileId: userId,
    entryType: type,
    amountCents,
    balanceAfterCents: wallet.balanceCents,
    note,
    referenceId,
  });

  return wallet.balanceCents;
}

async function debitWalletTx(
  tx: DbTransaction,
  userId: string,
  amountCents: number,
  type: WalletLedgerEntry["type"],
  note: string,
  referenceId?: string,
) {
  await ensureWalletTx(tx, userId);
  const updated = await tx
    .update(walletAccounts)
    .set({
      balanceCents: sql`${walletAccounts.balanceCents} - ${amountCents}`,
      updatedAt: now(),
    })
    .where(
      and(
        eq(walletAccounts.userProfileId, userId),
        gte(walletAccounts.balanceCents, amountCents),
      ),
    )
    .returning();

  const wallet = updated[0];
  if (!wallet) {
    throw new Error("Wallet balance is too low for that stake.");
  }

  await tx.insert(walletLedgerEntries).values({
    userProfileId: userId,
    entryType: type,
    amountCents: amountCents * -1,
    balanceAfterCents: wallet.balanceCents,
    note,
    referenceId,
  });

  return wallet.balanceCents;
}

async function ensureWallet(userId: string) {
  const db = dbOrThrow();
  return db.transaction(async (tx) => ensureWalletTx(tx, userId));
}

async function getWalletView(userId: string): Promise<WalletView> {
  const db = dbOrThrow();
  const account = await ensureWallet(userId);
  const ledgerRows = await db
    .select()
    .from(walletLedgerEntries)
    .where(eq(walletLedgerEntries.userProfileId, userId))
    .orderBy(desc(walletLedgerEntries.createdAt))
    .limit(40);

  return {
    userId,
    balanceCents: account.balanceCents,
    ledger: ledgerRows.map(mapLedger),
  };
}

export async function recordAudit(
  actor:
    | {
        userId?: string;
        email?: string;
      }
    | undefined,
  action: string,
  targetType: string,
  targetId: string,
  options?: {
    outcome?: string;
    requestId?: string;
    ipHash?: string;
    metadata?: AuditMetadata;
  },
) {
  await dbOrThrow().insert(adminAuditLogs).values({
    actorUserProfileId: actor?.userId,
    actorEmail: actor?.email,
    action,
    targetType,
    targetId,
    requestId: options?.requestId,
    ipHash: options?.ipHash,
    outcome: options?.outcome ?? "success",
    metadata: options?.metadata,
  });
}

async function lockUserScopeTx(tx: DbTransaction, userId: string) {
  await tx.execute(
    sql`select ${userProfiles.id} from ${userProfiles} where ${userProfiles.id} = ${userId} for update`,
  );
}

async function archiveAuditLogsLive(retentionDays = 90, batchSize = 500) {
  const db = dbOrThrow();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  return db.transaction(async (tx) => {
    const staleRows = await tx
      .select()
      .from(adminAuditLogs)
      .where(sql`${adminAuditLogs.createdAt} < ${cutoff}`)
      .orderBy(asc(adminAuditLogs.createdAt))
      .limit(batchSize);

    if (staleRows.length === 0) {
      return 0;
    }

    await tx.insert(adminAuditLogArchives).values(
      staleRows.map((row) => ({
        ...row,
        archivedAt: now(),
      })),
    );

    await tx.delete(adminAuditLogs).where(inArray(adminAuditLogs.id, staleRows.map((row) => row.id)));
    return staleRows.length;
  });
}

function marketHistoryKey(gameId: string, side: string) {
  return `${gameId}:${side}`;
}

async function loadMarketSnapshotHistory(gameIds: string[]) {
  if (gameIds.length === 0) {
    return new Map<
      string,
      Array<{ spread: number; americanOdds: number; capturedAt: string }>
    >();
  }

  const rows = await dbOrThrow()
    .select()
    .from(aiMarketSnapshots)
    .where(
      and(
        inArray(aiMarketSnapshots.gameId, gameIds),
        gte(aiMarketSnapshots.capturedAt, new Date(Date.now() - 36 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(desc(aiMarketSnapshots.capturedAt));

  const history = new Map<
    string,
    Array<{ spread: number; americanOdds: number; capturedAt: string }>
  >();

  for (const row of rows) {
    const key = marketHistoryKey(row.gameId, row.selectionSide);
    const bucket = history.get(key) ?? [];
    bucket.push({
      spread: numericToNumber(row.spread),
      americanOdds: row.americanOdds,
      capturedAt: toIso(row.capturedAt)!,
    });
    history.set(key, bucket);
  }

  return history;
}

async function persistMarketSnapshots(input: {
  gameId: string;
  leagueSlug: string;
  bookmakerKey: string;
  outcomes: Array<{
    side: "home" | "away";
    spread: number;
    americanOdds: number;
  }>;
}) {
  await dbOrThrow().insert(aiMarketSnapshots).values(
    input.outcomes.map((outcome) => ({
      gameId: input.gameId,
      leagueSlug: input.leagueSlug,
      bookmakerKey: input.bookmakerKey,
      selectionSide: outcome.side,
      spread: String(outcome.spread),
      americanOdds: outcome.americanOdds,
    })),
  );
}

async function cleanupAiTablesLive() {
  const db = dbOrThrow();
  const snapshotsCutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);
  const alertsCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const deletedSnapshots = await db
    .delete(aiMarketSnapshots)
    .where(sql`${aiMarketSnapshots.capturedAt} < ${snapshotsCutoff}`)
    .returning({ id: aiMarketSnapshots.id });

  const deletedAlerts = await db
    .delete(anomalyAlerts)
    .where(sql`${anomalyAlerts.createdAt} < ${alertsCutoff}`)
    .returning({ id: anomalyAlerts.id });

  return {
    deletedSnapshots: deletedSnapshots.length,
    deletedAlerts: deletedAlerts.length,
  };
}

async function computeOpenSlipSettlementLag() {
  const db = dbOrThrow();
  const openSlips = await db
    .select()
    .from(betSlips)
    .where(eq(betSlips.status, "open"))
    .orderBy(desc(betSlips.createdAt))
    .limit(300);

  if (openSlips.length === 0) {
    return 0;
  }

  const slipLegRows = await db
    .select()
    .from(betLegs)
    .where(inArray(betLegs.betSlipId, openSlips.map((row) => row.id)));
  const relatedGameRows = await db
    .select()
    .from(games)
    .where(inArray(games.id, Array.from(new Set(slipLegRows.map((row) => row.gameId)))));
  const gameMap = new Map(relatedGameRows.map((row) => [row.id, row.status]));

  let lagged = 0;
  for (const slip of openSlips) {
    const legs = slipLegRows.filter((leg) => leg.betSlipId === slip.id);
    if (legs.length === 0) {
      continue;
    }

    const allGradedReady = legs.every((leg) => {
      const status = gameMap.get(leg.gameId);
      return status === "final" || status === "cancelled" || status === "postponed";
    });

    if (allGradedReady && +new Date(slip.createdAt) < Date.now() - 20 * 60 * 1000) {
      lagged += 1;
    }
  }

  return lagged;
}

async function detectAnomalyAlertsLive(): Promise<AdminAnomalyAlert[]> {
  const db = dbOrThrow();
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const alerts: AdminAnomalyAlert[] = [];

  const [rateLimitRows, recentSlips, ledgerRows] = await Promise.all([
    db
      .select()
      .from(adminAuditLogs)
      .where(
        and(
          eq(adminAuditLogs.action, "rate_limit_blocked"),
          gte(adminAuditLogs.createdAt, windowStart),
        ),
      ),
    db
      .select()
      .from(betSlips)
      .where(gte(betSlips.createdAt, windowStart))
      .orderBy(desc(betSlips.createdAt))
      .limit(400),
    db
      .select()
      .from(walletLedgerEntries)
      .where(
        and(
          gte(walletLedgerEntries.createdAt, windowStart),
          inArray(walletLedgerEntries.entryType, ["top_up", "payout", "adjustment"]),
        ),
      ),
  ]);

  if (rateLimitRows.length >= 12) {
    alerts.push({
      id: randomUUID(),
      category: "abuse",
      severity: rateLimitRows.length >= 30 ? "critical" : "warning",
      title: "Rate-limit spike detected",
      detail: `${rateLimitRows.length} rate-limit blocks in the last 24 hours.`,
      userIds: Array.from(
        new Set(rateLimitRows.map((row) => row.actorUserProfileId).filter(Boolean)),
      ) as string[],
      createdAt: now().toISOString(),
    });
  }

  const slipIds = recentSlips.map((row) => row.id);
  const legRows = slipIds.length
    ? await db.select().from(betLegs).where(inArray(betLegs.betSlipId, slipIds))
    : [];
  const legsBySlip = new Map<string, string[]>();
  for (const leg of legRows) {
    const list = legsBySlip.get(leg.betSlipId) ?? [];
    list.push(leg.selectionId);
    legsBySlip.set(leg.betSlipId, list);
  }

  const fingerprintMap = new Map<
    string,
    Array<{ userId: string; createdAt: Date }>
  >();
  for (const slip of recentSlips) {
    const fingerprint = (legsBySlip.get(slip.id) ?? []).sort().join("|");
    if (!fingerprint) {
      continue;
    }

    const list = fingerprintMap.get(fingerprint) ?? [];
    list.push({ userId: slip.userProfileId, createdAt: new Date(slip.createdAt) });
    fingerprintMap.set(fingerprint, list);
  }

  for (const [fingerprint, entries] of fingerprintMap) {
    const uniqueUsers = Array.from(new Set(entries.map((entry) => entry.userId)));
    if (uniqueUsers.length < 2 || entries.length < 3) {
      continue;
    }

    const minTime = Math.min(...entries.map((entry) => entry.createdAt.getTime()));
    const maxTime = Math.max(...entries.map((entry) => entry.createdAt.getTime()));
    if (maxTime - minTime > 30 * 60 * 1000) {
      continue;
    }

    alerts.push({
      id: randomUUID(),
      category: "collusion",
      severity: entries.length >= 6 ? "critical" : "warning",
      title: "Repeated synchronized slip pattern",
      detail: `Pattern "${fingerprint}" appeared ${entries.length} times across ${uniqueUsers.length} members within 30 minutes.`,
      userIds: uniqueUsers,
      createdAt: now().toISOString(),
    });
  }

  const walletMetrics = new Map<
    string,
    { topUps: number; netCents: number; entries: number }
  >();
  for (const row of ledgerRows) {
    const metric = walletMetrics.get(row.userProfileId) ?? {
      topUps: 0,
      netCents: 0,
      entries: 0,
    };
    metric.entries += 1;
    metric.netCents += row.amountCents;
    if (row.entryType === "top_up") {
      metric.topUps += 1;
    }
    walletMetrics.set(row.userProfileId, metric);
  }

  for (const [userId, metric] of walletMetrics) {
    const severeTopUps = metric.topUps >= 12;
    const severeNet = Math.abs(metric.netCents) >= 150_000;
    const warningTopUps = metric.topUps >= 6;
    const warningNet = Math.abs(metric.netCents) >= 75_000;

    if (!(severeTopUps || severeNet || warningTopUps || warningNet)) {
      continue;
    }

    alerts.push({
      id: randomUUID(),
      category: "wallet",
      severity: severeTopUps || severeNet ? "critical" : "warning",
      title: "Unusual bankroll trajectory",
      detail: `Member activity in 24h: ${metric.topUps} top-ups, net ${metric.netCents} cents across ${metric.entries} ledger entries.`,
      userIds: [userId],
      createdAt: now().toISOString(),
    });
  }

  return rankAnomalyAlerts(alerts).slice(0, 15);
}

async function persistAnomalyAlertsLive(alerts: AdminAnomalyAlert[]) {
  if (alerts.length === 0) {
    return 0;
  }

  const inserted = await dbOrThrow()
    .insert(anomalyAlerts)
    .values(
      alerts.map((alert) => ({
        id: alert.id,
        category: alert.category,
        severity: alert.severity,
        title: alert.title,
        detail: alert.detail,
        userIds: alert.userIds,
      })),
    )
    .returning({ id: anomalyAlerts.id });

  return inserted.length;
}

async function getLatestOpsHealthReportLive() {
  const rows = await dbOrThrow()
    .select()
    .from(opsHealthReports)
    .orderBy(desc(opsHealthReports.createdAt))
    .limit(1);

  return rows[0] ? mapOpsHealthReport(rows[0]) : undefined;
}

async function getRecentAnomalyAlertsLive(limit = 12) {
  const rows = await dbOrThrow()
    .select()
    .from(anomalyAlerts)
    .where(sql`${anomalyAlerts.resolvedAt} is null`)
    .orderBy(desc(anomalyAlerts.createdAt))
    .limit(limit);

  return rows.map(mapAnomalyAlert);
}

async function buildGameCards(
  settings: AppSettings,
): Promise<{ games: GameCard[]; selections: Map<string, SelectionReference> }> {
  const db = dbOrThrow();
  if (settings.enabledLeagues.length === 0) {
    return { games: [], selections: new Map() };
  }

  const gameRows = await db
    .select()
    .from(games)
    .where(inArray(games.leagueSlug, settings.enabledLeagues))
    .orderBy(asc(games.commenceTime));

  if (gameRows.length === 0) {
    return { games: [], selections: new Map() };
  }

  const quoteRows = await db
    .select()
    .from(oddsQuotes)
    .where(inArray(oddsQuotes.gameId, gameRows.map((row) => row.id)));
  const gameMap = new Map(gameRows.map((row) => [row.id, row]));
  const historyByMarket = await loadMarketSnapshotHistory(gameRows.map((row) => row.id));

  const optionsByGame = new Map<string, GameOption[]>();
  const selections = new Map<string, SelectionReference>();

  for (const row of quoteRows) {
    const game = gameMap.get(row.gameId);
    if (!game) {
      continue;
    }

    const marketHistory =
      historyByMarket.get(marketHistoryKey(row.gameId, row.selectionSide)) ?? [];
    const option: GameOption = {
      id: row.id,
      team: row.selectionTeam,
      side: row.selectionSide as GameOption["side"],
      spread: numericToNumber(row.point),
      americanOdds: row.americanOdds,
      market: row.market as GameOption["market"],
      bookmaker: row.bookmakerKey,
      quoteTimestamp: toIso(row.quoteTimestamp)!,
      intelligence: buildSpreadIntelligence({
        currentSpread: numericToNumber(row.point),
        currentOdds: row.americanOdds,
        history: marketHistory.slice(0, 8),
        commenceTime: toIso(game.commenceTime)!,
      }),
    };

    const list = optionsByGame.get(row.gameId) ?? [];
    list.push(option);
    optionsByGame.set(row.gameId, list);
  }

  const mappedGames = gameRows
    .map((row) => {
      if (row.status === "final" || row.status === "cancelled" || row.status === "postponed") {
        return null;
      }

      const options = (optionsByGame.get(row.id) ?? []).filter(
        (option) => option.bookmaker === settings.primaryBookmaker,
      );

      if (options.length === 0) {
        return null;
      }

      const card: GameCard = {
        id: row.id,
        league: row.leagueSlug as GameCard["league"],
        matchup: `${row.awayTeam} @ ${row.homeTeam}`,
        homeTeam: row.homeTeam,
        awayTeam: row.awayTeam,
        commenceTime: toIso(row.commenceTime)!,
        status: row.status,
        homeScore: row.homeScore ?? undefined,
        awayScore: row.awayScore ?? undefined,
        options,
      };

      for (const option of options) {
        selections.set(option.id, {
          gameId: row.id,
          option,
        });
      }

      return card;
    })
    .filter((row): row is GameCard => Boolean(row));

  return { games: mappedGames, selections };
}

async function getSlipViews(userId: string): Promise<BetSlipView[]> {
  const db = dbOrThrow();
  const slipRows = await db
    .select()
    .from(betSlips)
    .where(eq(betSlips.userProfileId, userId))
    .orderBy(desc(betSlips.createdAt));

  if (slipRows.length === 0) {
    return [];
  }

  const legRows = await db
    .select()
    .from(betLegs)
    .where(inArray(betLegs.betSlipId, slipRows.map((row) => row.id)));
  const gameRows = await db
    .select()
    .from(games)
    .where(inArray(games.id, Array.from(new Set(legRows.map((row) => row.gameId)))));
  const gameMap = new Map(gameRows.map((row) => [row.id, row]));
  const legsBySlip = new Map<string, BetLegView[]>();

  for (const row of legRows) {
    const game = gameMap.get(row.gameId);
    const view: BetLegView = {
      id: row.id,
      gameId: row.gameId,
      selectionId: row.selectionId,
      selectionTeam: row.selectionTeam,
      selectionSide: row.selectionSide as BetLegView["selectionSide"],
      spread: numericToNumber(row.spread),
      americanOdds: row.americanOdds,
      bookmaker: row.bookmakerKey,
      quoteTimestamp: toIso(row.quoteTimestamp)!,
      result: row.result,
      homeScore: game?.homeScore ?? undefined,
      awayScore: game?.awayScore ?? undefined,
    };

    const list = legsBySlip.get(row.betSlipId) ?? [];
    list.push(view);
    legsBySlip.set(row.betSlipId, list);
  }

  return slipRows.map((row) => ({
    id: row.id,
    userId: row.userProfileId,
    type: row.slipType,
    stakeCents: row.stakeCents,
    potentialPayoutCents: row.potentialPayoutCents,
    payoutCents: row.payoutCents,
    status: row.status,
    createdAt: toIso(row.createdAt)!,
    settledAt: toIso(row.settledAt),
    legs: legsBySlip.get(row.id) ?? [],
  }));
}

export async function getPublicLeaderboardsLive(): Promise<{
  leaderboards: LeaderboardEntry[];
  rivalryBoard: RivalryEntry[];
}> {
  return computeLeaderboards();
}

async function computeLeaderboards(): Promise<{
  leaderboards: LeaderboardEntry[];
  rivalryBoard: RivalryEntry[];
}> {
  const db = dbOrThrow();
  const [users, wallets, slips, picks] = await Promise.all([
    db.select().from(userProfiles),
    db.select().from(walletAccounts),
    db.select().from(betSlips),
    db.select().from(lockPicks),
  ]);

  const walletMap = new Map(wallets.map((row) => [row.userProfileId, row.balanceCents]));
  const weekKey = currentWeekKey();

  const leaderboards = users
    .map((user) => {
      const userSlips = slips.filter((slip) => slip.userProfileId === user.id);
      const graded = userSlips.filter((slip) => slip.status !== "open");
      const wins = graded.filter((slip) => slip.status === "won").length;
      const losses = graded.filter((slip) => slip.status === "lost").length;
      const pushes = graded.filter(
        (slip) => slip.status === "push" || slip.status === "void",
      ).length;
      const staked = graded.reduce((total, slip) => total + slip.stakeCents, 0);
      const returned = graded.reduce((total, slip) => total + slip.payoutCents, 0);
      const roiPercent =
        staked === 0 ? 0 : Number((((returned - staked) / staked) * 100).toFixed(1));
      const streak = [...graded]
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
        .reduce((count, slip) => (count >= 0 && slip.status === "won" ? count + 1 : -1), 0);

      return {
        userId: user.id,
        displayName: user.nickname ?? user.displayName,
        bankrollCents: walletMap.get(user.id) ?? 0,
        roiPercent,
        wins,
        losses,
        pushes,
        streak: Math.max(streak, 0),
        lockPoints: picks.filter((pick) => pick.userProfileId === user.id && pick.result === "win")
          .length,
      };
    })
    .sort(
      (left, right) =>
        right.bankrollCents - left.bankrollCents || right.roiPercent - left.roiPercent,
    );

  const rivalryBoard = users
    .map((user) => {
      const weeklySlips = slips.filter(
        (slip) =>
          slip.userProfileId === user.id &&
          slip.status !== "open" &&
          isDateOnOrAfterWeekKey(
            new Date(slip.createdAt),
            weekKey,
            getClubTimeZone(),
          ),
      );
      const weeklyWins = weeklySlips.filter((slip) => slip.status === "won").length;
      const weeklyLosses = weeklySlips.filter((slip) => slip.status === "lost").length;
      const staked = weeklySlips.reduce((total, slip) => total + slip.stakeCents, 0);
      const returned = weeklySlips.reduce((total, slip) => total + slip.payoutCents, 0);

      return {
        displayName: user.nickname ?? user.displayName,
        weeklyWins,
        weeklyLosses,
        weeklyRoiPercent:
          staked === 0 ? 0 : Number((((returned - staked) / staked) * 100).toFixed(1)),
      };
    })
    .sort(
      (left, right) =>
        right.weeklyWins - left.weeklyWins || right.weeklyRoiPercent - left.weeklyRoiPercent,
    );

  return { leaderboards, rivalryBoard };
}

// ── Social features ────────────────────────────────────────────────

export async function toggleReactionLive(
  userId: string,
  targetType: string,
  targetId: string,
  emoji: string,
): Promise<"added" | "removed"> {
  const db = dbOrThrow();
  // Check if reaction already exists
  const [existing] = await db
    .select()
    .from(reactions)
    .where(
      and(
        eq(reactions.userProfileId, userId),
        eq(reactions.targetType, targetType),
        eq(reactions.targetId, targetId),
        eq(reactions.emoji, emoji),
      ),
    )
    .limit(1);

  if (existing) {
    await db.delete(reactions).where(eq(reactions.id, existing.id));
    return "removed";
  }

  await db.insert(reactions).values({
    userProfileId: userId,
    targetType,
    targetId,
    emoji,
  });
  return "added";
}

export async function addCommentLive(
  userId: string,
  targetType: string,
  targetId: string,
  body: string,
): Promise<void> {
  const db = dbOrThrow();
  await db.insert(comments).values({
    userProfileId: userId,
    targetType,
    targetId,
    body: body.slice(0, 280),
  });
}

export async function deleteCommentLive(
  userId: string,
  commentId: string,
): Promise<boolean> {
  const db = dbOrThrow();
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);
  if (!comment || comment.userProfileId !== userId) return false;
  await db.delete(comments).where(eq(comments.id, commentId));
  return true;
}

export async function getReactionSummariesLive(
  viewerUserId: string,
  targetType: string,
  targetIds: string[],
): Promise<Map<string, import("@/lib/types").ReactionSummary[]>> {
  const result = new Map<string, import("@/lib/types").ReactionSummary[]>();
  if (targetIds.length === 0) return result;

  const db = dbOrThrow();
  const allReactions = await db
    .select()
    .from(reactions)
    .where(
      and(eq(reactions.targetType, targetType), inArray(reactions.targetId, targetIds)),
    );

  // Group by targetId + emoji
  for (const targetId of targetIds) {
    const targetReactions = allReactions.filter((r) => r.targetId === targetId);
    const emojiMap = new Map<string, { count: number; userReacted: boolean }>();

    for (const r of targetReactions) {
      const entry = emojiMap.get(r.emoji) ?? { count: 0, userReacted: false };
      entry.count++;
      if (r.userProfileId === viewerUserId) entry.userReacted = true;
      emojiMap.set(r.emoji, entry);
    }

    const summaries: import("@/lib/types").ReactionSummary[] = [];
    for (const [emoji, data] of emojiMap) {
      summaries.push({
        emoji: emoji as import("@/lib/types").ReactionEmoji,
        count: data.count,
        userReacted: data.userReacted,
      });
    }
    result.set(targetId, summaries);
  }

  return result;
}

export async function getCommentsLive(
  targetType: string,
  targetIds: string[],
): Promise<Map<string, import("@/lib/types").CommentView[]>> {
  const result = new Map<string, import("@/lib/types").CommentView[]>();
  if (targetIds.length === 0) return result;

  const db = dbOrThrow();
  const rows = await db
    .select({
      id: comments.id,
      userProfileId: comments.userProfileId,
      targetId: comments.targetId,
      body: comments.body,
      createdAt: comments.createdAt,
      displayName: userProfiles.displayName,
      nickname: userProfiles.nickname,
    })
    .from(comments)
    .innerJoin(userProfiles, eq(comments.userProfileId, userProfiles.id))
    .where(
      and(eq(comments.targetType, targetType), inArray(comments.targetId, targetIds)),
    )
    .orderBy(asc(comments.createdAt));

  for (const row of rows) {
    const views = result.get(row.targetId) ?? [];
    views.push({
      id: row.id,
      userProfileId: row.userProfileId,
      displayName: row.nickname ?? row.displayName,
      body: row.body,
      createdAt: toIso(row.createdAt) ?? new Date().toISOString(),
    });
    result.set(row.targetId, views);
  }

  return result;
}

export async function getMemberProfileLive(userId: string): Promise<import("@/lib/types").MemberProfile | null> {
  const db = dbOrThrow();
  const [user] = await db.select().from(userProfiles).where(eq(userProfiles.id, userId)).limit(1);
  if (!user) return null;

  const [wallet, slips, legs, picks] = await Promise.all([
    db.select().from(walletAccounts).where(eq(walletAccounts.userProfileId, userId)),
    db.select().from(betSlips).where(eq(betSlips.userProfileId, userId)),
    db.select().from(betLegs).where(
      inArray(betLegs.betSlipId, db.select({ id: betSlips.id }).from(betSlips).where(eq(betSlips.userProfileId, userId)))
    ),
    db.select().from(lockPicks).where(eq(lockPicks.userProfileId, userId)),
  ]);

  const graded = slips.filter((s) => s.status !== "open");
  const wins = graded.filter((s) => s.status === "won").length;
  const losses = graded.filter((s) => s.status === "lost").length;
  const pushes = graded.filter((s) => s.status === "push" || s.status === "void").length;
  const staked = slips.reduce((sum, s) => sum + s.stakeCents, 0);
  const returned = slips.reduce((sum, s) => sum + s.payoutCents, 0);
  const roiPercent = staked === 0 ? 0 : Number((((returned - staked) / staked) * 100).toFixed(1));

  const streak = [...graded]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .reduce((count, slip) => (count >= 0 && slip.status === "won" ? count + 1 : -1), 0);

  // Best parlay
  const wonParlays = slips.filter((s) => s.slipType === "parlay" && s.status === "won");
  let bestParlayPayoutCents = 0;
  let bestParlayLegCount = 0;
  for (const parlay of wonParlays) {
    if (parlay.payoutCents > bestParlayPayoutCents) {
      bestParlayPayoutCents = parlay.payoutCents;
      bestParlayLegCount = legs.filter((l) => l.betSlipId === parlay.id).length;
    }
  }

  const lockPickHistory = [...picks]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 50)
    .map((pick) => ({
      selectionTeam: pick.selectionTeam,
      spread: Number(pick.spread),
      americanOdds: pick.americanOdds,
      result: pick.result as import("@/lib/types").BetLegResult,
      note: pick.note ?? undefined,
      weekKey: pick.weekKey,
    }));

  return {
    userId: user.id,
    displayName: user.nickname ?? user.displayName,
    joinedAt: toIso(user.createdAt) ?? new Date().toISOString(),
    record: { wins, losses, pushes },
    bankrollCents: wallet[0]?.balanceCents ?? 0,
    roiPercent,
    streak: Math.max(streak, 0),
    lockPoints: picks.filter((p) => p.result === "win").length,
    lockPickHistory,
    bestParlayPayoutCents,
    bestParlayLegCount,
    totalSlips: slips.length,
    totalParlays: slips.filter((s) => s.slipType === "parlay").length,
  };
}

export async function getClubStatsLive(): Promise<import("@/lib/types").ClubStats> {
  const db = dbOrThrow();
  const [allSlips, allLegs, allUsers] = await Promise.all([
    db.select().from(betSlips),
    db.select({
      id: betLegs.id,
      betSlipId: betLegs.betSlipId,
      gameId: betLegs.gameId,
      selectionTeam: betLegs.selectionTeam,
      result: betLegs.result,
    }).from(betLegs),
    db.select({ id: userProfiles.id, displayName: userProfiles.displayName, nickname: userProfiles.nickname }).from(userProfiles),
  ]);

  // Fetch games for league info
  const allGames = await db.select({ id: games.id, leagueSlug: games.leagueSlug }).from(games);
  const gameLeagueMap = new Map(allGames.map((g) => [g.id, g.leagueSlug]));

  const totalWageredCents = allSlips.reduce((sum, s) => sum + s.stakeCents, 0);
  const totalReturnedCents = allSlips.reduce((sum, s) => sum + s.payoutCents, 0);

  // Biggest single win
  let biggestSingleWinCents = 0;
  let biggestWinnerId = "";
  for (const slip of allSlips) {
    if (slip.status === "won" && slip.payoutCents > biggestSingleWinCents) {
      biggestSingleWinCents = slip.payoutCents;
      biggestWinnerId = slip.userProfileId;
    }
  }
  const winner = allUsers.find((u) => u.id === biggestWinnerId);
  const biggestWinnerDisplayName = winner?.nickname ?? winner?.displayName ?? "N/A";

  // Parlay stats
  const totalParlays = allSlips.filter((s) => s.slipType === "parlay").length;
  const parlaysWon = allSlips.filter((s) => s.slipType === "parlay" && s.status === "won").length;
  const parlayHitRatePercent = totalParlays === 0 ? 0 : Math.round((parlaysWon / totalParlays) * 100);

  // Team popularity
  const teamCounts = new Map<string, number>();
  for (const leg of allLegs) {
    const team = leg.selectionTeam;
    teamCounts.set(team, (teamCounts.get(team) ?? 0) + 1);
  }
  const teamPopularity = [...teamCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([team, count]) => ({ team, count }));

  // League win rates
  const leagueStats = new Map<string, { wins: number; total: number }>();
  for (const leg of allLegs) {
    if (leg.result === "pending") continue;
    const league = gameLeagueMap.get(leg.gameId) ?? "Unknown";
    const stats = leagueStats.get(league) ?? { wins: 0, total: 0 };
    stats.total++;
    if (leg.result === "win") stats.wins++;
    leagueStats.set(league, stats);
  }
  const leagueWinRates = [...leagueStats.entries()]
    .map(([league, stats]) => ({
      league,
      wins: stats.wins,
      total: stats.total,
      percent: stats.total === 0 ? 0 : Math.round((stats.wins / stats.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    totalWageredCents,
    totalReturnedCents,
    biggestSingleWinCents,
    biggestWinnerDisplayName,
    totalSlips: allSlips.length,
    totalParlays,
    parlaysWon,
    parlayHitRatePercent,
    teamPopularity,
    leagueWinRates,
  };
}

export async function getEnhancedLeaderboardsLive(): Promise<{
  leaderboards: import("@/lib/types").EnhancedLeaderboardEntry[];
  rivalryBoard: import("@/lib/types").RivalryEntry[];
}> {
  const db = dbOrThrow();
  const { leaderboards, rivalryBoard } = await computeLeaderboards();

  // Fetch all slips + legs for best parlay & recent win rate
  const [allSlips, allLegs] = await Promise.all([
    db.select().from(betSlips),
    db.select().from(betLegs),
  ]);

  const legsBySlip = new Map<string, typeof allLegs>();
  for (const leg of allLegs) {
    const existing = legsBySlip.get(leg.betSlipId) ?? [];
    existing.push(leg);
    legsBySlip.set(leg.betSlipId, existing);
  }

  const enhanced = leaderboards.map((entry) => {
    const userSlips = allSlips.filter((s) => s.userProfileId === entry.userId);

    // Best parlay
    const wonParlays = userSlips.filter((s) => s.slipType === "parlay" && s.status === "won");
    let bestParlayPayoutCents = 0;
    let bestParlayLegCount = 0;
    for (const parlay of wonParlays) {
      if (parlay.payoutCents > bestParlayPayoutCents) {
        bestParlayPayoutCents = parlay.payoutCents;
        bestParlayLegCount = legsBySlip.get(parlay.id)?.length ?? 0;
      }
    }

    // Recent win rate (last 7 settled slips)
    const graded = userSlips
      .filter((s) => s.status !== "open")
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 7);
    const recentWins = graded.filter((s) => s.status === "won").length;
    const recentWinRate = graded.length === 0 ? 50 : Math.round((recentWins / graded.length) * 100);

    const heatBadge: import("@/lib/types").HeatBadge =
      graded.length >= 3 && recentWinRate >= 70 ? "hot" : graded.length >= 3 && recentWinRate <= 30 ? "cold" : "neutral";

    return {
      ...entry,
      bestParlayPayoutCents,
      bestParlayLegCount,
      recentWinRate,
      heatBadge,
    };
  });

  return { leaderboards: enhanced, rivalryBoard };
}

export async function getActivityFeedLive(): Promise<import("@/lib/types").ActivityItem[]> {
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(adminAuditLogs)
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(18);

  const publicMessages: Record<string, string> = {
    approved_top_up: "A member's balance was updated.",
    placed_slip: "A member placed a new pick.",
    created_lock_pick: "A new Lock of the Day landed.",
    updated_lock_pick: "A Lock of the Day was updated.",
  };

  const slipIds = rows.filter((r) => r.action === "placed_slip").map((r) => r.targetId);
  const legRows = slipIds.length > 0 ? await db.select().from(betLegs).where(inArray(betLegs.betSlipId, slipIds)) : [];

  return rows
    .filter((row) => publicMessages[row.action])
    .map((row) => {
      let tailSelectionIds: string[] | undefined;
      if (row.action === "placed_slip") {
        tailSelectionIds = legRows
          .filter((l) => l.betSlipId === row.targetId)
          .map((l) => l.selectionId);
      }
      return {
        id: row.id,
        message: publicMessages[row.action]!,
        createdAt: toIso(row.createdAt)!,
        tone:
          row.action === "approved_top_up"
            ? ("good" as const)
            : ("neutral" as const),
        tailSelectionIds,
      };
    });
}

export async function syncViewerLive(input: {
  clerkUserId: string;
  email: string;
  displayName: string;
  imageUrl?: string;
  role: ViewerProfile["role"];
}) {
  await ensureCoreData();
  const db = dbOrThrow();
  const existing = await db
    .select()
    .from(userProfiles)
    .where(
      or(
        eq(userProfiles.clerkUserId, input.clerkUserId),
        eq(userProfiles.email, input.email),
      ),
    )
    .limit(1);

  let row = existing[0];
  if (row) {
    const updated = await db
      .update(userProfiles)
      .set({
        clerkUserId: input.clerkUserId,
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
        updatedAt: now(),
      })
      .where(eq(userProfiles.id, row.id))
      .returning();
    row = updated[0]!;
  } else {
    const ownerRows = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.role, "owner_admin"))
      .limit(1);
    const bootstrappedRole =
      ownerRows.length === 0 && getAdminEmails().includes(input.email.toLowerCase())
        ? "owner_admin"
        : "member";

    const inserted = await db
      .insert(userProfiles)
      .values({
        clerkUserId: input.clerkUserId,
        email: input.email,
        displayName: input.displayName,
        imageUrl: input.imageUrl,
        role: bootstrappedRole,
        status: bootstrappedRole === "owner_admin" ? "active" : "suspended",
      })
      .returning();
    row = inserted[0]!;
    await ensureWallet(row.id);
    await recordAudit(
      {
        userId: row.id,
        email: row.email,
      },
      "created_profile",
      "user",
      row.id,
      {
        metadata: {
          bootstrappedRole,
        },
      },
    );
  }

  await ensureWallet(row.id);
  return mapViewer(row);
}

export async function updateProfileLive(
  userId: string,
  data: { displayName?: string; nickname?: string | null },
) {
  const db = dbOrThrow();
  const updates: Record<string, unknown> = { updatedAt: now() };
  if (data.displayName !== undefined) updates.displayName = data.displayName;
  if (data.nickname !== undefined) updates.nickname = data.nickname;

  const updated = await db
    .update(userProfiles)
    .set(updates)
    .where(eq(userProfiles.id, userId))
    .returning();

  return mapViewer(updated[0]!);
}

export async function getWeekLockFeedLive(): Promise<WeekLockFeedEntry[]> {
  const db = dbOrThrow();
  const rows = await db
    .select({
      id: lockPicks.id,
      selectionTeam: lockPicks.selectionTeam,
      selectionSide: lockPicks.selectionSide,
      spread: lockPicks.spread,
      americanOdds: lockPicks.americanOdds,
      result: lockPicks.result,
      note: lockPicks.note,
      createdAt: lockPicks.createdAt,
      displayName: userProfiles.displayName,
      nickname: userProfiles.nickname,
    })
    .from(lockPicks)
    .innerJoin(userProfiles, eq(lockPicks.userProfileId, userProfiles.id))
    .where(eq(lockPicks.weekKey, currentWeekKey()))
    .orderBy(asc(lockPicks.createdAt));

  return rows.map((row) => ({
    id: row.id,
    displayName: row.nickname ?? row.displayName,
    selectionTeam: row.selectionTeam,
    selectionSide: row.selectionSide as WeekLockFeedEntry["selectionSide"],
    spread: numericToNumber(row.spread),
    americanOdds: row.americanOdds,
    result: row.result,
    note: row.note ?? undefined,
    createdAt: toIso(row.createdAt)!,
  }));
}

export async function getMemberSnapshotLive(viewer: ViewerProfile): Promise<MemberSnapshot> {
  const db = dbOrThrow();
  const settings = await loadSettingsLive();
  const [{ games: gameCards }, wallet, slips, topUps, pickRows, boardData, activity, weekLockFeed] =
    await Promise.all([
      buildGameCards(settings),
      getWalletView(viewer.id),
      getSlipViews(viewer.id),
      db
        .select()
        .from(topUpRequests)
        .where(eq(topUpRequests.userProfileId, viewer.id))
        .orderBy(desc(topUpRequests.requestedAt)),
      db
        .select()
        .from(lockPicks)
        .where(
          and(
            eq(lockPicks.userProfileId, viewer.id),
            eq(lockPicks.weekKey, currentWeekKey()),
          ),
        )
        .limit(1),
      computeLeaderboards(),
      getActivityFeedLive(),
      getWeekLockFeedLive(),
    ]);

  return {
    viewer,
    wallet,
    games: gameCards,
    slips,
    topUps: topUps.map(mapTopUp),
    lockPick: pickRows[0] ? mapLockPick(pickRows[0]) : undefined,
    leaderboards: boardData.leaderboards,
    rivalryBoard: boardData.rivalryBoard,
    weekLockFeed,
    activity,
    settings,
    mode: getAppMode(),
  };
}

export async function getAdminSnapshotLive(): Promise<AdminSnapshot> {
  const db = dbOrThrow();
  const [members, pendingTopUps, audit, opsReport, activeAlerts] = await Promise.all([
    db.select().from(userProfiles).orderBy(asc(userProfiles.displayName)),
    db
      .select()
      .from(topUpRequests)
      .where(eq(topUpRequests.status, "pending"))
      .orderBy(desc(topUpRequests.requestedAt)),
    db.select().from(adminAuditLogs).orderBy(desc(adminAuditLogs.createdAt)).limit(20),
    getLatestOpsHealthReportLive(),
    getRecentAnomalyAlertsLive(12),
  ]);

  return {
    members: members.map(mapViewer),
    pendingTopUps: pendingTopUps.map(mapTopUp),
    audit: audit.map(mapAudit),
    opsHealthReport: opsReport,
    anomalyAlerts: rankAnomalyAlerts(activeAlerts),
  };
}

export async function updateMemberAccessLive(input: {
  actorUserId: string;
  targetUserId: string;
  role?: ViewerProfile["role"];
  status?: ViewerProfile["status"];
}) {
  const db = dbOrThrow();

  if (input.actorUserId === input.targetUserId) {
    throw new Error("You cannot change your own access level.");
  }

  const targetRows = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, input.targetUserId))
    .limit(1);
  const target = targetRows[0];

  if (!target) {
    throw new Error("Member not found.");
  }

  if (target.role === "owner_admin" && input.role === "member") {
    const owners = await db
      .select({ id: userProfiles.id })
      .from(userProfiles)
      .where(eq(userProfiles.role, "owner_admin"));

    if (owners.length <= 1) {
      throw new Error("At least one owner admin must remain.");
    }
  }

  const updated = await db
    .update(userProfiles)
    .set({
      role: input.role ?? target.role,
      status: input.status ?? target.status,
      updatedAt: now(),
    })
    .where(eq(userProfiles.id, input.targetUserId))
    .returning();

  await recordAudit({ userId: input.actorUserId }, "updated_member_access", "user", input.targetUserId, {
    metadata: {
      previousRole: target.role,
      nextRole: updated[0]!.role,
      previousStatus: target.status,
      nextStatus: updated[0]!.status,
    },
  });

  return mapViewer(updated[0]!);
}

export async function setMaintenanceModeLive(actorUserId: string, enabled: boolean) {
  const db = dbOrThrow();

  await db
    .insert(appSettings)
    .values({
      key: "maintenanceMode",
      value: { value: enabled },
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value: { value: enabled },
      },
    });

  await recordAudit({ userId: actorUserId }, enabled ? "enabled_maintenance_mode" : "disabled_maintenance_mode", "setting", "maintenanceMode", {
    metadata: {
      enabled,
    },
  });

  return enabled;
}

export async function requestTopUpLive(userId: string, amountCents: number, note?: string) {
  const db = dbOrThrow();
  const inserted = await db
    .insert(topUpRequests)
    .values({
      userProfileId: userId,
      amountCents,
      note,
      status: "pending",
    })
    .returning();

  await recordAudit({ userId }, "requested_top_up", "top_up_request", inserted[0]!.id);
  return mapTopUp(inserted[0]!);
}

export async function approveTopUpLive(actorUserId: string, requestId: string) {
  const db = dbOrThrow();
  const updated = await db.transaction(async (tx) => {
    const changed = await tx
      .update(topUpRequests)
      .set({
        status: "paid",
        approvedAt: now(),
        approvedByUserProfileId: actorUserId,
      })
      .where(and(eq(topUpRequests.id, requestId), eq(topUpRequests.status, "pending")))
      .returning();

    const row = changed[0];
    if (!row) {
      throw new Error("Top-up request is no longer pending.");
    }

    await lockUserScopeTx(tx, row.userProfileId);
    await creditWalletTx(
      tx,
      row.userProfileId,
      row.amountCents,
      "top_up",
      "Admin approved bankroll request",
      row.id,
    );

    return row;
  });

  await recordAudit({ userId: actorUserId }, "approved_top_up", "top_up_request", requestId);
  return mapTopUp(updated);
}

export async function placeSlipLive(input: {
  userId: string;
  stakeCents: number;
  selectionIds: string[];
  idempotencyKey?: string;
}) {
  const db = dbOrThrow();
  const settings = await loadSettingsLive();
  const uniqueIds = Array.from(new Set(input.selectionIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    throw new Error("Choose at least one spread to build a slip.");
  }

  if (uniqueIds.length > 4) {
    throw new Error("Parlays are capped at four legs in v1.");
  }

  if (input.stakeCents < settings.minStakeCents || input.stakeCents > settings.maxStakeCents) {
    throw new Error("Stake is outside the configured table limits.");
  }

  const quoteRows = await db
    .select()
    .from(oddsQuotes)
    .where(inArray(oddsQuotes.id, uniqueIds));

  if (quoteRows.length !== uniqueIds.length) {
    throw new Error("One of the selected lines is no longer available.");
  }

  const gameRows = await db
    .select()
    .from(games)
    .where(inArray(games.id, quoteRows.map((row) => row.gameId)));
  const gameMap = new Map(gameRows.map((row) => [row.id, row]));
  const seenGameIds = new Set<string>();

  for (const quote of quoteRows) {
    const game = gameMap.get(quote.gameId);
    if (!game) {
      throw new Error("Game not found for selection.");
    }

    if (+new Date(game.commenceTime) <= Date.now()) {
      throw new Error("One of the selected games has already started.");
    }

    if (seenGameIds.has(game.id)) {
      throw new Error("Only one pick per game is allowed on a single slip.");
    }

    seenGameIds.add(game.id);
  }

  const type = quoteRows.length === 1 ? "straight" : "parlay";
  const potentialPayoutCents =
    type === "straight"
      ? calculateStraightPayout(input.stakeCents, quoteRows[0]!.americanOdds)
      : calculateParlayPayout(
          input.stakeCents,
          quoteRows.map((row) => row.americanOdds),
        );

  const insertedSlip = await db.transaction(async (tx) => {
    await lockUserScopeTx(tx, input.userId);
    const openRows = await tx
      .select()
      .from(betSlips)
      .where(and(eq(betSlips.userProfileId, input.userId), eq(betSlips.status, "open")));

    if (openRows.length >= settings.maxOpenSlipsPerUser) {
      throw new Error("You already have the maximum number of open slips.");
    }

    const inserted = await tx
      .insert(betSlips)
      .values({
        userProfileId: input.userId,
        slipType: type,
        stakeCents: input.stakeCents,
        potentialPayoutCents,
      })
      .returning();

    await debitWalletTx(
      tx,
      input.userId,
      input.stakeCents,
      "stake_hold",
      "Placed betting slip",
      input.idempotencyKey ?? inserted[0]!.id,
    );

    await tx.insert(betLegs).values(
      quoteRows.map((quote) => ({
        betSlipId: inserted[0]!.id,
        gameId: quote.gameId,
        oddsQuoteId: quote.id,
        selectionId: quote.id,
        selectionTeam: quote.selectionTeam,
        selectionSide: quote.selectionSide,
        spread: String(quote.point),
        americanOdds: quote.americanOdds,
        bookmakerKey: quote.bookmakerKey,
        quoteTimestamp: quote.quoteTimestamp,
        result: "pending" as const,
      })),
    );

    return inserted[0]!;
  });

  await recordAudit({ userId: input.userId }, "placed_slip", "bet_slip", insertedSlip.id);

  const slips = await getSlipViews(input.userId);
  return slips.find((slip) => slip.id === insertedSlip.id)!;
}

export async function saveLockPickLive(userId: string, selectionId: string, note?: string) {
  const db = dbOrThrow();
  const rows = await db
    .select()
    .from(oddsQuotes)
    .where(eq(oddsQuotes.id, selectionId))
    .limit(1);
  const quote = rows[0];

  if (!quote) {
    throw new Error("That lock pick is no longer available.");
  }

  const existing = await db
    .select()
    .from(lockPicks)
    .where(
      and(eq(lockPicks.userProfileId, userId), eq(lockPicks.weekKey, currentWeekKey())),
    )
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(lockPicks)
      .set({
        gameId: quote.gameId,
        selectionId,
        selectionTeam: quote.selectionTeam,
        selectionSide: quote.selectionSide,
        spread: String(quote.point),
        americanOdds: quote.americanOdds,
        bookmakerKey: quote.bookmakerKey,
        quoteTimestamp: quote.quoteTimestamp,
        result: "pending",
        note: note ?? null,
      })
      .where(eq(lockPicks.id, existing[0].id))
      .returning();

    await recordAudit({ userId }, "updated_lock_pick", "lock_pick", updated[0]!.id);
    return mapLockPick(updated[0]!);
  }

  const inserted = await db
    .insert(lockPicks)
    .values({
      userProfileId: userId,
      gameId: quote.gameId,
      selectionId,
      selectionTeam: quote.selectionTeam,
      selectionSide: quote.selectionSide,
      spread: String(quote.point),
      americanOdds: quote.americanOdds,
      bookmakerKey: quote.bookmakerKey,
      quoteTimestamp: quote.quoteTimestamp,
      weekKey: currentWeekKey(),
      note: note ?? null,
    })
    .returning();

  await recordAudit({ userId }, "created_lock_pick", "lock_pick", inserted[0]!.id);
  return mapLockPick(inserted[0]!);
}

export async function runAiOpsAutopilotLive(
  mode: OpsAutopilotMode = "hourly",
) {
  const db = dbOrThrow();
  const timestamp = now();
  const [latestQuoteRows, stuckInProgressRows, overdueScheduledRows, retryStormRows] =
    await Promise.all([
      db
        .select({ quoteTimestamp: oddsQuotes.quoteTimestamp })
        .from(oddsQuotes)
        .orderBy(desc(oddsQuotes.quoteTimestamp))
        .limit(1),
      db
        .select({ id: games.id })
        .from(games)
        .where(
          and(
            eq(games.status, "in_progress"),
            sql`${games.commenceTime} < ${new Date(Date.now() - 6 * 60 * 60 * 1000)}`,
          ),
        ),
      db
        .select({ id: games.id })
        .from(games)
        .where(
          and(
            eq(games.status, "scheduled"),
            sql`${games.commenceTime} < ${new Date(Date.now() - 2 * 60 * 60 * 1000)}`,
          ),
        ),
      db
        .select({ id: adminAuditLogs.id })
        .from(adminAuditLogs)
        .where(
          and(
            eq(adminAuditLogs.action, "rate_limit_blocked"),
            gte(adminAuditLogs.createdAt, new Date(Date.now() - 60 * 60 * 1000)),
          ),
        ),
    ]);

  const settlementLagCount = await computeOpenSlipSettlementLag();
  const freshQuote = latestQuoteRows[0]?.quoteTimestamp;
  const syncFreshnessMinutes = freshQuote
    ? Math.round((Date.now() - +new Date(freshQuote)) / (60 * 1000))
    : Number.POSITIVE_INFINITY;
  const stuckGamesCount = stuckInProgressRows.length + overdueScheduledRows.length;
  const retryStormCount = retryStormRows.length;

  const liveAlerts = await detectAnomalyAlertsLive();
  const criticalAlerts = liveAlerts.filter((alert) => alert.severity === "critical");

  const findings: OpsFinding[] = [];
  if (!Number.isFinite(syncFreshnessMinutes)) {
    findings.push({
      code: "sync_missing",
      severity: "critical",
      message: "No odds quote snapshots are available.",
      metric: 0,
    });
  } else if (syncFreshnessMinutes > 120) {
    findings.push({
      code: "sync_stale_critical",
      severity: "critical",
      message: "Odds sync freshness is critically stale.",
      metric: syncFreshnessMinutes,
    });
  } else if (syncFreshnessMinutes > 45) {
    findings.push({
      code: "sync_stale_warning",
      severity: "warning",
      message: "Odds sync freshness is behind schedule.",
      metric: syncFreshnessMinutes,
    });
  } else {
    findings.push({
      code: "sync_healthy",
      severity: "info",
      message: "Odds sync freshness is healthy.",
      metric: syncFreshnessMinutes,
    });
  }

  if (stuckGamesCount > 0) {
    findings.push({
      code: "stuck_games",
      severity: stuckGamesCount >= 8 ? "critical" : "warning",
      message: "Detected games with stale in-progress or overdue scheduled status.",
      metric: stuckGamesCount,
    });
  }

  if (settlementLagCount > 0) {
    findings.push({
      code: "settlement_lag",
      severity: settlementLagCount >= 10 ? "critical" : "warning",
      message: "Open slips appear ready for grading but remain unsettled.",
      metric: settlementLagCount,
    });
  }

  if (retryStormCount > 0) {
    findings.push({
      code: "retry_storm",
      severity: retryStormCount >= 20 ? "critical" : "warning",
      message: "Detected elevated rate-limit blocking traffic.",
      metric: retryStormCount,
    });
  }

  if (criticalAlerts.length > 0) {
    findings.push({
      code: "critical_anomalies",
      severity: "critical",
      message: "Critical anomaly alerts detected.",
      metric: criticalAlerts.length,
    });
  } else if (liveAlerts.length > 0) {
    findings.push({
      code: "anomaly_alerts",
      severity: "warning",
      message: "Anomaly alerts detected.",
      metric: liveAlerts.length,
    });
  }

  const remediations: OpsRemediation[] = [];

  if (!Number.isFinite(syncFreshnessMinutes) || syncFreshnessMinutes > 45) {
    try {
      await runOddsSyncLive();
      remediations.push({
        action: "run_odds_sync",
        status: "applied",
        detail: "Triggered full odds sync due to stale freshness.",
      });
    } catch (error) {
      remediations.push({
        action: "run_odds_sync",
        status: "failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else {
    remediations.push({
      action: "run_odds_sync",
      status: "skipped",
      detail: "Skipped because sync freshness is healthy.",
    });
  }

  if (settlementLagCount > 0 || stuckGamesCount > 0) {
    try {
      await runSettlementSweepLive();
      remediations.push({
        action: "run_settlement_sweep",
        status: "applied",
        detail: "Triggered settlement sweep for lagged slips and stale games.",
      });
    } catch (error) {
      remediations.push({
        action: "run_settlement_sweep",
        status: "failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } else {
    remediations.push({
      action: "run_settlement_sweep",
      status: "skipped",
      detail: "Skipped because no settlement lag was detected.",
    });
  }

  let quarantinedUsers = 0;
  const userIdsToQuarantine = Array.from(
    new Set(
      criticalAlerts
        .filter((alert) => alert.category === "wallet")
        .flatMap((alert) => alert.userIds),
    ),
  );

  if (userIdsToQuarantine.length > 0) {
    const users = await db
      .select()
      .from(userProfiles)
      .where(inArray(userProfiles.id, userIdsToQuarantine));

    for (const user of users) {
      if (user.role === "owner_admin" || user.status === "suspended") {
        continue;
      }

      await db
        .update(userProfiles)
        .set({
          status: "suspended",
          updatedAt: now(),
        })
        .where(eq(userProfiles.id, user.id));

      await recordAudit(
        undefined,
        "ai_quarantined_user",
        "user",
        user.id,
        {
          outcome: "success",
          metadata: {
            reason: "critical_wallet_anomaly",
          },
        },
      );
      quarantinedUsers += 1;
    }
  }

  if (quarantinedUsers > 0) {
    remediations.push({
      action: "quarantine_users",
      status: "applied",
      detail: `Suspended ${quarantinedUsers} members for critical wallet anomalies.`,
    });
  } else {
    remediations.push({
      action: "quarantine_users",
      status: "skipped",
      detail: "No users matched quarantine thresholds.",
    });
  }

  if (mode === "nightly") {
    try {
      const archived = await archiveAuditLogsLive(90, 2_000);
      const cleaned = await cleanupAiTablesLive();
      remediations.push({
        action: "nightly_retention",
        status: "applied",
        detail: `Archived ${archived} audit rows, deleted ${cleaned.deletedSnapshots} snapshots and ${cleaned.deletedAlerts} alerts.`,
      });
    } catch (error) {
      remediations.push({
        action: "nightly_retention",
        status: "failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const report = summarizeOpsHealth({
    mode,
    findings,
    remediations,
    now: timestamp,
  });
  const insertedReport = await db
    .insert(opsHealthReports)
    .values({
      mode: report.mode,
      score: report.score,
      summary: report.summary,
      findings: report.findings as unknown as Record<string, unknown>[],
      remediations: report.remediations as unknown as Record<string, unknown>[],
      createdAt: new Date(report.createdAt),
    })
    .returning();
  const persistedAlertCount = await persistAnomalyAlertsLive(liveAlerts);

  await recordAudit(undefined, "ran_ai_ops_autopilot", "system", "ai-autopilot", {
    metadata: {
      mode,
      findings: report.findings.length,
      remediations: report.remediations.length,
      persistedAlertCount,
      quarantinedUsers,
    },
  });

  return {
    success: true,
    report: mapOpsHealthReport(insertedReport[0]!),
    persistedAlertCount,
    quarantinedUsers,
  };
}

export async function runOddsSyncLive() {
  const db = dbOrThrow();
  const settings = await loadSettingsLive();
  let checkedGames = 0;
  let updatedQuotes = 0;
  let postponedGames = 0;
  const oddsShifts: { gameId: string; matchup: string; team: string; oldSpread: number; newSpread: number; oldOdds: number; newOdds: number }[] = [];

  for (const league of settings.enabledLeagues) {
    const events = await fetchLeagueOdds(league, settings.primaryBookmaker);
    const seenExternalIds = new Set(events.map((event) => event.externalId));

    for (const event of events) {
      checkedGames += 1;
      const existing = await db
        .select()
        .from(games)
        .where(eq(games.externalId, event.externalId))
        .limit(1);

      let gameId = existing[0]?.id;
      const nextStatus =
        existing[0]?.status === "final"
          ? "final"
          : +new Date(event.commenceTime) <= Date.now()
            ? "in_progress"
            : "scheduled";
      if (gameId) {
        await db
          .update(games)
          .set({
            leagueSlug: league,
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
            commenceTime: new Date(event.commenceTime),
            status: nextStatus,
            updatedAt: now(),
          })
          .where(eq(games.id, gameId));
      } else {
        const inserted = await db
          .insert(games)
          .values({
            externalId: event.externalId,
            leagueSlug: league,
            homeTeam: event.homeTeam,
            awayTeam: event.awayTeam,
            commenceTime: new Date(event.commenceTime),
            status: nextStatus,
          })
          .returning();
        gameId = inserted[0]!.id;
      }

      // Snapshot old spread quotes before deleting for shift detection
      const oldQuotes = await db
        .select()
        .from(oddsQuotes)
        .where(
          and(
            eq(oddsQuotes.gameId, gameId),
            eq(oddsQuotes.bookmakerKey, settings.primaryBookmaker),
            eq(oddsQuotes.isPrimary, true),
            eq(oddsQuotes.market, "spreads"),
          ),
        );

      await db
        .delete(oddsQuotes)
        .where(
          and(
            eq(oddsQuotes.gameId, gameId),
            eq(oddsQuotes.bookmakerKey, settings.primaryBookmaker),
          ),
        );

      await db.insert(oddsQuotes).values(
        event.outcomes.map((outcome) => ({
          gameId,
          bookmakerKey: settings.primaryBookmaker,
          market: outcome.market,
          selectionTeam: outcome.team,
          selectionSide: outcome.side,
          point: String(outcome.spread),
          americanOdds: outcome.americanOdds,
          quoteTimestamp: new Date(outcome.quoteTimestamp),
          isPrimary: true,
        })),
      );

      // Detect significant line shifts (>= 1.5 points)
      const matchup = `${event.awayTeam} @ ${event.homeTeam}`;
      for (const oldQ of oldQuotes) {
        const newOutcome = event.outcomes.find(
          (o) => o.side === oldQ.selectionSide && o.market === "spreads",
        );
        if (newOutcome) {
          const oldSpread = numericToNumber(oldQ.point);
          const newSpread = newOutcome.spread;
          if (Math.abs(newSpread - oldSpread) >= 1.5) {
            oddsShifts.push({
              gameId: gameId!,
              matchup,
              team: oldQ.selectionTeam,
              oldSpread,
              newSpread,
              oldOdds: oldQ.americanOdds,
              newOdds: newOutcome.americanOdds,
            });
          }
        }
      }
      await persistMarketSnapshots({
        gameId: gameId!,
        leagueSlug: league,
        bookmakerKey: settings.primaryBookmaker,
        outcomes: event.outcomes
          .filter((o) => o.market === "spreads")
          .map((outcome) => ({
            side: outcome.side as "home" | "away",
            spread: outcome.spread,
            americanOdds: outcome.americanOdds,
          })),
      });

      updatedQuotes += event.outcomes.length;
    }

    const staleCandidates = await db
      .select({ id: games.id, externalId: games.externalId })
      .from(games)
      .where(
        and(
          eq(games.leagueSlug, league),
          inArray(games.status, ["scheduled", "in_progress"]),
          sql`${games.commenceTime} < ${new Date(Date.now() - 6 * 60 * 60 * 1000)}`,
        ),
      );
    const staleGameIds = staleCandidates
      .filter((row) => !seenExternalIds.has(row.externalId))
      .map((row) => row.id);

    if (staleGameIds.length > 0) {
      await db.delete(oddsQuotes).where(inArray(oddsQuotes.gameId, staleGameIds));
      await db
        .update(games)
        .set({
          status: "postponed",
          updatedAt: now(),
        })
        .where(inArray(games.id, staleGameIds));
      postponedGames += staleGameIds.length;
    }
  }

  // Send odds shift alerts to users with open bets on shifted games
  let shiftAlertsSent = 0;
  if (oddsShifts.length > 0) {
    const shiftedGameIds = [...new Set(oddsShifts.map((s) => s.gameId))];
    const openLegs = await db
      .select({
        gameId: betLegs.gameId,
        selectionTeam: betLegs.selectionTeam,
        selectionSide: betLegs.selectionSide,
        userId: betSlips.userProfileId,
      })
      .from(betLegs)
      .innerJoin(betSlips, eq(betLegs.betSlipId, betSlips.id))
      .where(
        and(
          inArray(betLegs.gameId, shiftedGameIds),
          eq(betSlips.status, "open"),
        ),
      );

    if (openLegs.length > 0) {
      const userIds = [...new Set(openLegs.map((l) => l.userId))];
      const users = await db
        .select({ id: userProfiles.id, email: userProfiles.email, displayName: userProfiles.displayName })
        .from(userProfiles)
        .where(inArray(userProfiles.id, userIds));

      const userMap = new Map(users.map((u) => [u.id, u]));
      const affectedUsers: { email: string; displayName: string; shifts: { matchup: string; team: string; oldSpread: number; newSpread: number; oldOdds: number; newOdds: number }[] }[] = [];

      for (const userId of userIds) {
        const user = userMap.get(userId);
        if (!user) continue;
        const userLegs = openLegs.filter((l) => l.userId === userId);
        const userShifts = userLegs
          .map((leg) =>
            oddsShifts.find(
              (s) => s.gameId === leg.gameId && s.team === leg.selectionTeam,
            ),
          )
          .filter(Boolean) as typeof oddsShifts;

        if (userShifts.length > 0) {
          affectedUsers.push({ email: user.email, displayName: user.displayName, shifts: userShifts });
        }
      }

      if (affectedUsers.length > 0) {
        const { sendOddsShiftAlerts } = await import("@/lib/email");
        shiftAlertsSent = await sendOddsShiftAlerts(affectedUsers);
      }
    }
  }

  await recordAudit(undefined, "ran_odds_sync", "system", "odds-sync");
  const archivedAuditLogs = await archiveAuditLogsLive();
  return { success: true, checkedGames, updatedQuotes, postponedGames, shiftAlertsSent, archivedAuditLogs };
}

export async function runSettlementSweepLive() {
  const db = dbOrThrow();
  const settings = await loadSettingsLive();
  let settledGames = 0;
  let settledSlips = 0;

  for (const league of settings.enabledLeagues) {
    // Only call the Odds API if there are games that have started and aren't settled yet
    const activeGameRows = await db
      .select({ id: games.id })
      .from(games)
      .where(
        and(
          eq(games.leagueSlug, league),
          or(
            eq(games.status, "in_progress"),
            and(eq(games.status, "scheduled"), lte(games.commenceTime, new Date())),
          ),
        ),
      )
      .limit(1);

    if (activeGameRows.length === 0) continue;

    const scoreRows = await fetchLeagueScores(league);

    for (const result of scoreRows) {
      const gameRows = await db
        .select()
        .from(games)
        .where(eq(games.externalId, result.externalId))
        .limit(1);
      const game = gameRows[0];

      if (!game) {
        continue;
      }

      await db
        .update(games)
        .set({
          status: result.status,
          homeScore: result.status === "final" ? result.homeScore ?? null : null,
          awayScore: result.status === "final" ? result.awayScore ?? null : null,
          updatedAt: now(),
        })
        .where(eq(games.id, game.id));

      if (result.status === "final" || result.status === "cancelled" || result.status === "postponed") {
        settledGames += 1;
      }
    }
  }

  const openSlipRows = await db
    .select()
    .from(betSlips)
    .where(eq(betSlips.status, "open"))
    .orderBy(desc(betSlips.createdAt));

  const settledEmailPayloads: SettledSlipRecord[] = [];

  if (openSlipRows.length > 0) {
    const legRows = await db
      .select()
      .from(betLegs)
      .where(inArray(betLegs.betSlipId, openSlipRows.map((row) => row.id)));
    const gameRows = await db
      .select()
      .from(games)
      .where(inArray(games.id, Array.from(new Set(legRows.map((row) => row.gameId)))));
    const gameMap = new Map(gameRows.map((row) => [row.id, row]));

    for (const slip of openSlipRows) {
      const slipLegRows = legRows.filter((row) => row.betSlipId === slip.id);
      const views: BetLegView[] = slipLegRows.map((row) => {
        const game = gameMap.get(row.gameId);
        return {
          id: row.id,
          gameId: row.gameId,
          selectionId: row.selectionId,
          selectionTeam: row.selectionTeam,
          selectionSide: row.selectionSide as BetLegView["selectionSide"],
          spread: numericToNumber(row.spread),
          americanOdds: row.americanOdds,
          bookmaker: row.bookmakerKey,
          quoteTimestamp: toIso(row.quoteTimestamp)!,
          result:
            game?.status === "final"
              ? row.selectionSide === "over" || row.selectionSide === "under"
                ? scoreTotalsLeg(
                    {
                      homeScore: game.homeScore ?? undefined,
                      awayScore: game.awayScore ?? undefined,
                    },
                    row.selectionSide as "over" | "under",
                    numericToNumber(row.spread),
                  )
                : scoreSpreadLeg(
                    {
                      homeScore: game.homeScore ?? undefined,
                      awayScore: game.awayScore ?? undefined,
                    },
                    row.selectionSide as "home" | "away",
                    numericToNumber(row.spread),
                  )
              : game?.status === "cancelled" || game?.status === "postponed"
                ? "void"
              : "pending",
          homeScore: game?.homeScore ?? undefined,
          awayScore: game?.awayScore ?? undefined,
        };
      });

      const settlement = settleSlip(slip.slipType, slip.stakeCents, views);
      if (settlement.status === "open") {
        continue;
      }

      const updatedSlip = await db.transaction(async (tx) => {
        const changed = await tx
          .update(betSlips)
          .set({
            status: settlement.status,
            payoutCents: settlement.payoutCents,
            settledAt: now(),
          })
          .where(and(eq(betSlips.id, slip.id), eq(betSlips.status, "open")))
          .returning();

        if (!changed[0]) {
          return null;
        }

        for (const leg of settlement.legs) {
          await tx.update(betLegs).set({ result: leg.result }).where(eq(betLegs.id, leg.id));
        }

        if (settlement.payoutCents > 0) {
          await creditWalletTx(
            tx,
            slip.userProfileId,
            settlement.payoutCents,
            settlement.status === "push" || settlement.status === "void" ? "refund" : "payout",
            "Slip settled",
            slip.id,
          );
        }

        return changed[0];
      });

      if (!updatedSlip) {
        continue;
      }

      settledSlips += 1;
      settledEmailPayloads.push({
        userId: slip.userProfileId,
        userEmail: "",
        userDisplayName: "",
        slipId: slip.id,
        slipType: slip.slipType,
        status: settlement.status as SettledSlipRecord["status"],
        stakeCents: slip.stakeCents,
        payoutCents: settlement.payoutCents,
        legs: views.map((v) => ({
          selectionTeam: v.selectionTeam,
          spread: v.spread,
          americanOdds: v.americanOdds,
          result: v.result,
        })),
      });
    }
  }

  if (settledEmailPayloads.length > 0) {
    const uniqueIds = [...new Set(settledEmailPayloads.map((p) => p.userId))];
    const profileRows = await db
      .select({ id: userProfiles.id, email: userProfiles.email, displayName: userProfiles.displayName })
      .from(userProfiles)
      .where(inArray(userProfiles.id, uniqueIds));
    const profileMap = new Map(profileRows.map((r) => [r.id, r]));
    const withEmails = settledEmailPayloads
      .map((p) => ({
        ...p,
        userEmail: profileMap.get(p.userId)?.email ?? "",
        userDisplayName: profileMap.get(p.userId)?.displayName ?? "Member",
      }))
      .filter((p) => p.userEmail);
    void sendSettlementEmails(withEmails);
  }

  const picks = await db.select().from(lockPicks).where(eq(lockPicks.weekKey, currentWeekKey()));
  if (picks.length > 0) {
    const pickGames = await db
      .select()
      .from(games)
      .where(inArray(games.id, Array.from(new Set(picks.map((row) => row.gameId)))));
    const gameMap = new Map(pickGames.map((row) => [row.id, row]));

    for (const pick of picks) {
      const game = gameMap.get(pick.gameId);
      if (!game) {
        continue;
      }

      await db
        .update(lockPicks)
        .set({
          result:
            game.status === "final"
              ? scoreSpreadLeg(
                  {
                    homeScore: game.homeScore ?? undefined,
                    awayScore: game.awayScore ?? undefined,
                  },
                  pick.selectionSide as LockPickView["selectionSide"],
                  numericToNumber(pick.spread),
                )
              : game.status === "cancelled" || game.status === "postponed"
                ? "void"
                : pick.result,
        })
        .where(eq(lockPicks.id, pick.id));
    }
  }

  await recordAudit(undefined, "ran_settlement_sweep", "system", "settlement");
  const archivedAuditLogs = await archiveAuditLogsLive();
  return { success: true, settledGames, settledSlips, archivedAuditLogs };
}

export async function getDailyDigestDataLive() {
  const db = dbOrThrow();

  // Active members with emails
  const members = await db
    .select({ email: userProfiles.email, displayName: userProfiles.displayName })
    .from(userProfiles)
    .where(eq(userProfiles.status, "active"));

  // Today's scheduled games with primary odds
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const scheduledGames = await db
    .select()
    .from(games)
    .where(
      and(
        eq(games.status, "scheduled"),
        gte(games.commenceTime, todayStart),
        lte(games.commenceTime, todayEnd),
      ),
    )
    .orderBy(asc(games.commenceTime));

  const digestGames: { league: string; matchup: string; commenceTime: string; spreads: { team: string; spread: number; americanOdds: number }[] }[] = [];

  for (const game of scheduledGames) {
    const quotes = await db
      .select()
      .from(oddsQuotes)
      .where(
        and(
          eq(oddsQuotes.gameId, game.id),
          eq(oddsQuotes.isPrimary, true),
          eq(oddsQuotes.market, "spreads"),
        ),
      );

    digestGames.push({
      league: game.leagueSlug,
      matchup: `${game.awayTeam} @ ${game.homeTeam}`,
      commenceTime: game.commenceTime.toISOString(),
      spreads: quotes.map((q) => ({
        team: q.selectionTeam,
        spread: numericToNumber(q.point),
        americanOdds: q.americanOdds,
      })),
    });
  }

  return { members, games: digestGames };
}
