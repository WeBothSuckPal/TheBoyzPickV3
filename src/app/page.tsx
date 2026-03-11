import Link from "next/link";
import { ArrowRight, Lock, Radio, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appName } from "@/lib/constants";
import { getOptionalViewer } from "@/lib/auth";
import { getPublicFeed, getPublicLeaderboards, getPublicWeekLocks } from "@/lib/clubhouse";
import { getAppMode, isClerkConfigured } from "@/lib/env";
import { formatCurrency, formatOdds, formatSpread } from "@/lib/utils";

export const dynamic = "force-dynamic";

function resolveSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

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

export default async function Home(props: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const setupStatus = resolveSearchParam(searchParams.setup);
  const viewer = await getOptionalViewer();
  const mode = getAppMode();

  const [{ leaderboards }, weekLocks, activity] = await Promise.all([
    getPublicLeaderboards(),
    getPublicWeekLocks(),
    getPublicFeed(),
  ]);

  const topLeaderboard = leaderboards.slice(0, 5);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Hero ── */}
      <section className="rounded-[36px] border border-white/10 bg-[var(--panel-strong)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)] lg:p-12">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
            {appName}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            {mode === "live" ? "Production mode" : "Demo mode"}
          </span>
        </div>
        <h1 className="mt-6 max-w-3xl font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
          A private sportsbook-style club for you and the boyz.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
          Spreads, moneylines, over/unders, ten-leg parlays, Lock&nbsp;of&nbsp;the&nbsp;Day, and
          commissioner control — all in one home base.
        </p>
        <div className="mt-6 flex flex-wrap gap-4">
          <Button asChild size="lg">
            <Link href={viewer ? "/today" : "/sign-in"}>
              {viewer ? "Enter Clubhouse" : "Sign in"}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          {!viewer && isClerkConfigured() ? (
            <Button asChild size="lg" variant="secondary">
              <Link href="/sign-up">Request access</Link>
            </Button>
          ) : null}
        </div>
        <p className="mt-4 text-sm text-[var(--muted-foreground)]">
          {isClerkConfigured()
            ? "Sign up for an account — the commissioner approves access before you can play."
            : "Clerk is not configured yet, so the app is running with a seeded demo commissioner account."}
        </p>
        {setupStatus === "incomplete" ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Production setup is incomplete. Add all required environment variables before using protected routes.
          </div>
        ) : null}
      </section>

      {/* ── Live Data Wall ── */}
      <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* Column 1 — This Week's Locks */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-[var(--accent)]" />
              <CardTitle>This Week&apos;s Locks</CardTitle>
            </div>
            <CardDescription>Every member&apos;s signature pick for the week.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {weekLocks.length === 0 ? (
              <div className="text-sm text-[var(--muted-foreground)]">
                No locks submitted yet this week.
              </div>
            ) : (
              weekLocks.map((entry) => (
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

        {/* Column 2 — Live Feed */}
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Radio className="size-4 text-[var(--accent)]" />
              <CardTitle>Live Feed</CardTitle>
            </div>
            <CardDescription>What the club has been up to lately.</CardDescription>
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
            <CardDescription>Top members by bankroll.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topLeaderboard.length === 0 ? (
              <div className="text-sm text-[var(--muted-foreground)]">
                No standings yet — season hasn&apos;t started.
              </div>
            ) : (
              <>
                {topLeaderboard.map((entry, index) => (
                  <div
                    key={entry.userId}
                    className="flex items-center gap-4 rounded-3xl border border-white/10 bg-black/18 px-4 py-3"
                  >
                    <div className="text-lg font-semibold text-[var(--accent)]">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-white">{entry.displayName}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {entry.wins}-{entry.losses}-{entry.pushes} | ROI {entry.roiPercent}%
                      </div>
                    </div>
                    <Badge>{formatCurrency(entry.bankrollCents)}</Badge>
                  </div>
                ))}
                <Link
                  href="/leaderboards"
                  className="mt-1 flex items-center gap-1 text-sm text-[var(--accent)] transition-colors hover:text-[var(--accent-strong)]"
                >
                  Full leaderboard
                  <ArrowRight className="size-3" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
