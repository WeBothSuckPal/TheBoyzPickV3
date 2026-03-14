import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BarChart3,
  Layers,
  Lock,
  Radio,
  Shield,
  Target,
  Trophy,
  Zap,
} from "lucide-react";

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

const features = [
  {
    icon: Target,
    title: "Three Markets",
    description: "Spreads, moneylines, and over/unders on every game.",
  },
  {
    icon: Layers,
    title: "Up to 10-Leg Parlays",
    description: "Stack your picks for bigger multipliers.",
  },
  {
    icon: Lock,
    title: "Lock of the Day",
    description: "Submit your signature pick each week with commentary.",
  },
  {
    icon: BarChart3,
    title: "Live Leaderboards",
    description: "Track performance, streaks, and weekly rivalries.",
  },
  {
    icon: Shield,
    title: "Commissioner Controls",
    description: "Approve members, manage the club, keep it fair.",
  },
  {
    icon: Zap,
    title: "Auto Settlement",
    description: "Bets settle automatically as games finish. No manual work.",
  },
];

export default async function Home() {
  const viewer = await getOptionalViewer();
  const mode = getAppMode();

  const [{ leaderboards }, weekLocks, activity] = await Promise.all([
    getPublicLeaderboards(),
    getPublicWeekLocks(),
    getPublicFeed(),
  ]);

  const topLeaderboard = leaderboards.slice(0, 5);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-16 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Section 1: Hero ── */}
      <section className="animate-[border-glow_4s_ease-in-out_infinite] rounded-[36px] border border-[var(--accent)]/15 bg-[var(--panel-strong)] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.3)] lg:p-16">
        {/* Logo */}
        <div className="mx-auto mb-6 w-48 sm:w-56 lg:w-64">
          <Image
            src="/theboyzpick-logo.png"
            alt="TheBoyzPick"
            width={256}
            height={256}
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
          A private picks club for you and the boyz. Compete head-to-head all
          season long. Members only&nbsp;&mdash;&nbsp;apply to join.
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

      {/* ── Section 2: Tagline / Identity ── */}
      <section className="text-center">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Built by the Boyz, for the Boyz.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-[var(--muted-foreground)]">
          Private. Competitive. Every pick counts.
        </p>
      </section>

      {/* ── Section 3: Features Grid ── */}
      <section>
        <div className="mb-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Everything You Need
          </h2>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Built for serious picks, not casual scrolling.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-white/10 bg-black/18 px-5 py-4"
            >
              <div className="mb-2 flex items-center gap-3">
                <feature.icon className="size-5 text-[var(--accent)]" />
                <span className="font-semibold text-white">
                  {feature.title}
                </span>
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Section 4: Club Activity (sanitized) ── */}
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
          {/* Column 1 — This Week's Locks (sanitized: name + result only) */}
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
                    <div className="text-sm font-semibold text-white">
                      {entry.displayName}
                    </div>
                    <Badge
                      className={
                        entry.result === "win"
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : entry.result === "loss"
                            ? "border-red-500/30 bg-red-500/10 text-red-400"
                            : entry.result === "push" ||
                                entry.result === "void"
                              ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                              : undefined
                      }
                    >
                      {entry.result}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Column 2 — Live Feed (sanitized: generic messages only) */}
          <Card className="overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--accent-brand)] opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-[var(--accent-brand)]" />
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

          {/* Column 3 — Standings (no bankroll, just rank/name/record/ROI) */}
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
