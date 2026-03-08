import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth";
import { getMemberSnapshot } from "@/lib/clubhouse";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage() {
  const viewer = await requireViewer();
  const snapshot = await getMemberSnapshot(viewer);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Main board</CardTitle>
          <CardDescription>
            Ranked by bankroll first, ROI second, then streak form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.leaderboards.map((entry, index) => (
            <div
              key={entry.userId}
              className="grid gap-4 rounded-[28px] border border-white/10 bg-black/18 p-4 md:grid-cols-[auto_1fr_auto]"
            >
              <div className="flex items-center justify-center text-2xl font-semibold text-[var(--accent)]">
                {index + 1}
              </div>
              <div>
                <div className="text-lg font-semibold text-white">{entry.displayName}</div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {entry.wins}-{entry.losses}-{entry.pushes} | ROI {entry.roiPercent}%
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <Badge>{formatCurrency(entry.bankrollCents)}</Badge>
                <Badge>Streak {entry.streak}</Badge>
                <Badge>Locks {entry.lockPoints}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weekly rivalry board</CardTitle>
          <CardDescription>
            Short-form flex table for this week&apos;s head-to-head banter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.rivalryBoard.map((entry) => (
            <div
              key={entry.displayName}
              className="grid gap-3 rounded-[28px] border border-white/10 bg-black/18 p-4 md:grid-cols-[1fr_auto_auto]"
            >
              <div className="text-lg font-semibold text-white">{entry.displayName}</div>
              <div className="text-sm text-[var(--muted-foreground)]">
                {entry.weeklyWins}-{entry.weeklyLosses}
              </div>
              <div className="text-sm font-semibold text-white">{entry.weeklyRoiPercent}% ROI</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
