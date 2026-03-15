"use client";

import { useState, useMemo } from "react";
import { saveLockPickAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatOdds, formatSpread, formatGameTime } from "@/lib/utils";

interface GameOption {
  id: string;
  team: string;
  side: string;
  spread: number;
  americanOdds: number;
  market: string;
}

interface LockPickGame {
  id: string;
  league: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  options: GameOption[];
}

function getPickLabel(option: GameOption): string {
  if (option.market === "h2h") return `${option.team} ML`;
  if (option.market === "totals")
    return `${option.team} ${option.spread > 0 ? "O" : "U"} ${Math.abs(option.spread)}`;
  return `${option.team} ${formatSpread(option.spread)}`;
}

export function LockPickForm({
  games,
  currentSelectionId,
  currentNote,
}: {
  games: LockPickGame[];
  currentSelectionId?: string;
  currentNote?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(currentSelectionId ?? null);

  // Group games by league
  const gamesByLeague = useMemo(() => {
    const grouped = new Map<string, LockPickGame[]>();
    for (const game of games) {
      const existing = grouped.get(game.league) ?? [];
      existing.push(game);
      grouped.set(game.league, existing);
    }
    return grouped;
  }, [games]);

  // Lookup selected option details
  const selectedOption = useMemo(() => {
    if (!selectedId) return null;
    const game = games.find((g) => g.options.some((o) => o.id === selectedId));
    if (!game) return null;
    const option = game.options.find((o) => o.id === selectedId);
    return option ? { option, game } : null;
  }, [selectedId, games]);

  function toggleOption(optionId: string) {
    setSelectedId((prev) => (prev === optionId ? null : optionId));
  }

  return (
    <ActionForm action={saveLockPickAction} resetOnSuccess={false}>
      {(pending) => (
        <div className="space-y-4">
          {/* Hidden input for form submission */}
          <input type="hidden" name="selectionId" value={selectedId ?? ""} />

          {/* Game board */}
          {games.length === 0 ? (
            <div className="rounded-[24px] border border-white/10 bg-black/18 p-5 text-center text-sm text-[var(--muted-foreground)]">
              No games available right now. Check back later.
            </div>
          ) : (
            Array.from(gamesByLeague.entries()).map(([league, leagueGames]) => (
              <div key={league} className="space-y-2.5">
                {/* League header */}
                <div className="flex items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    {league}
                  </div>
                  <div className="h-px flex-1 bg-white/8" />
                </div>

                {/* Game cards */}
                {leagueGames.map((game) => (
                  <div
                    key={game.id}
                    className="rounded-[20px] border border-white/10 bg-black/18 p-3"
                  >
                    <div className="mb-2.5 flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-white">{game.matchup}</div>
                      <div className="shrink-0 text-xs text-[var(--muted-foreground)]">
                        {formatGameTime(game.commenceTime)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {game.options.map((option) => {
                        const isSelected = selectedId === option.id;

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleOption(option.id)}
                            aria-pressed={isSelected}
                            aria-label={`Select ${getPickLabel(option)} at ${formatOdds(option.americanOdds)}`}
                            className={`relative rounded-2xl border px-3.5 py-2.5 text-left transition-all duration-200 ${
                              isSelected
                                ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 shadow-[0_0_20px_rgba(204,41,54,0.15)]"
                                : "border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/8"
                            }`}
                          >
                            <div className={`text-sm font-semibold ${isSelected ? "text-white" : "text-white/80"}`}>
                              {getPickLabel(option)}
                            </div>
                            <div className={`mt-0.5 font-mono text-xs ${isSelected ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}>
                              {formatOdds(option.americanOdds)}
                            </div>
                            {isSelected ? (
                              <div className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}

          {/* Selected pick summary + note + save */}
          {selectedOption ? (
            <div className="space-y-3 rounded-[24px] border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                  Your lock
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/4 px-3.5 py-2.5">
                <div className="text-sm font-semibold text-white">
                  {getPickLabel(selectedOption.option)}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {selectedOption.game.matchup}{" "}
                  <span className="font-mono">{formatOdds(selectedOption.option.americanOdds)}</span>
                </div>
              </div>
              <Input
                name="note"
                type="text"
                maxLength={140}
                placeholder="Why this lock? Reasoning, trash talk… 140 chars"
                defaultValue={currentNote ?? ""}
              />
              <Button type="submit" className="w-full" disabled={pending || !selectedId}>
                {pending ? "Saving…" : "Save lock"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[24px] border border-dashed border-white/10 bg-black/10 p-4 text-center text-sm text-[var(--muted-foreground)]">
                Tap a spread above to set your Lock of the Day
              </div>
              <input type="hidden" name="note" value={currentNote ?? ""} />
            </div>
          )}
        </div>
      )}
    </ActionForm>
  );
}
