import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Lock, Radio, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { appName } from "@/lib/constants";
import { getOptionalViewer } from "@/lib/auth";
import {
  getPublicFeed,
  getPublicLeaderboards,
  getPublicStats,
  getPublicWeekLocks,
} from "@/lib/clubhouse";
import { getAppMode, isClerkConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSpread(spread: number): string {
  if (spread === 0) return "PK";
  return spread > 0 ? `+${spread}` : `${spread}`;
}

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function gameCountdown(commenceTime: string | undefined): string | null {
  if (!commenceTime) return null;
  const diff = new Date(commenceTime).getTime() - Date.now();
  if (diff <= 0) return "Game in progress";
  const totalMins = Math.floor(diff / 60_000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `Kicks off in ${days}d ${hours % 24}h`;
  }
  if (hours > 0) return `Kicks off in ${hours}h ${mins}m`;
  return `Kicks off in ${mins}m`;
}

export default async function Home() {
  const viewer = await getOptionalViewer();
  const mode = getAppMode();

  const [{ leaderboards }, weekLocks, activity, stats] = await Promise.all([
    getPublicLeaderboards(),
    getPublicWeekLocks(),
    getPublicFeed(),
    getPublicStats(),
  ]);

  const topLeaderboard = leaderboards.slice(0, 5);
  const spotlightLock = weekLocks[0] ?? null;

  const lockWinRate =
    stats.lockWins + stats.lockLosses > 0
      ? Math.round((stats.lockWins / (stats.lockWins + stats.lockLosses)) * 100)
      : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Section 1: Hero ── */}
      <section className="animate-[border-glow_4s_ease-in-out_infinite] rounded-[36px] border border-[var(--accent)]/15 bg-[var(--panel-strong)] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.3)] lg:p-16">
        {/* Logo */}
        <div className="mx-auto mb-8 w-[22rem] sm:w-[28rem] lg:w-[34rem]">
          <Image
            src="/theboyzpick-logo.png"
            alt="TheBoyzPick"
            width={544}
            height={544}
            className="mx-auto h-auto w-full"
            priority
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {appName}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            {mode === "live" ? "Live" : "Demo mode"}
          </span>
        </div>
        <h1 className="mx-auto mt-8 max-w-4xl font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
          Your crew. Your picks. Your season.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
          A private picks club. Real competition, real stakes, members only&nbsp;&mdash;&nbsp;apply to join.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href={viewer ? "/today" : "/sign-up"}>
              {viewer ? "Enter Clubhouse" : "Apply to Join"}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          {!viewer && isClerkConfigured() ? (
            <Button asChild size="lg" variant="secondary">
              <Link href="/sign-in">Member Login</Link>
            </Button>
          ) : null}
        </div>
      </section>

      {/* ── Section 2: Lock of the Day Spotlight ── */}
      <section className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-[var(--accent)]" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            Lock of the Week
          </span>
        </div>

        {spotlightLock ? (
          <div className="w-full max-w-lg rounded-[28px] border border-[var(--accent)]/30 bg-[var(--panel)] p-6 text-center shadow-[0_8px_40px_rgba(204,41,54,0.12)]">
            <div className="mb-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              {spotlightLock.displayName}&apos;s Lock
            </div>
            <div className="font-[family-name:var(--font-display)] text-3xl font-semibold text-white sm:text-4xl">
              {spotlightLock.selectionTeam}
            </div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <span className="font-[family-name:var(--font-mono)] text-xl font-bold text-[var(--accent)]">
                {formatSpread(spotlightLock.spread)}
              </span>
              <span className="text-[var(--muted-foreground)]">·</span>
              <span className="font-[family-name:var(--font-mono)] text-sm text-[var(--muted-foreground)]">
                {formatOdds(spotlightLock.americanOdds)}
              </span>
            </div>

            {spotlightLock.note && (
              <p className="mx-auto mt-3 max-w-xs text-sm italic text-[var(--muted-foreground)]">
                &ldquo;{spotlightLock.note}&rdquo;
              </p>
            )}

            <div className="mt-4 flex items-center justify-center gap-3">
              {spotlightLock.result === "win" ? (
                <Badge className="border-green-500/30 bg-green-500/10 px-4 py-1.5 text-sm text-green-400">
                  ✓ Won
                </Badge>
              ) : spotlightLock.result === "loss" ? (
                <Badge className="border-red-500/30 bg-red-500/10 px-4 py-1.5 text-sm text-red-400">
                  ✗ Lost
                </Badge>
              ) : spotlightLock.result === "push" || spotlightLock.result === "void" ? (
                <Badge className="border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm text-yellow-400">
                  Push
                </Badge>
              ) : (
                <Badge className="border-white/10 bg-white/5 px-4 py-1.5 text-sm text-[var(--muted-foreground)]">
                  {gameCountdown(spotlightLock.commenceTime) ?? "Pending"}
                </Badge>
              )}
            </div>
          </div>
        ) : (
          <div className="w-full max-w-lg rounded-[28px] border border-white/8 bg-[var(--panel)] p-8 text-center">
            <p className="text-[var(--muted-foreground)]">No lock posted yet this week.</p>
          </div>
        )}
      </section>

      {/* ── Section 3: Season Stats Bar ── */}
      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-5 py-5 text-center">
            <div className="font-[family-name:var(--font-mono)] text-3xl font-bold text-[var(--accent)]">
              {stats.lockWins}-{stats.lockLosses}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Lock Record
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-5 py-5 text-center">
            <div className="font-[family-name:var(--font-mono)] text-3xl font-bold text-[var(--accent)]">
              {lockWinRate !== null ? `${lockWinRate}%` : "—"}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Lock Win Rate
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-5 py-5 text-center">
            <div className="font-[family-name:var(--font-mono)] text-3xl font-bold text-[var(--accent)]">
              {stats.topRoiPercent > 0 ? `+${stats.topRoiPercent}%` : "—"}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Top Member ROI
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-[var(--panel)] px-5 py-5 text-center">
            <div className="font-[family-name:var(--font-mono)] text-3xl font-bold text-[var(--accent)]">
              {stats.memberCount}
            </div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
              Active Members
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 4: Club Activity ── */}
      <section>
        <div className="mb-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Live from the Clubhouse
          </h2>
          <p className="mt-2 text-[var(--muted-foreground)]">
            See what the crew has been up to this week.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Column 1 — This Week's Locks */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-[var(--accent)]" />
                <CardTitle>This Week&apos;s Locks</CardTitle>
              </div>
              <CardDescription>
                {weekLocks.length > 0
                  ? `${weekLocks.length} lock${weekLocks.length === 1 ? "" : "s"} submitted this week.`
                  : "No locks submitted yet this week."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {weekLocks.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                  Check back once the week kicks off.
                </div>
              ) : (
                weekLocks.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {entry.displayName}
                      </div>
                      <div className="mt-0.5 font-[family-name:var(--font-mono)] text-xs text-[var(--muted-foreground)]">
                        {entry.selectionTeam}&nbsp;
                        <span className="text-[var(--accent)]">{formatSpread(entry.spread)}</span>
                        &nbsp;·&nbsp;{formatOdds(entry.americanOdds)}
                      </div>
                    </div>
                    <Badge
                      className={
                        entry.result === "win"
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : entry.result === "loss"
                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : entry.result === "push" || entry.result === "void"
                              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                              : "border-white/10 bg-white/5 text-[var(--muted-foreground)]"
                      }
                    >
                      {entry.result}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Column 2 — Live Feed */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-[var(--accent)]" />
                </span>
                <Radio className="size-4 text-[var(--accent)]" />
                <CardTitle>Live Feed</CardTitle>
              </div>
              <CardDescription>
                What the club has been up to lately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activity.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                  No activity yet — check back soon.
                </div>
              ) : (
                activity.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
                  >
                    <div className="text-sm text-white">{item.message}</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      {timeAgo(item.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Column 3 — Standings */}
          <Card className="overflow-hidden md:col-span-2 lg:col-span-1">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-[var(--accent)]" />
                <CardTitle>Standings</CardTitle>
              </div>
              <CardDescription>Top members by performance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topLeaderboard.length === 0 ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                  No standings yet — season hasn&apos;t started.
                </div>
              ) : (
                topLeaderboard.map((entry, index) => (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-4 rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
                  >
                    <div className="text-lg font-semibold text-[var(--accent)]">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">
                        {entry.displayName}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {entry.wins}-{entry.losses}-{entry.pushes} | ROI{" "}
                        {entry.roiPercent}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Section 5: Footer ── */}
      <footer className="border-t border-white/10 pb-8 pt-8 text-center">
        <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
          {appName}
        </span>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          Built for the boyz.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--muted-foreground)]">
          {isClerkConfigured() ? (
            <>
              <Link
                href="/sign-in"
                className="transition-colors hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="transition-colors hover:text-white"
              >
                Sign Up
              </Link>
            </>
          ) : null}
        </div>
        <p className="mt-6 text-xs text-[var(--muted-foreground)]/60">
          &copy; 2026 {appName}
        </p>
      </footer>
    </main>
  );
}
