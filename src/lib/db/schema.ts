import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["owner_admin", "member"]);
export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);
export const gameStatusEnum = pgEnum("game_status", [
  "scheduled",
  "in_progress",
  "final",
  "cancelled",
  "postponed",
]);
export const topUpStatusEnum = pgEnum("top_up_status", [
  "pending",
  "paid",
  "rejected",
]);
export const betSlipTypeEnum = pgEnum("bet_slip_type", ["straight", "parlay"]);
export const betSlipStatusEnum = pgEnum("bet_slip_status", [
  "open",
  "won",
  "lost",
  "push",
  "void",
]);
export const betLegResultEnum = pgEnum("bet_leg_result", [
  "pending",
  "win",
  "loss",
  "push",
  "void",
]);

export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    nickname: text("nickname"),
    imageUrl: text("image_url"),
    role: roleEnum("role").notNull().default("member"),
    status: userStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    clerkUserIdIdx: uniqueIndex("user_profiles_clerk_user_id_idx").on(table.clerkUserId),
    emailIdx: uniqueIndex("user_profiles_email_idx").on(table.email),
  }),
);

export const walletAccounts = pgTable(
  "wallet_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id),
    balanceCents: integer("balance_cents").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userProfileIdx: uniqueIndex("wallet_accounts_user_profile_id_idx").on(table.userProfileId),
  }),
);

export const walletLedgerEntries = pgTable(
  "wallet_ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id),
    entryType: text("entry_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    balanceAfterCents: integer("balance_after_cents").notNull(),
    note: text("note").notNull(),
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueReferenceIdx: uniqueIndex("wallet_ledger_entries_entry_reference_idx")
      .on(table.entryType, table.referenceId)
      .where(sql`${table.referenceId} is not null`),
  }),
);

export const topUpRequests = pgTable("top_up_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  userProfileId: uuid("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),
  amountCents: integer("amount_cents").notNull(),
  status: topUpStatusEnum("status").notNull().default("pending"),
  note: text("note"),
  approvedByUserProfileId: uuid("approved_by_user_profile_id").references(
    () => userProfiles.id,
  ),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
});

export const leagues = pgTable("leagues", {
  slug: text("slug").primaryKey(),
  label: text("label").notNull(),
  sportKey: text("sport_key").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalId: text("external_id").notNull(),
    leagueSlug: text("league_slug")
      .notNull()
      .references(() => leagues.slug),
    homeTeam: text("home_team").notNull(),
    awayTeam: text("away_team").notNull(),
    commenceTime: timestamp("commence_time", { withTimezone: true }).notNull(),
    status: gameStatusEnum("status").notNull().default("scheduled"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    externalIdIdx: uniqueIndex("games_external_id_idx").on(table.externalId),
  }),
);

export const oddsQuotes = pgTable(
  "odds_quotes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    bookmakerKey: text("bookmaker_key").notNull(),
    market: text("market").notNull().default("spreads"),
    selectionTeam: text("selection_team").notNull(),
    selectionSide: text("selection_side").notNull(),
    point: numeric("point", { precision: 6, scale: 2 }).notNull(),
    americanOdds: integer("american_odds").notNull(),
    quoteTimestamp: timestamp("quote_timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (table) => ({
    uniquePrimaryQuoteIdx: uniqueIndex("odds_quotes_primary_identity_idx").on(
      table.gameId,
      table.bookmakerKey,
      table.market,
      table.selectionSide,
      table.isPrimary,
    ),
  }),
);

export const aiMarketSnapshots = pgTable(
  "ai_market_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    leagueSlug: text("league_slug")
      .notNull()
      .references(() => leagues.slug),
    bookmakerKey: text("bookmaker_key").notNull(),
    selectionSide: text("selection_side").notNull(),
    spread: numeric("spread", { precision: 6, scale: 2 }).notNull(),
    americanOdds: integer("american_odds").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const betSlips = pgTable("bet_slips", {
  id: uuid("id").defaultRandom().primaryKey(),
  userProfileId: uuid("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),
  slipType: betSlipTypeEnum("slip_type").notNull(),
  stakeCents: integer("stake_cents").notNull(),
  potentialPayoutCents: integer("potential_payout_cents").notNull(),
  payoutCents: integer("payout_cents").notNull().default(0),
  status: betSlipStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export const betLegs = pgTable("bet_legs", {
  id: uuid("id").defaultRandom().primaryKey(),
  betSlipId: uuid("bet_slip_id")
    .notNull()
    .references(() => betSlips.id),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id),
  oddsQuoteId: uuid("odds_quote_id").references(() => oddsQuotes.id),
  selectionId: text("selection_id").notNull(),
  selectionTeam: text("selection_team").notNull(),
  selectionSide: text("selection_side").notNull(),
  spread: numeric("spread", { precision: 6, scale: 2 }).notNull(),
  americanOdds: integer("american_odds").notNull(),
  bookmakerKey: text("bookmaker_key").notNull(),
  quoteTimestamp: timestamp("quote_timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
  result: betLegResultEnum("result").notNull().default("pending"),
});

export const lockPicks = pgTable(
  "lock_picks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id),
    selectionId: text("selection_id").notNull(),
    selectionTeam: text("selection_team").notNull(),
    selectionSide: text("selection_side").notNull(),
    spread: numeric("spread", { precision: 6, scale: 2 }).notNull(),
    americanOdds: integer("american_odds").notNull(),
    bookmakerKey: text("bookmaker_key").notNull(),
    quoteTimestamp: timestamp("quote_timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    weekKey: text("week_key").notNull(),
    result: betLegResultEnum("result").notNull().default("pending"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    uniqueWeeklyLockIdx: uniqueIndex("lock_picks_user_week_idx").on(
      table.userProfileId,
      table.weekKey,
    ),
  }),
);

export const leaderboardSnapshots = pgTable("leaderboard_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  snapshotKey: text("snapshot_key").notNull(),
  weekKey: text("week_key").notNull(),
  userProfileId: uuid("user_profile_id")
    .notNull()
    .references(() => userProfiles.id),
  bankrollCents: integer("bankroll_cents").notNull(),
  roiPercent: integer("roi_percent").notNull(),
  winStreak: integer("win_streak").notNull(),
  lockPoints: integer("lock_points").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserProfileId: uuid("actor_user_profile_id").references(() => userProfiles.id),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  requestId: text("request_id"),
  ipHash: text("ip_hash"),
  outcome: text("outcome").notNull().default("success"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const adminAuditLogArchives = pgTable("admin_audit_log_archives", {
  id: uuid("id").primaryKey(),
  actorUserProfileId: uuid("actor_user_profile_id").references(() => userProfiles.id),
  actorEmail: text("actor_email"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  requestId: text("request_id"),
  ipHash: text("ip_hash"),
  outcome: text("outcome").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const opsHealthReports = pgTable("ops_health_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  mode: text("mode").notNull(),
  score: integer("score").notNull(),
  summary: text("summary").notNull(),
  findings: jsonb("findings").$type<Record<string, unknown>[]>().notNull(),
  remediations: jsonb("remediations").$type<Record<string, unknown>[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const anomalyAlerts = pgTable("anomaly_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  userIds: jsonb("user_ids").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    category: text("category").notNull(),
    subjectKey: text("subject_key").notNull(),
    hits: integer("hits").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    categorySubjectIdx: uniqueIndex("rate_limit_buckets_category_subject_idx").on(
      table.category,
      table.subjectKey,
    ),
  }),
);

export const reactions = pgTable(
  "reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    userTargetEmojiIdx: uniqueIndex("reactions_user_target_emoji_idx").on(
      table.userProfileId,
      table.targetType,
      table.targetId,
      table.emoji,
    ),
  }),
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userProfileId: uuid("user_profile_id")
      .notNull()
      .references(() => userProfiles.id),
    targetType: text("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    targetIdx: index("comments_target_idx").on(
      table.targetType,
      table.targetId,
    ),
  }),
);
