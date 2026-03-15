export const leagueCatalog = [
  { slug: "NFL", label: "NFL" },
  { slug: "NBA", label: "NBA" },
  { slug: "MLB", label: "MLB" },
  { slug: "NHL", label: "NHL" },
  { slug: "NCAAF", label: "NCAAF" },
  { slug: "NCAAB", label: "NCAAB" },
  { slug: "WNBA", label: "WNBA" },
] as const;

export type LeagueSlug = (typeof leagueCatalog)[number]["slug"];
export type Role = "owner_admin" | "member";
export type UserStatus = "active" | "suspended";
export type GameStatus =
  | "scheduled"
  | "in_progress"
  | "final"
  | "cancelled"
  | "postponed";
export type BetSlipType = "straight" | "parlay";
export type BetSlipStatus = "open" | "won" | "lost" | "push" | "void";
export type BetLegResult = "pending" | "win" | "loss" | "push" | "void";
export type TopUpStatus = "pending" | "paid" | "rejected";
export type SelectionSide = "home" | "away" | "over" | "under";
export type BetMarket = "h2h" | "spreads" | "totals";
export type ConfidenceBand = "low" | "medium" | "high";
export type OpsSeverity = "info" | "warning" | "critical";
export type OpsAutopilotMode = "hourly" | "nightly" | "manual";

export interface BetIntelligence {
  riskTags: string[];
  confidenceBand: ConfidenceBand;
  lineMovement: number;
  volatility: number;
  blurb: string;
}

export interface OpsFinding {
  code: string;
  severity: OpsSeverity;
  message: string;
  metric: number;
}

export interface OpsRemediation {
  action: string;
  status: "applied" | "skipped" | "failed";
  detail: string;
}

export interface OpsHealthReport {
  id: string;
  mode: OpsAutopilotMode;
  score: number;
  summary: string;
  findings: OpsFinding[];
  remediations: OpsRemediation[];
  createdAt: string;
}

export interface AdminAnomalyAlert {
  id: string;
  category: "collusion" | "abuse" | "wallet";
  severity: OpsSeverity;
  title: string;
  detail: string;
  userIds: string[];
  createdAt: string;
}

export interface ViewerProfile {
  id: string;
  clerkUserId: string;
  email: string;
  displayName: string;
  nickname: string | null;
  imageUrl?: string;
  role: Role;
  status: UserStatus;
  joinedAt: string;
}

/** Returns the public-facing name (nickname if set, otherwise displayName). */
export function getPublicName(profile: { displayName: string; nickname: string | null }): string {
  return profile.nickname || profile.displayName;
}

export interface WalletLedgerEntry {
  id: string;
  userId: string;
  type: "seed" | "stake_hold" | "payout" | "top_up" | "refund" | "adjustment";
  amountCents: number;
  balanceAfterCents: number;
  note: string;
  referenceId?: string;
  createdAt: string;
}

export interface WalletView {
  userId: string;
  balanceCents: number;
  ledger: WalletLedgerEntry[];
}

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
}

export interface GameCard {
  id: string;
  league: LeagueSlug;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  options: GameOption[];
}

export interface BetLegView {
  id: string;
  gameId: string;
  selectionId: string;
  selectionTeam: string;
  selectionSide: SelectionSide;
  spread: number;
  americanOdds: number;
  market?: BetMarket;
  bookmaker: string;
  quoteTimestamp: string;
  result: BetLegResult;
  homeScore?: number;
  awayScore?: number;
}

export interface BetSlipView {
  id: string;
  userId: string;
  type: BetSlipType;
  stakeCents: number;
  potentialPayoutCents: number;
  payoutCents: number;
  status: BetSlipStatus;
  createdAt: string;
  settledAt?: string;
  legs: BetLegView[];
}

export interface TopUpRequestView {
  id: string;
  userId: string;
  amountCents: number;
  status: TopUpStatus;
  note?: string;
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface LockPickView {
  id: string;
  userId: string;
  gameId: string;
  weekKey: string;
  selectionId: string;
  selectionTeam: string;
  selectionSide: SelectionSide;
  spread: number;
  americanOdds: number;
  bookmaker: string;
  quoteTimestamp: string;
  result: BetLegResult;
  note?: string;
  createdAt: string;
}

export interface WeekLockFeedEntry {
  id: string;
  displayName: string;
  selectionTeam: string;
  selectionSide: SelectionSide;
  spread: number;
  americanOdds: number;
  result: BetLegResult;
  note?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  bankrollCents: number;
  roiPercent: number;
  wins: number;
  losses: number;
  pushes: number;
  streak: number;
  lockPoints: number;
}

export type HeatBadge = "hot" | "cold" | "neutral";

export interface EnhancedLeaderboardEntry extends LeaderboardEntry {
  bestParlayPayoutCents: number;
  bestParlayLegCount: number;
  recentWinRate: number;
  heatBadge: HeatBadge;
}

export interface RivalryEntry {
  displayName: string;
  weeklyWins: number;
  weeklyLosses: number;
  weeklyRoiPercent: number;
}

export interface ActivityItem {
  id: string;
  message: string;
  createdAt: string;
  tone: "good" | "bad" | "neutral";
}

export interface AuditItem {
  id: string;
  actorUserId?: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  requestId?: string;
  ipHash?: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AppSettings {
  enabledLeagues: LeagueSlug[];
  primaryBookmaker: string;
  minStakeCents: number;
  maxStakeCents: number;
  maxOpenSlipsPerUser: number;
  bankrollInstructions: string;
  maintenanceMode: boolean;
}

export interface MemberSnapshot {
  viewer: ViewerProfile;
  wallet: WalletView;
  games: GameCard[];
  slips: BetSlipView[];
  topUps: TopUpRequestView[];
  lockPick?: LockPickView;
  leaderboards: LeaderboardEntry[];
  rivalryBoard: RivalryEntry[];
  weekLockFeed: WeekLockFeedEntry[];
  activity: ActivityItem[];
  settings: AppSettings;
  mode: "demo" | "live";
}

export interface AdminSnapshot {
  members: ViewerProfile[];
  pendingTopUps: TopUpRequestView[];
  audit: AuditItem[];
  opsHealthReport?: OpsHealthReport;
  anomalyAlerts: AdminAnomalyAlert[];
}

export interface ClubStats {
  totalWageredCents: number;
  totalReturnedCents: number;
  biggestSingleWinCents: number;
  biggestWinnerDisplayName: string;
  totalSlips: number;
  totalParlays: number;
  parlaysWon: number;
  parlayHitRatePercent: number;
  teamPopularity: { team: string; count: number }[];
  leagueWinRates: { league: string; wins: number; total: number; percent: number }[];
}

export interface MemberProfile {
  userId: string;
  displayName: string;
  joinedAt: string;
  record: { wins: number; losses: number; pushes: number };
  bankrollCents: number;
  roiPercent: number;
  streak: number;
  lockPoints: number;
  lockPickHistory: {
    selectionTeam: string;
    spread: number;
    americanOdds: number;
    result: BetLegResult;
    note?: string;
    weekKey: string;
  }[];
  bestParlayPayoutCents: number;
  bestParlayLegCount: number;
  totalSlips: number;
  totalParlays: number;
}

export interface SelectionReference {
  gameId: string;
  option: GameOption;
}
