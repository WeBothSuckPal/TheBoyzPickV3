import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth";
import { getClubStats } from "@/lib/clubhouse";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  await requireViewer();
  const stats = await getClubStats();

  const maxTeamCount = stats.teamPopularity[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Hero stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Wagered" value={formatCurrency(stats.totalWageredCents)} />
        <StatCard label="Total Returned" value={formatCurrency(stats.totalReturnedCents)} />
        <StatCard
          label="Biggest Win"
          value={formatCurrency(stats.biggestSingleWinCents)}
          sub={stats.biggestWinnerDisplayName !== "N/A" ? `by ${stats.biggestWinnerDisplayName}` : undefined}
        />
        <StatCard
          label="Parlay Hit Rate"
          value={`${stats.parlayHitRatePercent}%`}
          sub={`${stats.parlaysWon} of ${stats.totalParlays} parlays`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Team popularity */}
        <Card>
          <CardHeader>
            <CardTitle>Most Popular Teams</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.teamPopularity.length === 0 ? (
              <p className="text-center text-sm text-[var(--muted-foreground)]">
                No picks placed yet.
              </p>
            ) : null}
            {stats.teamPopularity.map((item) => (
              <div key={item.team} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white">{item.team}</span>
                  <span className="font-mono text-xs text-[var(--muted-foreground)]">
                    {item.count} pick{item.count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded-full bg-white/6">
                  <div
                    className="flex h-full items-center rounded-full bg-[var(--accent)]/60 px-2 text-[10px] font-semibold text-white transition-all duration-500"
                    style={{ width: `${Math.max((item.count / maxTeamCount) * 100, 8)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* League win rates */}
        <Card>
          <CardHeader>
            <CardTitle>Win Rate by League</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.leagueWinRates.length === 0 ? (
              <p className="text-center text-sm text-[var(--muted-foreground)]">
                No settled picks yet.
              </p>
            ) : null}
            {stats.leagueWinRates.map((item) => (
              <div key={item.league} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white">{item.league}</span>
                  <span className="font-mono text-xs text-[var(--muted-foreground)]">
                    {item.wins}W / {item.total} total ({item.percent}%)
                  </span>
                </div>
                <div className="h-6 w-full overflow-hidden rounded-full bg-white/6">
                  <div className="flex h-full">
                    <div
                      className="flex h-full items-center rounded-l-full bg-green-500/50 transition-all duration-500"
                      style={{ width: `${Math.max(item.percent, 4)}%` }}
                    />
                    <div
                      className="flex h-full items-center rounded-r-full bg-red-500/30 transition-all duration-500"
                      style={{ width: `${Math.max(100 - item.percent, 4)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Club overview */}
      <Card>
        <CardHeader>
          <CardTitle>Club Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-center">
              <div className="text-3xl font-bold text-white">{stats.totalSlips}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Total Slips</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-center">
              <div className="text-3xl font-bold text-white">{stats.totalParlays}</div>
              <div className="mt-1 text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Total Parlays</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/18 p-4 text-center">
              <div className="text-3xl font-bold text-white">
                {stats.totalWageredCents > 0
                  ? `${Math.round(((stats.totalReturnedCents - stats.totalWageredCents) / stats.totalWageredCents) * 100)}%`
                  : "0%"}
              </div>
              <div className="mt-1 text-xs uppercase tracking-widest text-[var(--muted-foreground)]">Club ROI</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
          {label}
        </div>
        <div className="mt-2 rounded-2xl bg-[var(--accent)]/10 px-4 py-3">
          <div className="text-2xl font-bold text-white">{value}</div>
          {sub ? (
            <div className="mt-0.5 text-xs text-[var(--muted-foreground)]">{sub}</div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
