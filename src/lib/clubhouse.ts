import { addHours } from "date-fns";

import { buildSpreadIntelligence, summarizeOpsHealth } from "@/lib/ai";
import { defaultSettings } from "@/lib/constants";
import {
  calculateParlayPayout,
  calculateStraightPayout,
  scoreSpreadLeg,
  settleSlip,
} from "@/lib/betting";
import { getAppMode, getClubTimeZone, isDatabaseConfigured } from "@/lib/env";
import {
  approveTopUpLive,
  loadSettingsLive,
  getAdminSnapshotLive,
  getMemberSnapshotLive,
  getPublicLeaderboardsLive,
  placeSlipLive,
  requestTopUpLive,
  runOddsSyncLive,
  runAiOpsAutopilotLive,
  runSettlementSweepLive,
  saveLockPickLive,
  setMaintenanceModeLive,
  syncViewerLive,
  updateMemberAccessLive,
  updateProfileLive,
  getActivityFeedLive,
  getWeekLockFeedLive,
} from "@/lib/live-clubhouse";
import { getWeekKey, isDateOnOrAfterWeekKey } from "@/lib/time";
import { makeId } from "@/lib/utils";
import type {
  ActivityItem,
  AdminAnomalyAlert,
  AdminSnapshot,
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
  OpsRemediation,
  RivalryEntry,
  SelectionReference,
  TopUpRequestView,
  ViewerProfile,
  WalletLedgerEntry,
  WalletView,
  WeekLockFeedEntry,
} from "@/lib/types";

interface ClubhouseStore {
  settings: typeof defaultSettings;
  users: ViewerProfile[];
  wallets: Record<string, WalletView>;
  games: GameCard[];
  slips: BetSlipView[];
  topUps: TopUpRequestView[];
  lockPicks: LockPickView[];
  activity: ActivityItem[];
  audit: AuditItem[];
  opsHealthReport?: AdminSnapshot["opsHealthReport"];
  anomalyAlerts: AdminAnomalyAlert[];
}

declare global {
  var __clubhouseStore: ClubhouseStore | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function currentWeekKey() {
  return getWeekKey(new Date(), getClubTimeZone());
}

function addDemoIntelligence(
  option: GameOption,
  commenceTime: string,
  priorSpread?: number,
): GameOption {
  return {
    ...option,
    intelligence: buildSpreadIntelligence({
      currentSpread: option.spread,
      currentOdds: option.americanOdds,
      history:
        typeof priorSpread === "number"
          ? [{ spread: priorSpread, capturedAt: nowIso() }]
          : [],
      commenceTime,
    }),
  };
}

function createGame(
  league: GameCard["league"],
  awayTeam: string,
  homeTeam: string,
  commenceOffsetHours: number,
  spread: number,
  juice: number,
): GameCard {
  const id = makeId("game");
  const quoteTimestamp = nowIso();
  const commenceTime = addHours(new Date(), commenceOffsetHours).toISOString();
  const baseOptions: GameOption[] = [
    {
      id: `${id}:away`,
      team: awayTeam,
      side: "away",
      spread,
      americanOdds: juice,
      market: "spreads",
      bookmaker: defaultSettings.primaryBookmaker,
      quoteTimestamp,
    },
    {
      id: `${id}:home`,
      team: homeTeam,
      side: "home",
      spread: spread * -1,
      americanOdds: juice,
      market: "spreads",
      bookmaker: defaultSettings.primaryBookmaker,
      quoteTimestamp,
    },
  ];

  return {
    id,
    league,
    matchup: `${awayTeam} @ ${homeTeam}`,
    awayTeam,
    homeTeam,
    commenceTime,
    status: commenceOffsetHours < -2 ? "final" : commenceOffsetHours < 0 ? "in_progress" : "scheduled",
    homeScore: commenceOffsetHours < -2 ? Math.floor(Math.random() * 25) + 90 : undefined,
    awayScore: commenceOffsetHours < -2 ? Math.floor(Math.random() * 25) + 90 : undefined,
    options: baseOptions.map((option) => addDemoIntelligence(option, commenceTime)),
  };
}

function createWallet(userId: string, balanceCents: number): WalletView {
  const ledger: WalletLedgerEntry[] = [
    {
      id: makeId("ledger"),
      userId,
      type: "seed",
      amountCents: balanceCents,
      balanceAfterCents: balanceCents,
      note: "Opening club bankroll",
      createdAt: nowIso(),
    },
  ];

  return { userId, balanceCents, ledger };
}

function seedUsers() {
  return [
    {
      id: "user_commissioner",
      clerkUserId: "demo-admin",
      email: "commissioner@example.com",
      displayName: "Commissioner",
      nickname: null,
      role: "owner_admin",
      status: "active",
      joinedAt: nowIso(),
      imageUrl: undefined,
    },
    {
      id: "user_rome",
      clerkUserId: "demo-rome",
      email: "rome@example.com",
      displayName: "Rome",
      nickname: null,
      role: "member",
      status: "active",
      joinedAt: nowIso(),
      imageUrl: undefined,
    },
    {
      id: "user_smoke",
      clerkUserId: "demo-smoke",
      email: "smoke@example.com",
      displayName: "Smoke",
      nickname: null,
      role: "member",
      status: "active",
      joinedAt: nowIso(),
      imageUrl: undefined,
    },
    {
      id: "user_jules",
      clerkUserId: "demo-jules",
      email: "jules@example.com",
      displayName: "Jules",
      nickname: null,
      role: "member",
      status: "active",
      joinedAt: nowIso(),
      imageUrl: undefined,
    },
  ] satisfies ViewerProfile[];
}

function createSeedStore(): ClubhouseStore {
  const users = seedUsers();
  const wallets = {
    user_commissioner: createWallet("user_commissioner", 50000),
    user_rome: createWallet("user_rome", 26500),
    user_smoke: createWallet("user_smoke", 18200),
    user_jules: createWallet("user_jules", 21300),
  };

  const games = [
    createGame("NFL", "Kansas City Chiefs", "Buffalo Bills", 2, 3.5, -110),
    createGame("NFL", "Dallas Cowboys", "Philadelphia Eagles", 5, 6.5, -110),
    createGame("NFL", "Green Bay Packers", "Chicago Bears", 8, 4.5, -112),
    createGame("NCAAF", "Alabama", "Georgia", 3, 3.0, -110),
    createGame("NCAAF", "Ohio State", "Michigan", 6, 7.0, -110),
  ];

  const slips: BetSlipView[] = [
    {
      id: "slip_demo_1",
      userId: "user_rome",
      type: "straight",
      stakeCents: 2000,
      potentialPayoutCents: calculateStraightPayout(2000, -110),
      payoutCents: calculateStraightPayout(2000, -110),
      status: "won",
      createdAt: addHours(new Date(), -30).toISOString(),
      settledAt: addHours(new Date(), -28).toISOString(),
      legs: [
        {
          id: "leg_demo_1",
          gameId: "finished_nfl",
          selectionId: "finished_nfl:home",
          selectionTeam: "Buffalo Bills",
          selectionSide: "home",
          spread: -3.5,
          americanOdds: -110,
          bookmaker: defaultSettings.primaryBookmaker,
          quoteTimestamp: addHours(new Date(), -32).toISOString(),
          result: "win",
          homeScore: 27,
          awayScore: 20,
        },
      ],
    },
    {
      id: "slip_demo_2",
      userId: "user_smoke",
      type: "parlay",
      stakeCents: 1500,
      potentialPayoutCents: calculateParlayPayout(1500, [-110, -110]),
      payoutCents: 0,
      status: "open",
      createdAt: addHours(new Date(), -1).toISOString(),
      legs: games.slice(0, 2).map((game, index) => ({
        id: makeId("leg"),
        gameId: game.id,
        selectionId: game.options[index]!.id,
        selectionTeam: game.options[index]!.team,
        selectionSide: game.options[index]!.side,
        spread: game.options[index]!.spread,
        americanOdds: game.options[index]!.americanOdds,
        bookmaker: game.options[index]!.bookmaker,
        quoteTimestamp: game.options[index]!.quoteTimestamp,
        result: "pending",
      })),
    },
  ];

  const topUps: TopUpRequestView[] = [
    {
      id: "topup_demo_1",
      userId: "user_jules",
      amountCents: 5000,
      status: "pending",
      note: "Weekend bankroll reload",
      requestedAt: addHours(new Date(), -3).toISOString(),
    },
  ];

  const lockPicks: LockPickView[] = [
    {
      id: "lock_demo_1",
      userId: "user_rome",
      gameId: games[0]?.id ?? "demo_game_1",
      weekKey: currentWeekKey(),
      selectionId: games[0]?.options[0]?.id ?? "",
      selectionTeam: games[0]?.options[0]?.team ?? "Kansas City Chiefs",
      selectionSide: games[0]?.options[0]?.side ?? "away",
      spread: games[0]?.options[0]?.spread ?? 3.5,
      americanOdds: games[0]?.options[0]?.americanOdds ?? -110,
      bookmaker: games[0]?.options[0]?.bookmaker ?? defaultSettings.primaryBookmaker,
      quoteTimestamp: games[0]?.options[0]?.quoteTimestamp ?? nowIso(),
      result: "pending",
      note: "Mahomes always covers on the road.",
      createdAt: addHours(new Date(), -2).toISOString(),
    },
  ];

  const activity: ActivityItem[] = [
    {
      id: makeId("activity"),
      message: "Rome cashed a Bills cover and jumped to the top of the board.",
      createdAt: addHours(new Date(), -4).toISOString(),
      tone: "good",
    },
    {
      id: makeId("activity"),
      message: "Smoke built a two-leg NFL/NCAAF parlay for the weekend slate.",
      createdAt: addHours(new Date(), -2).toISOString(),
      tone: "neutral",
    },
    {
      id: makeId("activity"),
      message: "Jules requested a bankroll top-up for the weekend games.",
      createdAt: addHours(new Date(), -3).toISOString(),
      tone: "neutral",
    },
  ];

  const audit: AuditItem[] = [
    {
      id: makeId("audit"),
      actorUserId: "user_commissioner",
      action: "seeded_demo_league_state",
      targetType: "system",
      targetId: "bootstrap",
      createdAt: nowIso(),
    },
  ];

  return {
    settings: defaultSettings,
    users,
    wallets,
    games,
    slips,
    topUps,
    lockPicks,
    activity,
    audit,
    anomalyAlerts: [],
    opsHealthReport: undefined,
  };
}

function getStore() {
  if (!globalThis.__clubhouseStore) {
    globalThis.__clubhouseStore = createSeedStore();
  }

  return globalThis.__clubhouseStore;
}

function addActivity(message: string, tone: ActivityItem["tone"] = "neutral") {
  const store = getStore();

  store.activity.unshift({
    id: makeId("activity"),
    message,
    createdAt: nowIso(),
    tone,
  });

  store.activity = store.activity.slice(0, 18);
}

function addAudit(actorUserId: string, action: string, targetType: string, targetId: string) {
  const store = getStore();

  store.audit.unshift({
    id: makeId("audit"),
    actorUserId,
    action,
    targetType,
    targetId,
    createdAt: nowIso(),
  });
}

function getWallet(userId: string) {
  const store = getStore();
  const wallet = store.wallets[userId];

  if (!wallet) {
    store.wallets[userId] = createWallet(userId, 15000);
  }

  return store.wallets[userId];
}

function pushLedgerEntry(
  userId: string,
  type: WalletLedgerEntry["type"],
  amountCents: number,
  note: string,
  referenceId?: string,
) {
  const wallet = getWallet(userId);
  wallet.balanceCents += amountCents;

  wallet.ledger.unshift({
    id: makeId("ledger"),
    userId,
    type,
    amountCents,
    balanceAfterCents: wallet.balanceCents,
    note,
    referenceId,
    createdAt: nowIso(),
  });
}

function getSelection(selectionId: string): SelectionReference | null {
  const store = getStore();

  for (const game of store.games) {
    const option = game.options.find((entry) => entry.id === selectionId);
    if (option) {
      return { gameId: game.id, option };
    }
  }

  return null;
}

function getSlipStreak(userId: string) {
  const store = getStore();
  const settled = store.slips
    .filter((slip) => slip.userId === userId && slip.status !== "open")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  let streak = 0;
  for (const slip of settled) {
    if (slip.status === "won") {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

function buildLeaderboards(): LeaderboardEntry[] {
  const store = getStore();

  return store.users
    .map((user) => {
      const slips = store.slips.filter((slip) => slip.userId === user.id);
      const graded = slips.filter((slip) => slip.status !== "open");
      const wins = graded.filter((slip) => slip.status === "won").length;
      const losses = graded.filter((slip) => slip.status === "lost").length;
      const pushes = graded.filter(
        (slip) => slip.status === "push" || slip.status === "void",
      ).length;
      const staked = slips.reduce((total, slip) => total + slip.stakeCents, 0);
      const returned = slips.reduce((total, slip) => total + slip.payoutCents, 0);
      const roiPercent = staked === 0 ? 0 : Number((((returned - staked) / staked) * 100).toFixed(1));
      const lockPoints = store.lockPicks.filter(
        (pick) => pick.userId === user.id && pick.result === "win",
      ).length;

      return {
        userId: user.id,
        displayName: user.nickname ?? user.displayName,
        bankrollCents: getWallet(user.id).balanceCents,
        roiPercent,
        wins,
        losses,
        pushes,
        streak: getSlipStreak(user.id),
        lockPoints,
      };
    })
    .sort(
      (left, right) =>
        right.bankrollCents - left.bankrollCents || right.roiPercent - left.roiPercent,
    );
}

function buildRivalryBoard(): RivalryEntry[] {
  const store = getStore();
  const weekKey = currentWeekKey();

  return store.users
    .map((user) => {
      const weeklySlips = store.slips.filter(
        (slip) =>
          slip.userId === user.id &&
          slip.status !== "open" &&
          isDateOnOrAfterWeekKey(new Date(slip.createdAt), weekKey, getClubTimeZone()),
      );
      const weeklyWins = weeklySlips.filter((slip) => slip.status === "won").length;
      const weeklyLosses = weeklySlips.filter((slip) => slip.status === "lost").length;
      const staked = weeklySlips.reduce((total, slip) => total + slip.stakeCents, 0);
      const returned = weeklySlips.reduce((total, slip) => total + slip.payoutCents, 0);
      const weeklyRoiPercent =
        staked === 0 ? 0 : Number((((returned - staked) / staked) * 100).toFixed(1));

      return {
        displayName: user.nickname ?? user.displayName,
        weeklyWins,
        weeklyLosses,
        weeklyRoiPercent,
      };
    })
    .sort(
      (left, right) =>
        right.weeklyWins - left.weeklyWins || right.weeklyRoiPercent - left.weeklyRoiPercent,
    );
}

export async function syncViewer(input: {
  clerkUserId: string;
  email: string;
  displayName: string;
  imageUrl?: string;
  role: ViewerProfile["role"];
}) {
  if (isDatabaseConfigured()) {
    return syncViewerLive(input);
  }

  const store = getStore();
  const existing = store.users.find(
    (user) => user.clerkUserId === input.clerkUserId || user.email === input.email,
  );

  if (existing) {
    existing.displayName = input.displayName;
    existing.imageUrl = input.imageUrl;
    existing.email = input.email;
    existing.role = input.role;
    return existing;
  }

  const user: ViewerProfile = {
    id: makeId("user"),
    clerkUserId: input.clerkUserId,
    email: input.email,
    displayName: input.displayName,
    nickname: null,
    imageUrl: input.imageUrl,
    role: input.role,
    status: "active",
    joinedAt: nowIso(),
  };

  store.users.push(user);
  store.wallets[user.id] = createWallet(user.id, 15000);
  addAudit(user.id, "created_profile", "user", user.id);

  return user;
}

export async function getMemberSnapshot(viewer: ViewerProfile): Promise<MemberSnapshot> {
  if (isDatabaseConfigured()) {
    return getMemberSnapshotLive(viewer);
  }

  const store = getStore();
  const wallet = getWallet(viewer.id);

  const weekKey = currentWeekKey();

  return {
    viewer,
    wallet,
    games: store.games
      .filter(
        (game) =>
          store.settings.enabledLeagues.includes(game.league) &&
          game.status !== "final" &&
          game.status !== "cancelled" &&
          game.status !== "postponed",
      )
      .sort((a, b) => +new Date(a.commenceTime) - +new Date(b.commenceTime)),
    slips: store.slips
      .filter((slip) => slip.userId === viewer.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    topUps: store.topUps
      .filter((request) => request.userId === viewer.id)
      .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt)),
    lockPick: store.lockPicks.find(
      (pick) => pick.userId === viewer.id && pick.weekKey === weekKey,
    ),
    leaderboards: buildLeaderboards(),
    rivalryBoard: buildRivalryBoard(),
    weekLockFeed: store.lockPicks
      .filter((pick) => pick.weekKey === weekKey)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .map((pick) => {
        const u = store.users.find((u) => u.id === pick.userId);
        return {
        id: pick.id,
        displayName: u?.nickname ?? u?.displayName ?? "Member",
        selectionTeam: pick.selectionTeam,
        selectionSide: pick.selectionSide,
        spread: pick.spread,
        americanOdds: pick.americanOdds,
        result: pick.result,
        note: pick.note,
        createdAt: pick.createdAt,
      };
      }),
    activity: store.activity,
    settings: store.settings,
    mode: getAppMode(),
  };
}

export async function getCurrentSettings() {
  if (isDatabaseConfigured()) {
    return loadSettingsLive();
  }

  return defaultSettings;
}

export async function getAdminSnapshot(): Promise<AdminSnapshot> {
  if (isDatabaseConfigured()) {
    return getAdminSnapshotLive();
  }

  const store = getStore();

  return {
    members: [...store.users].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    pendingTopUps: store.topUps
      .filter((request) => request.status === "pending")
      .sort((a, b) => +new Date(b.requestedAt) - +new Date(a.requestedAt)),
    audit: store.audit.slice(0, 12),
    opsHealthReport: store.opsHealthReport,
    anomalyAlerts: store.anomalyAlerts,
  };
}

export async function updateMemberAccess(input: {
  actorUserId: string;
  targetUserId: string;
  role?: ViewerProfile["role"];
  status?: ViewerProfile["status"];
}) {
  if (isDatabaseConfigured()) {
    return updateMemberAccessLive(input);
  }

  throw new Error("Member access management requires a database-backed environment.");
}

export async function updateProfile(
  userId: string,
  data: { displayName?: string; nickname?: string | null },
) {
  if (isDatabaseConfigured()) {
    return updateProfileLive(userId, data);
  }

  const store = getStore();
  const user = store.users.find((u) => u.id === userId);
  if (!user) throw new Error("User not found.");
  if (data.displayName !== undefined) user.displayName = data.displayName;
  if (data.nickname !== undefined) user.nickname = data.nickname;
  return user;
}

export async function setMaintenanceMode(actorUserId: string, enabled: boolean) {
  if (isDatabaseConfigured()) {
    return setMaintenanceModeLive(actorUserId, enabled);
  }

  throw new Error("Maintenance mode controls require a database-backed environment.");
}

export async function requestTopUp(userId: string, amountCents: number, note?: string) {
  if (isDatabaseConfigured()) {
    return requestTopUpLive(userId, amountCents, note);
  }

  const store = getStore();

  const request: TopUpRequestView = {
    id: makeId("topup"),
    userId,
    amountCents,
    status: "pending",
    note,
    requestedAt: nowIso(),
  };

  store.topUps.unshift(request);
  addActivity("A bankroll reload request just hit the queue.", "neutral");
  addAudit(userId, "requested_top_up", "top_up_request", request.id);

  return request;
}

export async function approveTopUp(actorUserId: string, requestId: string) {
  if (isDatabaseConfigured()) {
    return approveTopUpLive(actorUserId, requestId);
  }

  const store = getStore();
  const request = store.topUps.find((entry) => entry.id === requestId);

  if (!request || request.status !== "pending") {
    throw new Error("Top-up request is no longer pending.");
  }

  request.status = "paid";
  request.approvedAt = nowIso();
  request.approvedBy = actorUserId;
  pushLedgerEntry(
    request.userId,
    "top_up",
    request.amountCents,
    "Admin approved bankroll request",
    request.id,
  );

  const member = store.users.find((user) => user.id === request.userId);
  addActivity(
    `${member?.displayName ?? "A member"} got a bankroll reload approved.`,
    "good",
  );
  addAudit(actorUserId, "approved_top_up", "top_up_request", request.id);

  return request;
}

export async function placeSlip(input: {
  userId: string;
  stakeCents: number;
  selectionIds: string[];
}) {
  if (isDatabaseConfigured()) {
    return placeSlipLive(input);
  }

  const store = getStore();
  const { userId, stakeCents, selectionIds } = input;
  const wallet = getWallet(userId);
  const uniqueSelectionIds = Array.from(new Set(selectionIds.filter(Boolean)));
  const openSlips = store.slips.filter(
    (slip) => slip.userId === userId && slip.status === "open",
  ).length;

  if (uniqueSelectionIds.length === 0) {
    throw new Error("Choose at least one spread to build a slip.");
  }

  if (uniqueSelectionIds.length > 4) {
    throw new Error("Parlays are capped at four legs in v1.");
  }

  if (stakeCents < store.settings.minStakeCents || stakeCents > store.settings.maxStakeCents) {
    throw new Error("Stake is outside the configured table limits.");
  }

  if (openSlips >= store.settings.maxOpenSlipsPerUser) {
    throw new Error("You already have the maximum number of open slips.");
  }

  if (wallet.balanceCents < stakeCents) {
    throw new Error("Wallet balance is too low for that stake.");
  }

  const selections = uniqueSelectionIds.map((selectionId) => {
    const reference = getSelection(selectionId);

    if (!reference) {
      throw new Error("One of the selected lines is no longer available.");
    }

    const game = store.games.find((entry) => entry.id === reference.gameId);
    if (!game) {
      throw new Error("Game not found for selection.");
    }

    if (+new Date(game.commenceTime) <= Date.now()) {
      throw new Error("One of the selected games has already started.");
    }

    return { game, option: reference.option };
  });

  const gameIds = new Set(selections.map((entry) => entry.game.id));
  if (gameIds.size !== selections.length) {
    throw new Error("Only one pick per game is allowed on a single slip.");
  }

  const type = selections.length === 1 ? "straight" : "parlay";
  const legs: BetLegView[] = selections.map(({ game, option }) => ({
    id: makeId("leg"),
    gameId: game.id,
    selectionId: option.id,
    selectionTeam: option.team,
    selectionSide: option.side,
    spread: option.spread,
    americanOdds: option.americanOdds,
    bookmaker: option.bookmaker,
    quoteTimestamp: option.quoteTimestamp,
    result: "pending",
  }));

  const potentialPayoutCents =
    type === "straight"
      ? calculateStraightPayout(stakeCents, legs[0]!.americanOdds)
      : calculateParlayPayout(
          stakeCents,
          legs.map((leg) => leg.americanOdds),
        );

  const slip: BetSlipView = {
    id: makeId("slip"),
    userId,
    type,
    stakeCents,
    potentialPayoutCents,
    payoutCents: 0,
    status: "open",
    createdAt: nowIso(),
    legs,
  };

  store.slips.unshift(slip);
  pushLedgerEntry(userId, "stake_hold", stakeCents * -1, "Placed betting slip", slip.id);

  const member = store.users.find((user) => user.id === userId);
  addActivity(
    `${member?.displayName ?? "A member"} locked in a ${type} for tonight's card.`,
    "neutral",
  );
  addAudit(userId, "placed_slip", "bet_slip", slip.id);

  return slip;
}

export async function saveLockPick(userId: string, selectionId: string, note?: string) {
  if (isDatabaseConfigured()) {
    return saveLockPickLive(userId, selectionId, note);
  }

  const store = getStore();
  const reference = getSelection(selectionId);
  if (!reference) {
    throw new Error("That lock pick is no longer available.");
  }

  const existing = store.lockPicks.find(
    (pick) => pick.userId === userId && pick.weekKey === currentWeekKey(),
  );

  if (existing) {
    existing.gameId = reference.gameId;
    existing.selectionId = selectionId;
    existing.selectionTeam = reference.option.team;
    existing.selectionSide = reference.option.side;
    existing.spread = reference.option.spread;
    existing.americanOdds = reference.option.americanOdds;
    existing.bookmaker = reference.option.bookmaker;
    existing.quoteTimestamp = reference.option.quoteTimestamp;
    existing.result = "pending";
    existing.note = note;
    addAudit(userId, "updated_lock_pick", "lock_pick", existing.id);
    return existing;
  }

  const lockPick: LockPickView = {
    id: makeId("lock"),
    userId,
    gameId: reference.gameId,
    weekKey: currentWeekKey(),
    selectionId,
    selectionTeam: reference.option.team,
    selectionSide: reference.option.side,
    spread: reference.option.spread,
    americanOdds: reference.option.americanOdds,
    bookmaker: reference.option.bookmaker,
    quoteTimestamp: reference.option.quoteTimestamp,
    result: "pending",
    note,
    createdAt: nowIso(),
  };

  store.lockPicks.unshift(lockPick);
  addActivity("A new Lock of the Day just landed on the board.", "neutral");
  addAudit(userId, "created_lock_pick", "lock_pick", lockPick.id);

  return lockPick;
}

function buildDemoAnomalyAlerts(nowValue: string): AdminAnomalyAlert[] {
  const store = getStore();
  const alerts: AdminAnomalyAlert[] = [];

  const pendingTopUps = store.topUps.filter((request) => request.status === "pending").length;
  if (pendingTopUps >= 4) {
    alerts.push({
      id: makeId("alert"),
      category: "abuse",
      severity: pendingTopUps >= 8 ? "critical" : "warning",
      title: "Top-up queue spike",
      detail: `${pendingTopUps} pending top-up requests are waiting for review.`,
      userIds: [],
      createdAt: nowValue,
    });
  }

  const openSlipsByUser = new Map<string, number>();
  for (const slip of store.slips) {
    if (slip.status !== "open") {
      continue;
    }
    openSlipsByUser.set(slip.userId, (openSlipsByUser.get(slip.userId) ?? 0) + 1);
  }

  for (const [userId, count] of openSlipsByUser) {
    if (count < 10) {
      continue;
    }

    alerts.push({
      id: makeId("alert"),
      category: "wallet",
      severity: count >= 16 ? "critical" : "warning",
      title: "Unusual open-slip volume",
      detail: `Member has ${count} open slips in demo mode.`,
      userIds: [userId],
      createdAt: nowValue,
    });
  }

  return alerts;
}

export async function runAiOpsAutopilot(mode: OpsAutopilotMode = "hourly") {
  if (isDatabaseConfigured()) {
    return runAiOpsAutopilotLive(mode);
  }

  const store = getStore();
  const nowValue = nowIso();
  const findings: OpsFinding[] = [];
  const remediations: OpsRemediation[] = [];

  const latestQuoteAt = store.games
    .flatMap((game) => game.options)
    .map((option) => +new Date(option.quoteTimestamp))
    .sort((a, b) => b - a)[0];

  const freshnessMinutes = latestQuoteAt
    ? Math.round((Date.now() - latestQuoteAt) / (60 * 1000))
    : Number.POSITIVE_INFINITY;

  if (!Number.isFinite(freshnessMinutes) || freshnessMinutes > 45) {
    findings.push({
      code: "sync_stale",
      severity: freshnessMinutes > 120 ? "critical" : "warning",
      message: "Odds board appears stale in demo environment.",
      metric: Number.isFinite(freshnessMinutes) ? freshnessMinutes : 0,
    });
    await runOddsSync();
    remediations.push({
      action: "run_odds_sync",
      status: "applied",
      detail: "Triggered demo odds sync.",
    });
  } else {
    findings.push({
      code: "sync_healthy",
      severity: "info",
      message: "Odds freshness is healthy.",
      metric: freshnessMinutes,
    });
    remediations.push({
      action: "run_odds_sync",
      status: "skipped",
      detail: "Skipped due to healthy freshness.",
    });
  }

  const laggedSlips = store.slips.filter((slip) => {
    if (slip.status !== "open") {
      return false;
    }
    return slip.legs.every((leg) => {
      const game = store.games.find((entry) => entry.id === leg.gameId);
      return (
        game?.status === "final" ||
        game?.status === "cancelled" ||
        game?.status === "postponed"
      );
    });
  }).length;

  if (laggedSlips > 0) {
    findings.push({
      code: "settlement_lag",
      severity: laggedSlips >= 8 ? "critical" : "warning",
      message: "Detected lagged open slips.",
      metric: laggedSlips,
    });
    await runSettlementSweep();
    remediations.push({
      action: "run_settlement_sweep",
      status: "applied",
      detail: "Triggered demo settlement sweep.",
    });
  } else {
    remediations.push({
      action: "run_settlement_sweep",
      status: "skipped",
      detail: "No lagged slips detected.",
    });
  }

  const anomalyAlerts = buildDemoAnomalyAlerts(nowValue);
  if (anomalyAlerts.length > 0) {
    findings.push({
      code: "anomaly_alerts",
      severity: anomalyAlerts.some((alert) => alert.severity === "critical")
        ? "critical"
        : "warning",
      message: "Anomaly alerts detected in demo environment.",
      metric: anomalyAlerts.length,
    });
  }

  const reportBase = summarizeOpsHealth({
    mode,
    findings,
    remediations,
    now: new Date(nowValue),
  });
  const report = {
    ...reportBase,
    id: makeId("ops"),
  };

  store.opsHealthReport = report;
  store.anomalyAlerts = anomalyAlerts;
  addAudit("user_commissioner", "ran_ai_ops_autopilot", "system", "ai-autopilot");

  return {
    success: true,
    report,
    persistedAlertCount: anomalyAlerts.length,
    quarantinedUsers: 0,
  };
}

export async function runOddsSync() {
  if (isDatabaseConfigured()) {
    return runOddsSyncLive();
  }

  const store = getStore();
  let updatedQuotes = 0;

  store.games = store.games.map((game) => {
    if (game.status === "final") {
      return game;
    }

    const drift = Math.random() > 0.65 ? 0.5 : 0;
    const options = game.options.map((option, index) => {
      updatedQuotes += 1;
      const nextSpread = index === 0 ? option.spread + drift : option.spread - drift;
      const updatedOption: GameOption = {
        ...option,
        spread: Number(nextSpread.toFixed(1)),
        quoteTimestamp: nowIso(),
      };

      return addDemoIntelligence(updatedOption, game.commenceTime, option.spread);
    });

    return { ...game, options };
  });

  addAudit("user_commissioner", "ran_odds_sync", "system", "odds-sync");

  return {
    success: true,
    updatedQuotes,
    checkedGames: store.games.length,
  };
}

export async function runSettlementSweep() {
  if (isDatabaseConfigured()) {
    return runSettlementSweepLive();
  }

  const store = getStore();
  let settledGames = 0;
  let settledSlips = 0;

  for (const game of store.games) {
    if (game.status === "final") {
      continue;
    }

    if (+new Date(game.commenceTime) > Date.now() - 60 * 60 * 1000) {
      continue;
    }

    game.status = "final";
    game.homeScore = game.homeScore ?? Math.floor(Math.random() * 20) + 95;
    game.awayScore = game.awayScore ?? Math.floor(Math.random() * 20) + 95;
    settledGames += 1;
  }

  for (const slip of store.slips) {
    if (slip.status !== "open") {
      continue;
    }

    const legs = slip.legs.map((leg) => {
      const game = store.games.find((entry) => entry.id === leg.gameId);
      if (!game) {
        return { ...leg, result: "void" as const };
      }

      return {
        ...leg,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        result:
          game.status === "final"
            ? scoreSpreadLeg(game, leg.selectionSide, leg.spread)
            : game.status === "cancelled" || game.status === "postponed"
              ? "void"
              : "pending",
      };
    });

    const settlement = settleSlip(slip.type, slip.stakeCents, legs);
    if (settlement.status === "open") {
      slip.legs = settlement.legs;
      continue;
    }

    slip.legs = settlement.legs;
    slip.status = settlement.status;
    slip.payoutCents = settlement.payoutCents;
    slip.settledAt = nowIso();
    settledSlips += 1;

    if (settlement.payoutCents > 0) {
      pushLedgerEntry(
        slip.userId,
        settlement.status === "push" || settlement.status === "void" ? "refund" : "payout",
        settlement.payoutCents,
        "Slip settled",
        slip.id,
      );
    }
  }

  for (const pick of store.lockPicks) {
    const reference = getSelection(pick.selectionId);
    const game = reference ? store.games.find((entry) => entry.id === reference.gameId) : null;

    if (!reference || !game) {
      continue;
    }

    pick.result =
      game.status === "final"
        ? scoreSpreadLeg(game, pick.selectionSide, pick.spread)
        : game.status === "cancelled" || game.status === "postponed"
          ? "void"
          : pick.result;
  }

  if (settledGames > 0 || settledSlips > 0) {
    addActivity("Games were graded and wallet balances were refreshed.", "good");
  }

  addAudit("user_commissioner", "ran_settlement_sweep", "system", "settlement");

  return {
    success: true,
    settledGames,
    settledSlips,
  };
}

export async function getPublicLeaderboards(): Promise<{
  leaderboards: LeaderboardEntry[];
  rivalryBoard: RivalryEntry[];
}> {
  if (isDatabaseConfigured()) {
    return getPublicLeaderboardsLive();
  }

  return {
    leaderboards: buildLeaderboards(),
    rivalryBoard: buildRivalryBoard(),
  };
}

const sanitizedMessages: Record<string, string> = {
  good: "A member's balance was updated.",
  neutral: "A member placed a new pick.",
};

export async function getPublicFeed(): Promise<ActivityItem[]> {
  if (isDatabaseConfigured()) {
    return getActivityFeedLive();
  }

  return getStore().activity.map((item) => ({
    ...item,
    message: sanitizedMessages[item.tone] ?? "Activity in the clubhouse.",
  }));
}

/** Public week locks — stripped of team names, spreads, odds, and notes for privacy. */
export async function getPublicWeekLocks(): Promise<
  Pick<WeekLockFeedEntry, "id" | "displayName" | "result" | "createdAt">[]
> {
  let full: WeekLockFeedEntry[];

  if (isDatabaseConfigured()) {
    full = await getWeekLockFeedLive();
  } else {
    const store = getStore();
    const weekKey = currentWeekKey();
    full = store.lockPicks
      .filter((pick) => pick.weekKey === weekKey)
      .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      .map((pick) => ({
        id: pick.id,
        displayName: (() => { const u = store.users.find((u) => u.id === pick.userId); return u?.nickname ?? u?.displayName ?? "Member"; })(),
        selectionTeam: pick.selectionTeam,
        selectionSide: pick.selectionSide,
        spread: pick.spread,
        americanOdds: pick.americanOdds,
        result: pick.result,
        note: pick.note,
        createdAt: pick.createdAt,
      }));
  }

  return full.map(({ id, displayName, result, createdAt }) => ({
    id,
    displayName,
    result,
    createdAt,
  }));
}
