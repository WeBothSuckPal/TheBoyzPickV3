"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPusherClient } from "@/lib/pusher";
import type { ClubStats, EnhancedLeaderboardEntry, RivalryEntry } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type Tab = "all-time" | "this-week";

export function LeaderboardTabs({
  leaderboards,
  rivalryBoard,
  clubStats,
  mode,
}: {
  leaderboards: EnhancedLeaderboardEntry[];
  rivalryBoard: RivalryEntry[];
  clubStats: ClubStats;
  mode: "demo" | "live";
}) {
  const [tab, setTab] = useState<Tab>("all-time");
  const [boardData, setBoardData] = useState({ leaderboards, rivalryBoard });
  const [prevLeaderboards, setPrevLeaderboards] = useState(leaderboards);

  if (leaderboards !== prevLeaderboards) {
    setPrevLeaderboards(leaderboards);
    setBoardData({ leaderboards, rivalryBoard });
  }

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe("clubhouse");
    channel.bind(
      "leaderboards-update",
      (data: { leaderboards: EnhancedLeaderboardEntry[]; rivalryBoard: RivalryEntry[] }) => {
        setBoardData(data);
      },
    );

    return () => {
      pusher.unsubscribe("clubhouse");
      pusher.disconnect();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex gap-1 rounded-full border border-white/10 bg-white/4 p-1">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "all-time"}
          onClick={() => setTab("all-time")}
          className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === "all-time"
              ? "border border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
              : "border border-transparent text-[var(--muted-foreground)] hover:text-white"
          }`}
        >
          All-Time
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "this-week"}
          onClick={() => setTab("this-week")}
          className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === "this-week"
              ? "border border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
              : "border border-transparent text-[var(--muted-foreground)] hover:text-white"
          }`}
        >
          This Week
        </button>
      </div>

      {tab === "all-time" ? (
        <AllTimeBoard leaderboards={boardData.leaderboards} mode={mode} />
      ) : (
        <WeeklyBoard rivalryBoard={boardData.rivalryBoard} />
      )}

      <ClubOverview stats={clubStats} />
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null;
  const flames = "\uD83D\uDD25".repeat(Math.min(streak, 5));
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-400">
      {flames} {streak}
    </span>
  );
}

function HeatBadge({ heat }: { heat: "hot" | "cold" | "neutral" }) {
  if (heat === "neutral") return null;
  if (heat === "hot") {
    return (
      <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-green-400">
        HOT
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-400/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-400">
      COLD
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medals = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49"];
  if (rank <= 3) {
    return <span className="text-2xl">{medals[rank - 1]}</span>;
  }

  return <span className="text-2xl font-semibold text-[var(--muted-foreground)]">{rank}</span>;
}

function MemberAccordion({
  entry,
  mode,
}: {
  entry: EnhancedLeaderboardEntry;
  mode: "demo" | "live";
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 text-lg font-semibold text-white transition hover:text-[var(--accent)]"
      >
        {entry.displayName}
        <ChevronDown
          className={`size-4 text-[var(--muted-foreground)] transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Record" value={`${entry.wins}-${entry.losses}-${entry.pushes}`} />
              <MiniStat label="ROI" value={`${entry.roiPercent}%`} />
              <MiniStat label="Streak" value={String(entry.streak)} />
              <MiniStat
                label="Best Parlay"
                value={
                  entry.bestParlayPayoutCents > 0
                    ? formatCurrency(entry.bestParlayPayoutCents)
                    : "-"
                }
              />
            </div>
            {mode === "live" ? (
              <div className="mt-2 flex justify-end">
                <Link
                  href={`/members/${entry.userId}`}
                  className="text-xs font-semibold text-[var(--accent)] transition hover:underline"
                >
                  View full profile →
                </Link>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-2.5 text-center">
      <div className="text-sm font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
        {label}
      </div>
    </div>
  );
}

function AllTimeBoard({
  leaderboards,
  mode,
}: {
  leaderboards: EnhancedLeaderboardEntry[];
  mode: "demo" | "live";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Main board</CardTitle>
        <CardDescription>
          Ranked by bankroll first, ROI second, then streak form. Tap a name for stats.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaderboards.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            No entries yet. Place some picks!
          </p>
        ) : null}
        {leaderboards.map((entry, index) => (
          <motion.div
            key={entry.userId}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="rounded-[28px] border border-white/10 bg-black/18 p-4"
          >
            <div className="grid gap-4 md:grid-cols-[auto_1fr_auto]">
              <div className="flex items-center justify-center">
                <RankBadge rank={index + 1} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <MemberAccordion entry={entry} mode={mode} />
                  <HeatBadge heat={entry.heatBadge} />
                  <StreakBadge streak={entry.streak} />
                </div>
                <div className="mt-0.5 text-sm text-[var(--muted-foreground)]">
                  {entry.wins}-{entry.losses}-{entry.pushes} | ROI {entry.roiPercent}%
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Badge>{formatCurrency(entry.bankrollCents)}</Badge>
                <Badge>Locks {entry.lockPoints}</Badge>
                {entry.bestParlayPayoutCents > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400">
                    🎰 Best Parlay {formatCurrency(entry.bestParlayPayoutCents)}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

function WeeklyBoard({ rivalryBoard }: { rivalryBoard: RivalryEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly rivalry board</CardTitle>
        <CardDescription>
          Short-form flex table for this week&apos;s head-to-head banter.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rivalryBoard.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            No weekly action yet. Get some picks in!
          </p>
        ) : null}
        {rivalryBoard.map((entry, index) => (
          <motion.div
            key={entry.displayName}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="grid gap-3 rounded-[28px] border border-white/10 bg-black/18 p-4 md:grid-cols-[auto_1fr_auto_auto]"
          >
            <div className="flex items-center justify-center">
              <RankBadge rank={index + 1} />
            </div>
            <div className="text-lg font-semibold text-white">{entry.displayName}</div>
            <div className="text-sm text-[var(--muted-foreground)]">
              {entry.weeklyWins}-{entry.weeklyLosses}
            </div>
            <div className="text-sm font-semibold text-white">{entry.weeklyRoiPercent}% ROI</div>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

function ClubOverview({ stats }: { stats: ClubStats }) {
  const clubRoi =
    stats.totalWageredCents > 0
      ? `${Math.round(((stats.totalReturnedCents - stats.totalWageredCents) / stats.totalWageredCents) * 100)}%`
      : "0%";
  const maxTeamCount = stats.teamPopularity[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-white">
        Club Overview
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard label="Total Wagered" value={formatCurrency(stats.totalWageredCents)} />
        <OverviewCard label="Total Returned" value={formatCurrency(stats.totalReturnedCents)} />
        <OverviewCard
          label="Biggest Win"
          value={formatCurrency(stats.biggestSingleWinCents)}
          sub={
            stats.biggestWinnerDisplayName !== "N/A"
              ? `by ${stats.biggestWinnerDisplayName}`
              : undefined
          }
        />
        <OverviewCard
          label="Parlay Hit Rate"
          value={`${stats.parlayHitRatePercent}%`}
          sub={`${stats.parlaysWon} of ${stats.totalParlays} parlays`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="grid grid-cols-3 divide-x divide-white/10 p-0">
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-white">{stats.totalSlips}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Slips
              </div>
            </div>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-white">{stats.totalParlays}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Parlays
              </div>
            </div>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-white">{clubRoi}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                Club ROI
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm">Most Popular Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {stats.teamPopularity.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No picks yet.</p>
            ) : null}
            {stats.teamPopularity.slice(0, 5).map((item) => (
              <div key={item.team} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{item.team}</span>
                  <span className="font-mono text-[var(--muted-foreground)]">{item.count}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6">
                  <div
                    className="h-full rounded-full bg-[var(--accent)]/60 transition-all duration-500"
                    style={{ width: `${Math.max((item.count / maxTeamCount) * 100, 6)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-4 pb-2 pt-4">
            <CardTitle className="text-sm">Win Rate by League</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 pb-4">
            {stats.leagueWinRates.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">No settled picks yet.</p>
            ) : null}
            {stats.leagueWinRates.map((item) => (
              <div key={item.league} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">{item.league}</span>
                  <span className="font-mono text-[var(--muted-foreground)]">{item.percent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/6">
                  <div className="flex h-full">
                    <div
                      className="h-full rounded-l-full bg-green-500/50 transition-all duration-500"
                      style={{ width: `${Math.max(item.percent, 4)}%` }}
                    />
                    <div
                      className="h-full rounded-r-full bg-red-500/30 transition-all duration-500"
                      style={{ width: `${Math.max(100 - item.percent, 4)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OverviewCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[28px] border border-white/10 bg-[var(--panel-strong)] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
        {label}
      </div>
      <div className="mt-2 rounded-2xl bg-[var(--accent)]/10 px-3 py-2.5">
        <div className="text-xl font-bold text-white">{value}</div>
        {sub ? <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">{sub}</div> : null}
      </div>
    </div>
  );
}
