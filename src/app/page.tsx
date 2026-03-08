import Link from "next/link";
import { ArrowRight, Shield, Trophy, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appName } from "@/lib/constants";
import { getOptionalViewer } from "@/lib/auth";
import { getAppMode, isClerkConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

function resolveSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-8 rounded-[36px] border border-white/10 bg-[var(--panel-strong)] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.3)] lg:grid-cols-[1.3fr_0.7fr] lg:p-12">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[var(--accent)]/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--accent)]">
              {appName}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              {mode === "live" ? "Production mode" : "Demo mode"}
            </span>
          </div>
          <h1 className="max-w-3xl font-[family-name:var(--font-display)] text-5xl font-semibold tracking-tight text-white sm:text-6xl">
            A private sportsbook-style club for you and the boyz.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">
            Daily spreads, locked slips, wallet bragging rights, Lock of the Day, and
            commissioner control in one invite-only home base.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href={viewer ? "/today" : "/sign-in"}>
                {viewer ? "Enter Clubhouse" : "Sign in"}
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/leaderboards">Preview leaderboards</Link>
            </Button>
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {isClerkConfigured()
              ? "Access is restricted to invited users. Manage invitations from Clerk."
              : "Clerk is not configured yet, so the app is running with a seeded demo commissioner account."}
          </p>
          {setupStatus === "incomplete" ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Production setup is incomplete. Add all required environment variables before using protected routes.
            </div>
          ) : null}
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Tonight&apos;s atmosphere</CardTitle>
            <CardDescription>
              Sharp lines, rivalry boards, and a commissioner dashboard that keeps the
              club moving.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              "Straight bets and four-leg parlays",
              "One Lock of the Day per member",
              "Manual bankroll approvals with full ledger history",
              "Admin sync and settlement controls",
            ].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-[var(--foreground)]"
              >
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          {
            icon: Shield,
            title: "Invite-only access",
            description:
              "Private club with role-based access and a commissioner-owned control panel.",
          },
          {
            icon: Wallet,
            title: "Club-credit bankrolls",
            description:
              "Members request top-ups in app, while the commissioner approves and credits balances.",
          },
          {
            icon: Trophy,
            title: "Rivalries that matter",
            description:
              "Track bankroll, ROI, streaks, and lock-pick bragging rights every week.",
          },
        ].map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <feature.icon className="size-5 text-[var(--accent)]" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
