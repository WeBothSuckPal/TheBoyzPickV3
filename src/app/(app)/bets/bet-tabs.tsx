"use client";

import { useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CommentSection } from "@/components/ui/comment-section";
import { ReactionBar } from "@/components/ui/reaction-bar";
import type { BetSlipView, CommentView, ReactionSummary } from "@/lib/types";
import { cn, formatCompactDate, formatCurrency, formatOdds, formatSpread } from "@/lib/utils";

type Tab = "pending" | "settled" | "all";

type SocialSlip = BetSlipView & {
  reactions: ReactionSummary[];
  comments: CommentView[];
};

function statusClass(status: BetSlipView["status"]): string {
  if (status === "won") return "border-green-500/30 bg-green-500/10 text-green-400";
  if (status === "lost") return "border-red-500/30 bg-red-500/10 text-red-400";
  if (status === "push" || status === "void") {
    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  }
  return "border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]";
}

function legResultClass(result: string) {
  if (result === "win") return "text-green-400";
  if (result === "loss") return "text-red-400";
  return "text-[var(--muted-foreground)]";
}

function BetCard({
  slip,
  socialEnabled,
  viewerUserId,
}: {
  slip: SocialSlip;
  socialEnabled: boolean;
  viewerUserId: string;
}) {
  const isPending = slip.status === "open";

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/18 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-white">
            {slip.type === "straight" ? "Straight bet" : `${slip.legs.length}-leg parlay`}
          </div>
          <div className="text-sm text-[var(--muted-foreground)]">
            {formatCompactDate(slip.createdAt)}
            {slip.settledAt ? <span> · settled {formatCompactDate(slip.settledAt)}</span> : null}
          </div>
        </div>
        <Badge className={statusClass(slip.status)}>
          {slip.status === "open" ? "Pending" : slip.status}
        </Badge>
      </div>

      <div className="mt-4 space-y-2">
        {slip.legs.map((leg) => (
          <div
            key={leg.id}
            className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <div className="font-semibold text-white">{leg.selectionTeam}</div>
              <div className="font-mono text-xs text-[var(--muted-foreground)]">
                {formatSpread(leg.spread)} | {formatOdds(leg.americanOdds)}
              </div>
            </div>
            <div className={`shrink-0 text-xs uppercase tracking-[0.2em] ${legResultClass(leg.result)}`}>
              {leg.result}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            Stake
          </div>
          <div className="mt-1 font-semibold text-white">{formatCurrency(slip.stakeCents)}</div>
        </div>

        {isPending ? (
          <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              To win
            </div>
            <div className="mt-1 font-semibold text-emerald-400">
              {formatCurrency(slip.potentialPayoutCents)}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Payout
            </div>
            <div
              className={`mt-1 font-semibold ${
                slip.status === "won"
                  ? "text-emerald-400"
                  : slip.status === "lost"
                    ? "text-red-400"
                    : "text-white"
              }`}
            >
              {formatCurrency(slip.payoutCents)}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
            {isPending ? "Potential" : "Net"}
          </div>
          <div
            className={`mt-1 font-semibold ${
              isPending
                ? "text-white"
                : slip.status === "won"
                  ? "text-emerald-400"
                  : slip.status === "lost"
                    ? "text-red-400"
                    : "text-white"
            }`}
          >
            {isPending
              ? `+${formatCurrency(slip.potentialPayoutCents - slip.stakeCents)}`
              : slip.status === "won"
                ? `+${formatCurrency(slip.payoutCents - slip.stakeCents)}`
                : slip.status === "lost"
                  ? `-${formatCurrency(slip.stakeCents)}`
                  : formatCurrency(slip.payoutCents)}
          </div>
        </div>
      </div>

      {socialEnabled ? (
        <div className="mt-4 space-y-3 border-t border-white/6 pt-3">
          <ReactionBar targetType="slip" targetId={slip.id} reactions={slip.reactions} />
          <CommentSection
            targetType="slip"
            targetId={slip.id}
            comments={slip.comments}
            viewerUserId={viewerUserId}
          />
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 bg-black/10 p-8 text-center">
      <div className="text-sm text-[var(--muted-foreground)]">
        {tab === "pending"
          ? "No pending bets right now."
          : tab === "settled"
            ? "No settled bets yet."
            : "No bets placed yet."}
      </div>
      {(tab === "pending" || tab === "all") && (
        <Link
          href="/slips"
          className="mt-3 inline-block rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-4 py-1.5 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
        >
          Head to the slip builder →
        </Link>
      )}
    </div>
  );
}

export function BetTabs({
  slips,
  socialEnabled,
  viewerUserId,
}: {
  slips: SocialSlip[];
  socialEnabled: boolean;
  viewerUserId: string;
}) {
  const [tab, setTab] = useState<Tab>("pending");

  const pending = slips.filter((slip) => slip.status === "open");
  const settled = slips
    .filter((slip) => slip.status !== "open")
    .sort((left, right) =>
      (right.settledAt ?? right.createdAt).localeCompare(left.settledAt ?? left.createdAt),
    );
  const all = [...slips].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const visible = tab === "pending" ? pending : tab === "settled" ? settled : all;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: pending.length },
    { key: "settled", label: "Settled", count: settled.length },
    { key: "all", label: "All", count: all.length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition",
              tab === key
                ? "bg-[var(--panel)] text-white shadow"
                : "text-[var(--muted-foreground)] hover:text-white",
            )}
          >
            {label}
            {count > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  tab === key
                    ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                    : "bg-white/8 text-[var(--muted-foreground)]",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="space-y-4">
          {visible.map((slip) => (
            <BetCard
              key={slip.id}
              slip={slip}
              socialEnabled={socialEnabled}
              viewerUserId={viewerUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
