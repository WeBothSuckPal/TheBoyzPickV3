import { placeSlipAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireViewer } from "@/lib/auth";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { formatCompactDate, formatCurrency, formatOdds, formatSpread } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SlipsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);
  const now = new Date();
  const selectionOptions = snapshot.games
    .filter((game) => game.status === "scheduled" && new Date(game.commenceTime) > now)
    .flatMap((game) =>
      game.options.map((option) => ({
        value: option.id,
        label: `${game.league} | ${option.team} ${formatSpread(option.spread)} (${formatOdds(option.americanOdds)})`,
      })),
    );

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Build slip</CardTitle>
          <CardDescription>
            Straight bets or parlays up to four legs. One side per game.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          ) : null}
          <form action={placeSlipAction} className="space-y-4">
            {[1, 2, 3, 4].map((index) => (
              <select
                key={index}
                name={
                  index === 1
                    ? "selectionOne"
                    : index === 2
                      ? "selectionTwo"
                      : index === 3
                        ? "selectionThree"
                        : "selectionFour"
                }
                className="h-11 w-full rounded-2xl border border-white/12 bg-black/15 px-4 text-sm text-white outline-none"
                defaultValue=""
              >
                <option value="">{index === 1 ? "Required selection" : "Optional leg"}</option>
                {selectionOptions.map((option) => (
                  <option key={`${index}_${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ))}

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input name="stake" type="number" min={5} max={200} placeholder="Stake in dollars" />
              <Button type="submit">Place slip</Button>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              Limits: ${snapshot.settings.minStakeCents / 100} to ${snapshot.settings.maxStakeCents / 100}.
            </p>
          </form>
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
