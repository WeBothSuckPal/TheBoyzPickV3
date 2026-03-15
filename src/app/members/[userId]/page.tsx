import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMemberProfile } from "@/lib/clubhouse";
import { formatCurrency, formatOdds, formatSpread } from "@/lib/utils";
import { ShareButton } from "./share-button";

export const dynamic = "force-dynamic";

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const profile = await getMemberProfile(userId);
  if (!profile) notFound();

  const joinDate = new Date(profile.joinedAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const initial = profile.displayName.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {/* Header */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-start">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/20 text-2xl font-bold text-[var(--accent)]">
            {initial}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-bold text-white">{profile.displayName}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">Member since {joinDate}</p>
          </div>
          <ShareButton />
        </CardContent>
      </Card>

      {/* Record */}
      <Card>
        <CardHeader>
          <CardTitle>Record</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="W-L-P" value={`${profile.record.wins}-${profile.record.losses}-${profile.record.pushes}`} />
            <StatBox label="ROI" value={`${profile.roiPercent}%`} />
            <StatBox label="Bankroll" value={formatCurrency(profile.bankrollCents)} />
            <StatBox label="Streak" value={String(profile.streak)} badge={profile.streak >= 3 ? `${"🔥".repeat(Math.min(profile.streak, 5))}` : undefined} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="Total Slips" value={String(profile.totalSlips)} />
            <StatBox label="Parlays" value={String(profile.totalParlays)} />
            <StatBox label="Lock Points" value={String(profile.lockPoints)} />
            {profile.bestParlayPayoutCents > 0 ? (
              <StatBox label="Best Parlay" value={formatCurrency(profile.bestParlayPayoutCents)} badge={`${profile.bestParlayLegCount}-leg`} />
            ) : (
              <StatBox label="Best Parlay" value="—" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lock of the Day History */}
      <Card>
        <CardHeader>
          <CardTitle>Lock of the Day History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profile.lockPickHistory.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted-foreground)]">
              No locks on record yet.
            </p>
          ) : null}
          {profile.lockPickHistory.map((pick, i) => (
            <div
              key={`${pick.weekKey}-${i}`}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/18 px-4 py-3"
            >
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">
                  {pick.selectionTeam} {formatSpread(pick.spread)}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  <span className="font-mono">{formatOdds(pick.americanOdds)}</span>
                  {" · "}Week {pick.weekKey}
                </div>
                {pick.note ? (
                  <div className="mt-1 text-xs italic text-[var(--muted-foreground)]">
                    &ldquo;{pick.note}&rdquo;
                  </div>
                ) : null}
              </div>
              <ResultBadge result={pick.result} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/18 p-3 text-center">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="mt-0.5 flex items-center justify-center gap-1.5">
        <span className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">{label}</span>
        {badge ? <span className="text-xs">{badge}</span> : null}
      </div>
    </div>
  );
}

function ResultBadge({ result }: { result: string }) {
  const styles: Record<string, string> = {
    win: "border-green-500/30 bg-green-500/10 text-green-400",
    loss: "border-red-500/30 bg-red-500/10 text-red-400",
    push: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    void: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    pending: "border-white/10 bg-white/5 text-[var(--muted-foreground)]",
  };

  return (
    <Badge className={styles[result] ?? styles.pending}>
      {result.toUpperCase()}
    </Badge>
  );
}
