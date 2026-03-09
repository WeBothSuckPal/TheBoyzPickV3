import { saveLockPickAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireViewer } from "@/lib/auth";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { formatGameTime, formatOdds, formatSpread } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s board</CardTitle>
          <CardDescription>
            Spread-only card from the configured primary bookmaker. Bets lock at event start.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {snapshot.games.map((game) => (
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
                <Badge>{game.status}</Badge>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {game.options.map((option) => (
                  <div
                    key={option.id}
                    className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3"
                  >
                    <div className="text-sm font-semibold text-white">{option.team}</div>
                    <div className="mt-1 font-mono text-sm text-[var(--muted-foreground)]">
                      {formatSpread(option.spread)} | {formatOdds(option.americanOdds)}
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
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Lock of the Day</CardTitle>
            <CardDescription>
              One signature spread pick per week for the separate bragging-rights board.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {snapshot.lockPick ? (
              <div className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                  Current lock
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {snapshot.lockPick.selectionTeam}
                </div>
                <div className="font-mono text-sm text-[var(--muted-foreground)]">
                  {formatSpread(snapshot.lockPick.spread)} |{" "}
                  {formatOdds(snapshot.lockPick.americanOdds)}
                </div>
                {snapshot.lockPick.note ? (
                  <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                    &ldquo;{snapshot.lockPick.note}&rdquo;
                  </div>
                ) : null}
              </div>
            ) : null}

            <form action={saveLockPickAction} className="space-y-3">
              <select
                name="selectionId"
                className="h-11 w-full rounded-2xl border border-white/12 bg-black/15 px-4 text-sm text-white outline-none"
                defaultValue={snapshot.lockPick?.selectionId ?? ""}
              >
                <option value="">Select a spread</option>
                {snapshot.games.flatMap((game) =>
                  game.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {game.league} | {option.team} {formatSpread(option.spread)} (
                      {formatOdds(option.americanOdds)})
                    </option>
                  )),
                )}
              </select>
              <Input
                name="note"
                type="text"
                maxLength={140}
                placeholder="Your reasoning… 140 chars max"
                defaultValue={snapshot.lockPick?.note ?? ""}
              />
              <Button type="submit" className="w-full">
                Save lock
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This Week&apos;s Locks</CardTitle>
            <CardDescription>Every member&apos;s pick for the current week.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.weekLockFeed.length === 0 ? (
              <div className="text-sm text-[var(--muted-foreground)]">
                No locks submitted yet this week.
              </div>
            ) : (
              snapshot.weekLockFeed.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                        {entry.displayName}
                      </div>
                      <div className="mt-1 font-semibold text-white">{entry.selectionTeam}</div>
                      <div className="font-mono text-sm text-[var(--muted-foreground)]">
                        {formatSpread(entry.spread)} | {formatOdds(entry.americanOdds)}
                      </div>
                      {entry.note ? (
                        <div className="mt-1 text-xs italic text-[var(--muted-foreground)]">
                          &ldquo;{entry.note}&rdquo;
                        </div>
                      ) : null}
                    </div>
                    <Badge
                      className={
                        entry.result === "win"
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : entry.result === "loss"
                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : entry.result === "push" || entry.result === "void"
                              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                              : undefined
                      }
                    >
                      {entry.result}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feed</CardTitle>
            <CardDescription>What the club has been up to lately.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.activity.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
              >
                <div className="text-sm text-white">{item.message}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
