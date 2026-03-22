"use client";

import { useState, useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatGameTime, formatOdds, formatSpread } from "@/lib/utils";
import type { GameStatus } from "@/lib/types";

interface GameOption {
  id: string;
  team: string;
  side: string;
  spread: number;
  americanOdds: number;
  market: string;
  openingPoint?: number;
  openingAmericanOdds?: number;
  intelligence?: {
    confidenceBand: string;
    riskTags: string[];
    blurb: string;
  } | null;
}

function OddsDeltaBadge({ current, opening }: { current?: number; opening?: number }) {
  if (opening == null || current == null) return null;
  const delta = current - opening;
  if (delta === 0) return null;
  return (
    <span className={`text-xs ${delta > 0 ? "text-amber-400" : "text-blue-400"}`}>
      {delta > 0 ? "▲" : "▼"} {delta > 0 ? "+" : ""}{delta}
    </span>
  );
}

interface FilterableGame {
  id: string;
  league: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  status: GameStatus;
  options: GameOption[];
}

function statusLabel(status: GameStatus): string {
  if (status === "in_progress") return "Live";
  if (status === "final") return "Final";
  if (status === "cancelled") return "Cancelled";
  if (status === "postponed") return "Postponed";
  return "Scheduled";
}

function statusClass(status: GameStatus): string {
  if (status === "in_progress")
    return "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent)] animate-[border-glow_2s_ease-in-out_infinite]";
  if (status === "final") return "border-white/10 bg-white/5 text-[var(--muted-foreground)]";
  if (status === "cancelled" || status === "postponed")
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  return "";
}

export function LeagueFilter({ games }: { games: FilterableGame[] }) {
  const leagues = useMemo(() => {
    const seen = new Set<string>();
    for (const g of games) seen.add(g.league);
    return Array.from(seen);
  }, [games]);

  const [active, setActive] = useState<string | null>(null);

  const visible = active ? games.filter((g) => g.league === active) : games;

  return (
    <div className="space-y-4">
      {/* League filter chips — only show if there are 2+ leagues */}
      {leagues.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActive(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] transition",
              active === null
                ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                : "border-white/10 bg-white/5 text-[var(--muted-foreground)] hover:bg-white/8 hover:text-white",
            )}
          >
            All
          </button>
          {leagues.map((league) => (
            <button
              key={league}
              type="button"
              onClick={() => setActive(league)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] transition",
                active === league
                  ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                  : "border-white/10 bg-white/5 text-[var(--muted-foreground)] hover:bg-white/8 hover:text-white",
              )}
            >
              {league}
            </button>
          ))}
        </div>
      )}

      {/* Game cards */}
      {visible.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-black/18 p-6 text-center text-sm text-[var(--muted-foreground)]">
          No games found.
        </div>
      ) : (
        visible.map((game) => (
          <div
            key={game.id}
            className="rounded-[28px] border border-white/10 bg-black/18 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  {game.league}
                </div>
                <div className="mt-1 text-lg font-semibold text-white">{game.matchup}</div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {formatGameTime(game.commenceTime)}
                </div>
              </div>
              <Badge className={statusClass(game.status)}>{statusLabel(game.status)}</Badge>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {game.options.map((option) => (
                <div
                  key={option.id}
                  className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3"
                >
                  <div className="text-sm font-semibold text-white">{option.team}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-sm text-[var(--muted-foreground)]">
                    <span>{formatSpread(option.spread)}</span>
                    <OddsDeltaBadge current={option.spread} opening={option.openingPoint} />
                    <span>|</span>
                    <span>{formatOdds(option.americanOdds)}</span>
                    <OddsDeltaBadge current={option.americanOdds} opening={option.openingAmericanOdds} />
                  </div>
                  {option.intelligence ? (
                    <div className="mt-3 space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge>AI {option.intelligence.confidenceBand}</Badge>
                        {option.intelligence.riskTags.map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                      </div>
                      <div className="text-xs leading-6 text-[var(--muted-foreground)]">
                        {option.intelligence.blurb}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
