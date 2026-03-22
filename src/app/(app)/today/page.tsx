import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactionBar } from "@/components/ui/reaction-bar";
import { requireViewer } from "@/lib/auth";
import { getMemberSnapshot, getReactionSummaries } from "@/lib/clubhouse";
import { formatOdds, formatSpread, relativeTime } from "@/lib/utils";
import { LeagueFilter } from "./league-filter";
import { LockPickForm } from "./lock-pick-form";

function buildAvailableGames(games: Awaited<ReturnType<typeof getMemberSnapshot>>["games"]) {
  const now = new Date();
  return games
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
}

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);
  const availableGames = buildAvailableGames(snapshot.games);

  // Fetch social data for lock picks
  const lockPickIds = snapshot.weekLockFeed.map((lp) => lp.id);
  const lockReactions = await getReactionSummaries(viewer.id, "lock_pick", lockPickIds);

  // Pass all games to the client filter (it handles status badges)
  const filterableGames = snapshot.games.map((game) => ({
    id: game.id,
    league: game.league,
    matchup: game.matchup,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    commenceTime: game.commenceTime,
    status: game.status,
    options: game.options.map((option) => ({
      id: option.id,
      team: option.team,
      side: option.side,
      spread: option.spread,
      americanOdds: option.americanOdds,
      market: option.market,
      openingPoint: option.openingPoint,
      openingAmericanOdds: option.openingAmericanOdds,
      intelligence: option.intelligence
        ? {
            confidenceBand: option.intelligence.confidenceBand,
            riskTags: option.intelligence.riskTags,
            blurb: option.intelligence.blurb,
          }
        : null,
    })),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      {/* ── Left column ─────────────────────────────────────── */}
      <div className="space-y-6">
        {/* Lock of the Day — hero position */}
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
                <div className="flex items-center gap-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                    Your lock this week
                  </div>
                  <svg
                    className="size-4 text-[var(--accent)]"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="mt-1 text-xl font-semibold text-white">
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
                <div className="mt-3 border-t border-[var(--accent)]/20 pt-3 text-xs text-[var(--muted-foreground)]">
                  Change your lock below if games are still available.
                </div>
              </div>
            ) : null}

            <LockPickForm
              games={availableGames}
              currentSelectionId={snapshot.lockPick?.selectionId}
              currentNote={snapshot.lockPick?.note}
            />
          </CardContent>
        </Card>

        {/* Today's board with league filter */}
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s board</CardTitle>
            <CardDescription>
              Spread-only card from the configured primary bookmaker. Bets lock at event start.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeagueFilter games={filterableGames} />
          </CardContent>
        </Card>
      </div>

      {/* ── Right column ────────────────────────────────────── */}
      <div className="space-y-6">
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
                  <div className="mt-3 border-t border-white/6 pt-2">
                    <ReactionBar
                      targetType="lock_pick"
                      targetId={entry.id}
                      reactions={lockReactions.get(entry.id) ?? []}
                    />
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm text-white">{item.message}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      {relativeTime(item.createdAt)}
                    </div>
                  </div>
                  {item.tailSelectionIds && item.tailSelectionIds.length > 0 ? (
                    <Link
                      href={`/slips?selections=${item.tailSelectionIds.join(",")}`}
                      className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                      Tail slip
                    </Link>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
