import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { formatCompactDate, formatCurrency, formatOdds, formatSpread } from "@/lib/utils";
import { SlipBuilder } from "./slip-builder";

export const dynamic = "force-dynamic";

export default async function SlipsPage() {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);
  const now = new Date();
  const availableGames = snapshot.games
    .filter((game) => game.status === "scheduled" && new Date(game.commenceTime) > now)
    .map((game) => ({
      id: game.id,
      league: game.league,
      matchup: game.matchup,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      commenceTime: game.commenceTime,
      options: game.options.map((option) => ({
        id: option.id,
        team: option.team,
        side: option.side,
        spread: option.spread,
        americanOdds: option.americanOdds,
        market: option.market,
      })),
    }));

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Build slip</CardTitle>
          <CardDescription>
            Tap a spread to add it to your slip. One side per game, up to four legs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SlipBuilder
            games={availableGames}
            walletBalanceCents={snapshot.wallet.balanceCents}
            minStakeCents={snapshot.settings.minStakeCents}
            maxStakeCents={snapshot.settings.maxStakeCents}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>My slips</CardTitle>
          <CardDescription>
            Open, settled, graded, and refunded slips are all tracked here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {snapshot.slips.map((slip) => (
            <div
              key={slip.id}
              className="rounded-[28px] border border-white/10 bg-black/18 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">
                    {slip.type === "straight" ? "Straight" : `${slip.legs.length}-leg parlay`}
                  </div>
                  <div className="text-sm text-[var(--muted-foreground)]">
                    {formatCompactDate(slip.createdAt)}
                  </div>
                </div>
                <Badge>{slip.status}</Badge>
              </div>
              <div className="mt-4 space-y-2">
                {slip.legs.map((leg) => (
                  <div
                    key={leg.id}
                    className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-white">{leg.selectionTeam}</div>
                      <div className="font-mono text-[var(--muted-foreground)]">
                        {formatSpread(leg.spread)} | {formatOdds(leg.americanOdds)}
                      </div>
                    </div>
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      {leg.result}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Stake
                  </div>
                  <div className="mt-1 font-semibold text-white">
                    {formatCurrency(slip.stakeCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    To win
                  </div>
                  <div className="mt-1 font-semibold text-white">
                    {formatCurrency(slip.potentialPayoutCents)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                    Settled
                  </div>
                  <div className="mt-1 font-semibold text-white">
                    {formatCurrency(slip.payoutCents)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
