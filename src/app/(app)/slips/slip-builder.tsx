"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { placeSlipAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IdempotencyField } from "@/components/ui/idempotency-field";
import { Input } from "@/components/ui/input";
import { americanToDecimal, calculateStraightPayout, calculateParlayPayout } from "@/lib/betting";
import { formatCurrency, formatOdds, formatSpread, formatGameTime } from "@/lib/utils";
import { OddsDeltaBadge } from "@/components/odds-delta-badge";

interface GameOption {
  id: string;
  team: string;
  side: string;
  spread: number;
  americanOdds: number;
  market: string;
  openingPoint?: number;
  openingAmericanOdds?: number;
}

interface SlipBuilderGame {
  id: string;
  league: string;
  matchup: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  options: GameOption[];
}

const QUICK_STAKES = [5, 10, 25, 50] as const;

function getPickLabel(option: GameOption): string {
  if (option.market === "h2h") return `${option.team} ML`;
  if (option.market === "totals")
    return `${option.team} ${option.spread > 0 ? "O" : "U"} ${Math.abs(option.spread)}`;
  return `${option.team} ${formatSpread(option.spread)}`;
}

/** Returns the raw decimal multiplier for the combined odds (no stake needed). */
function computeMultiplier(options: { option: GameOption }[], isParlay: boolean): number {
  if (options.length === 0) return 0;
  if (!isParlay) return americanToDecimal(options[0]!.option.americanOdds);
  return options.reduce((acc, { option }) => acc * americanToDecimal(option.americanOdds), 1);
}

function PayoutTierBadge({ multiplier }: { multiplier: number }) {
  if (multiplier <= 0) return null;
  const label = `${multiplier.toFixed(2)}×`;
  if (multiplier >= 6) {
    return (
      <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-400">
        {label}
      </span>
    );
  }
  if (multiplier >= 3) {
    return (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-400">
        {label}
      </span>
    );
  }
  return (
    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
      {label}
    </span>
  );
}

export function SlipBuilder({
  games,
  walletBalanceCents,
  minStakeCents,
  maxStakeCents,
  initialSelectionIds = [],
}: {
  games: SlipBuilderGame[];
  walletBalanceCents: number;
  minStakeCents: number;
  maxStakeCents: number;
  initialSelectionIds?: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectionIds));
  const [stakeDollars, setStakeDollars] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  // Group games by league
  const gamesByLeague = useMemo(() => {
    const grouped = new Map<string, SlipBuilderGame[]>();
    for (const game of games) {
      const existing = grouped.get(game.league) ?? [];
      existing.push(game);
      grouped.set(game.league, existing);
    }
    return grouped;
  }, [games]);

  // Build a lookup from option ID to its option + game
  const optionLookup = useMemo(() => {
    const map = new Map<string, { option: GameOption; game: SlipBuilderGame }>();
    for (const game of games) {
      for (const option of game.options) {
        map.set(option.id, { option, game });
      }
    }
    return map;
  }, [games]);

  // Get selected options in order
  const selectedOptions = useMemo(() => {
    return Array.from(selectedIds)
      .map((id) => optionLookup.get(id))
      .filter((entry): entry is { option: GameOption; game: SlipBuilderGame } => entry !== undefined);
  }, [selectedIds, optionLookup]);

  // Payout calculations
  const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
  const isParlay = selectedOptions.length > 1;
  const slipType = selectedOptions.length === 0 ? null : isParlay ? "parlay" : "straight";

  const multiplier = useMemo(
    () => computeMultiplier(selectedOptions, isParlay),
    [selectedOptions, isParlay],
  );

  const potentialPayout = useMemo(() => {
    if (selectedOptions.length === 0 || stakeCents <= 0) return 0;
    const odds = selectedOptions.map((e) => e.option.americanOdds);
    return isParlay
      ? calculateParlayPayout(stakeCents, odds)
      : calculateStraightPayout(stakeCents, odds[0]!);
  }, [selectedOptions, stakeCents, isParlay]);

  const balanceAfter = walletBalanceCents - stakeCents;
  const canPlace =
    selectedOptions.length > 0 &&
    selectedOptions.length <= 4 &&
    stakeCents >= minStakeCents &&
    stakeCents <= maxStakeCents &&
    balanceAfter >= 0;

  function toggleOption(optionId: string, gameId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(optionId)) {
        next.delete(optionId);
        return next;
      }

      // Remove only same-market selections from this game (prevents both sides
      // of a spread or both O/U, but allows spread + total SGP combos).
      const game = games.find((g) => g.id === gameId);
      const newOption = game?.options.find((o) => o.id === optionId);
      if (game && newOption) {
        for (const opt of game.options) {
          if (opt.market === newOption.market) {
            next.delete(opt.id);
          }
        }
      }

      if (next.size >= 4) return prev;

      next.add(optionId);
      return next;
    });
  }

  function removeSelection(optionId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(optionId);
      return next;
    });
  }

  return (
    <>
      <ActionForm action={placeSlipAction}>
        {(pending) => (
          <div className="space-y-5">
            <IdempotencyField />

            {/* Hidden inputs for form submission */}
            <input type="hidden" name="selectionIds" value={JSON.stringify(Array.from(selectedIds))} />

            {/* Game board */}
            {games.length === 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-black/18 p-6 text-center text-sm text-[var(--muted-foreground)]">
                No games available right now. Check back later.
              </div>
            ) : (
              Array.from(gamesByLeague.entries()).map(([league, leagueGames]) => (
                <div key={league} className="space-y-3">
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
                      className="rounded-[24px] border border-white/10 bg-black/18 p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white">{game.matchup}</div>
                        <div className="shrink-0 text-xs text-[var(--muted-foreground)]">
                          {formatGameTime(game.commenceTime)}
                        </div>
                      </div>

                      {/* Group options by market: Spread | Moneyline | Total */}
                      {(["spreads", "h2h", "totals"] as const).map((market) => {
                        const MARKET_LABELS = { spreads: "Spread", h2h: "Moneyline", totals: "Total" };
                        const marketOptions = game.options.filter((o) => o.market === market);
                        if (marketOptions.length === 0) return null;

                        return (
                          <div key={market} className="space-y-1.5">
                            {/* Market label — only shown when game has 2+ markets */}
                            {game.options.some((o) => o.market !== market) && (
                              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                                {MARKET_LABELS[market]}
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                              {marketOptions.map((option) => {
                                const isSelected = selectedIds.has(option.id);

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => toggleOption(option.id, game.id)}
                                    aria-pressed={isSelected}
                                    aria-label={`Select ${getPickLabel(option)} at ${formatOdds(option.americanOdds)}`}
                                    className={`relative rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                                      isSelected
                                        ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 shadow-[0_0_20px_rgba(204,41,54,0.15)]"
                                        : "border-white/8 bg-white/4 hover:border-white/20 hover:bg-white/8"
                                    }`}
                                  >
                                    <div className={`text-sm font-semibold ${isSelected ? "text-white" : "text-white/80"}`}>
                                      {getPickLabel(option)}
                                    </div>
                                    <div className={`mt-0.5 flex items-center gap-1 font-mono text-xs ${isSelected ? "text-[var(--accent)]" : "text-[var(--muted-foreground)]"}`}>
                                      <span>{formatOdds(option.americanOdds)}</span>
                                      <OddsDeltaBadge current={option.americanOdds} opening={option.openingAmericanOdds} />
                                    </div>
                                    {isSelected ? (
                                      <div className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-[var(--accent)] text-white">
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
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))
            )}

            {/* Slip summary panel */}
            {selectedOptions.length > 0 ? (
              <div className="rounded-[28px] border border-[var(--accent)]/25 bg-[var(--accent)]/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                    Your slip ({selectedOptions.length} {selectedOptions.length === 1 ? "leg" : "legs"})
                  </div>
                  <div className="flex items-center gap-2">
                    <PayoutTierBadge multiplier={multiplier} />
                    {slipType ? (
                      <div className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
                        {slipType === "parlay" ? `${selectedOptions.length}-leg parlay` : "Straight"}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedOptions.map(({ option, game }) => (
                    <div
                      key={option.id}
                      className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/4 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{getPickLabel(option)}</div>
                        <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                          <span>{game.matchup}</span>
                          <span className="font-mono">{formatOdds(option.americanOdds)}</span>
                          <OddsDeltaBadge current={option.americanOdds} opening={option.openingAmericanOdds} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelection(option.id)}
                        className="ml-2 shrink-0 rounded-full p-1 text-[var(--muted-foreground)] transition hover:bg-white/10 hover:text-white"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/6 bg-white/4 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">To win</div>
                    <div className="mt-0.5 text-sm font-semibold text-emerald-400">
                      {stakeCents > 0 ? formatCurrency(potentialPayout) : "---"}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/4 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Balance</div>
                    <div className="mt-0.5 text-sm font-semibold text-white">
                      {formatCurrency(walletBalanceCents)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/6 bg-white/4 px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">After</div>
                    <div className={`mt-0.5 text-sm font-semibold ${balanceAfter >= 0 ? "text-white" : "text-red-400"}`}>
                      {stakeCents > 0 ? formatCurrency(balanceAfter) : "---"}
                    </div>
                  </div>
                </div>

                {/* Quick-stake chips */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_STAKES.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setStakeDollars(String(amount))}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        stakeDollars === String(amount)
                          ? "border-[var(--accent)]/40 bg-[var(--accent)]/15 text-white"
                          : "border-white/10 bg-white/5 text-[var(--muted-foreground)] hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    name="stake"
                    type="number"
                    min={minStakeCents / 100}
                    max={maxStakeCents / 100}
                    placeholder={`Stake ($${minStakeCents / 100}–$${maxStakeCents / 100})`}
                    value={stakeDollars}
                    onChange={(e) => setStakeDollars(e.target.value)}
                  />
                  <Button
                    type="button"
                    disabled={!canPlace || pending}
                    onClick={() => setReviewOpen(true)}
                  >
                    {pending ? "Placing…" : "Review & Place"}
                  </Button>
                </div>
              </div>
            ) : (
              /* Empty state — links to Today's board */
              <div className="rounded-[28px] border border-dashed border-white/10 bg-black/10 p-6 text-center">
                <div className="text-sm text-[var(--muted-foreground)]">
                  Tap a spread above to start building your slip
                </div>
                {games.length === 0 && (
                  <Link
                    href="/today"
                    className="mt-3 inline-block rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
                  >
                    View Today&apos;s Board →
                  </Link>
                )}
              </div>
            )}

            <button type="submit" id="slip-submit-btn" className="hidden" disabled={pending} />
          </div>
        )}
      </ActionForm>

      {/* Sticky bottom bar — shows when legs are selected */}
      {selectedOptions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[var(--panel)] px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.4)] sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <PayoutTierBadge multiplier={multiplier} />
              <div className="text-sm font-semibold text-white">
                {selectedOptions.length} {selectedOptions.length === 1 ? "Leg" : "Leg Parlay"}
              </div>
              {stakeCents > 0 && potentialPayout > 0 && (
                <div className="text-sm text-emerald-400">
                  → {formatCurrency(potentialPayout)}
                </div>
              )}
            </div>
            <Button
              type="button"
              disabled={!canPlace}
              onClick={() => setReviewOpen(true)}
              className="shrink-0"
            >
              Review & Place
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Confirm your slip"
        confirmLabel="Place slip"
        onConfirm={() => {
          const btn = document.getElementById("slip-submit-btn") as HTMLButtonElement;
          btn?.click();
        }}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            {selectedOptions.map(({ option, game }) => (
              <div
                key={option.id}
                className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm"
              >
                <div className="font-semibold text-white">{getPickLabel(option)}</div>
                <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                  <span>{game.matchup}</span>
                  <span className="font-mono">{formatOdds(option.americanOdds)}</span>
                  <OddsDeltaBadge current={option.americanOdds} opening={option.openingAmericanOdds} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">Stake</div>
              <div className="mt-0.5 text-sm font-semibold text-white">{formatCurrency(stakeCents)}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">To win</div>
              <div className="mt-0.5 text-sm font-semibold text-emerald-400">{formatCurrency(potentialPayout)}</div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">After</div>
              <div className="mt-0.5 text-sm font-semibold text-white">{formatCurrency(balanceAfter)}</div>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
