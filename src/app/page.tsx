import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Layers,
  Lock,
  Radio,
  Shield,
  Target,
  Trophy,
  TrendingUp,
  UserPlus,
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
import { formatCurrency, formatOdds, formatSpread } from "@/lib/utils";

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

const howItWorks = [
  {
    step: 1,
    icon: UserPlus,
    title: "Sign Up & Buy In",
    description:
      "Create an account, send the commissioner $50, and get $150 in betting credits.",
  },
  {
    step: 2,
    icon: Target,
    title: "Place Your Picks",
    description:
      "Bet spreads, moneylines, or over/unders on NFL and NCAAF games. Build parlays up to 10 legs.",
  },
  {
    step: 3,
    icon: Trophy,
    title: "Win the Pot",
    description:
      "The member with the most credits at the end of the season wins the entire real-money pot.",
  },
];

const features = [
  {
    icon: TrendingUp,
    title: "Three Markets",
    description: "Spreads, moneylines, and over/unders on every game.",
  },
  {
    icon: Layers,
    title: "Up to 10-Leg Parlays",
    description: "Stack your picks for massive payouts.",
  },
  {
    icon: Lock,
    title: "Lock of the Day",
    description: "Submit your signature pick each week with commentary.",
  },
  {
    icon: BarChart3,
    title: "Live Leaderboards",
    description: "Track bankroll, ROI, streaks, and weekly rivalries.",
  },
  {
    icon: Shield,
    title: "Commissioner Controls",
    description:
      "Approve members, manage wallets, settle bets, run the show.",
  },
  {
    icon: Zap,
    title: "Auto Settlement",
    description: "Bets settle automatically as games finish. No manual work.",
  },
];

const faq = [
  {
    q: "What sports are available?",
    a: "NFL and NCAAF football. We sync odds every 2 hours from DraftKings lines.",
  },
  {
    q: "How much does it cost?",
    a: "$50 real-money buy-in per season. You get $150 in betting credits to start.",
  },
  {
    q: "How do parlays work?",
    a: "Build slips with 1 to 10 picks. All legs must hit for the parlay to pay out. Odds multiply.",
  },
  {
    q: "Who runs this?",
    a: "A commissioner manages the club \u2014 approving members, settling disputes, and keeping things fair.",
  },
  {
    q: "How do I win?",
    a: "The member with the highest credit balance at the end of the season wins the entire real-money pot.",
  },
  {
    q: "Is this legal?",
    a: "This is a private social club among friends. No real-money wagering happens through the app \u2014 credits are tracked internally.",
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
          A private sportsbook-style club where you and the boyz bet spreads,
          moneylines, and over/unders on NFL&nbsp;+&nbsp;NCAAF. Buy in for $50,
          get $150 in credits, and compete all season. Winner takes the pot.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href={viewer ? "/today" : "/sign-in"}>
              {viewer ? "Enter Clubhouse" : "Get Started"}
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <a href="#how-it-works">See How It Works</a>
          </Button>
        </div>
        {!viewer && isClerkConfigured() ? (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">
            Sign up for an account — the commissioner approves access before you
            can play.
          </p>
        ) : null}
      </section>

      {/* ── Section 2: How It Works ── */}
      <section id="how-it-works" className="scroll-mt-8">
        <div className="mb-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Three steps to join the action.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {howItWorks.map((step) => (
            <Card key={step.step} className="relative overflow-hidden">
              <CardHeader>
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent)]/15 font-[family-name:var(--font-display)] text-xl font-bold text-[var(--accent)]">
                    {step.step}
                  </span>
                  <step.icon className="size-5 text-[var(--accent)]" />
                </div>
                <CardTitle>{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
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

      {/* ── Section 4: Live Data Wall ── */}
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
                Every member&apos;s signature pick for the week.
              </CardDescription>
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
                        <div className="mt-1 font-semibold text-white">
                          {entry.selectionTeam}
                        </div>
                        <div className="font-mono text-sm text-[var(--muted-foreground)]">
                          {formatSpread(entry.spread)} |{" "}
                          {formatOdds(entry.americanOdds)}
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
                              : entry.result === "push" ||
                                  entry.result === "void"
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
                        <div className="truncate font-semibold text-white">
                          {entry.displayName}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {entry.wins}-{entry.losses}-{entry.pushes} | ROI{" "}
                          {entry.roiPercent}%
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
        </div>
      </section>

      {/* ── Section 5: FAQ ── */}
      <section>
        <div className="mb-8 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Questions?
          </h2>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Everything you need to know before joining.
          </p>
        </div>
        <Card className="mx-auto max-w-3xl overflow-hidden">
          <CardContent className="divide-y divide-white/10 p-0">
            {faq.map((item, i) => (
              <div key={i} className="px-6 py-5">
                <h3 className="font-semibold text-white">{item.q}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted-foreground)]">
                  {item.a}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ── Section 6: Footer ── */}
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
          <Link
            href="/leaderboards"
            className="transition-colors hover:text-white"
          >
            Leaderboards
          </Link>
        </div>
        <p className="mt-6 text-xs text-[var(--muted-foreground)]/60">
          &copy; 2026 {appName}
        </p>
      </footer>
    </main>
  );
}
