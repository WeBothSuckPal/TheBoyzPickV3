"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EnhancedLeaderboardEntry, RivalryEntry } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type Tab = "all-time" | "this-week";

export function LeaderboardTabs({
  leaderboards,
  rivalryBoard,
}: {
  leaderboards: EnhancedLeaderboardEntry[];
  rivalryBoard: RivalryEntry[];
}) {
  const [tab, setTab] = useState<Tab>("all-time");

  return (
    <div className="space-y-6">
      {/* Tab toggle */}
      <div className="flex gap-1 rounded-full border border-white/10 bg-white/4 p-1">
        <button
          type="button"
          onClick={() => setTab("all-time")}
          className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === "all-time"
              ? "bg-[var(--accent)]/15 border border-[var(--accent)]/40 text-white"
              : "border border-transparent text-[var(--muted-foreground)] hover:text-white"
          }`}
        >
          All-Time
        </button>
        <button
          type="button"
          onClick={() => setTab("this-week")}
          className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
            tab === "this-week"
              ? "bg-[var(--accent)]/15 border border-[var(--accent)]/40 text-white"
              : "border border-transparent text-[var(--muted-foreground)] hover:text-white"
          }`}
        >
          This Week
        </button>
      </div>

      {/* Content */}
      {tab === "all-time" ? (
        <AllTimeBoard leaderboards={leaderboards} />
      ) : (
        <WeeklyBoard rivalryBoard={rivalryBoard} />
      )}
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null;
  const fires = "🔥".repeat(Math.min(streak, 5));
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-400">
      {fires} {streak}
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
  const medals = ["🥇", "🥈", "🥉"];
  if (rank <= 3) {
    return <span className="text-2xl">{medals[rank - 1]}</span>;
  }
  return (
    <span className="text-2xl font-semibold text-[var(--muted-foreground)]">{rank}</span>
  );
}

function AllTimeBoard({ leaderboards }: { leaderboards: EnhancedLeaderboardEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Main board</CardTitle>
        <CardDescription>
          Ranked by bankroll first, ROI second, then streak form.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {leaderboards.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            No entries yet. Place some picks!
          </p>
        ) : null}
        {leaderboards.map((entry, index) => (
          <div
            key={entry.userId}
            className="grid gap-4 rounded-[28px] border border-white/10 bg-black/18 p-4 md:grid-cols-[auto_1fr_auto]"
          >
            <div className="flex items-center justify-center">
              <RankBadge rank={index + 1} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/members/${entry.userId}`} className="text-lg font-semibold text-white hover:text-[var(--accent)] transition-colors">{entry.displayName}</Link>
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
          <div
            key={entry.displayName}
            className="grid gap-3 rounded-[28px] border border-white/10 bg-black/18 p-4 md:grid-cols-[auto_1fr_auto_auto]"
          >
            <div className="flex items-center justify-center">
              <RankBadge rank={index + 1} />
            </div>
            <div className="text-lg font-semibold text-white">{entry.displayName}</div>
            <div className="text-sm text-[var(--muted-foreground)]">
              {entry.weeklyWins}-{entry.weeklyLosses}
            </div>
            <div className="text-sm font-semibold text-white">
              {entry.weeklyRoiPercent}% ROI
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
