"use client";

import { useState, useMemo } from "react";
import { placeSlipAction } from "@/app/actions";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IdempotencyField } from "@/components/ui/idempotency-field";
import { Input } from "@/components/ui/input";
import { calculateStraightPayout, calculateParlayPayout } from "@/lib/betting";
import { formatCurrency, formatOdds } from "@/lib/utils";

interface SelectionOption {
  value: string;
  label: string;
  americanOdds: number;
  gameId: string;
}

const LEG_NAMES = [
  "selectionOne",
  "selectionTwo",
  "selectionThree",
  "selectionFour",
  "selectionFive",
  "selectionSix",
  "selectionSeven",
  "selectionEight",
  "selectionNine",
  "selectionTen",
] as const;

export function SlipBuilder({
  selectionOptions,
  walletBalanceCents,
  minStakeCents,
  maxStakeCents,
}: {
  selectionOptions: SelectionOption[];
  walletBalanceCents: number;
  minStakeCents: number;
  maxStakeCents: number;
}) {
  const [selections, setSelections] = useState<string[]>(Array(10).fill(""));
  const [stakeDollars, setStakeDollars] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);

  const selectedOptions = useMemo(() => {
    return selections
      .filter(Boolean)
      .map((id) => selectionOptions.find((o) => o.value === id))
      .filter((o): o is SelectionOption => o !== undefined);
  }, [selections, selectionOptions]);

  const uniqueSelections = useMemo(() => {
    const seen = new Set<string>();
    return selectedOptions.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  }, [selectedOptions]);

  const stakeCents = Math.round((parseFloat(stakeDollars) || 0) * 100);
  const isParlay = uniqueSelections.length > 1;
  const slipType = uniqueSelections.length === 0 ? null : isParlay ? "parlay" : "straight";

  const potentialPayout = useMemo(() => {
    if (uniqueSelections.length === 0 || stakeCents <= 0) return 0;
    const odds = uniqueSelections.map((o) => o.americanOdds);
    return isParlay
      ? calculateParlayPayout(stakeCents, odds)
      : calculateStraightPayout(stakeCents, odds[0]!);
  }, [uniqueSelections, stakeCents, isParlay]);

  const balanceAfter = walletBalanceCents - stakeCents;
  const canPlace = uniqueSelections.length > 0 && stakeCents >= minStakeCents && stakeCents <= maxStakeCents && balanceAfter >= 0;

  return (
    <>
      <ActionForm action={placeSlipAction}>
        {(pending) => (
          <div className="space-y-4">
            <IdempotencyField />

            {LEG_NAMES.map((name, index) => (
              <select
                key={name}
                name={name}
                className="h-11 w-full rounded-2xl border border-white/12 bg-black/15 px-4 text-sm text-white outline-none"
                value={selections[index]}
                onChange={(e) => {
                  const next = [...selections];
                  next[index] = e.target.value;
                  setSelections(next);
                }}
              >
                <option value="">{index === 0 ? "Required selection" : "Optional leg"}</option>
                {selectionOptions.map((option) => (
                  <option key={`${name}_${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ))}

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                name="stake"
                type="number"
                min={minStakeCents / 100}
                max={maxStakeCents / 100}
                placeholder="Stake in dollars"
                value={stakeDollars}
                onChange={(e) => setStakeDollars(e.target.value)}
              />
              <Button
                type="button"
                disabled={!canPlace || pending}
                onClick={() => setReviewOpen(true)}
              >
                {pending ? "Placing…" : "Review slip"}
              </Button>
            </div>

            <p className="text-sm text-[var(--muted-foreground)]">
              Limits: ${minStakeCents / 100} to ${maxStakeCents / 100}.
            </p>

            {uniqueSelections.length > 0 ? (
              <div className="rounded-[28px] border border-white/10 bg-black/18 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Type
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {slipType === "parlay" ? `${uniqueSelections.length}-leg parlay` : "Straight"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      To win
                    </div>
                    <div className="mt-1 text-sm font-semibold text-white">
                      {stakeCents > 0 ? formatCurrency(potentialPayout) : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                      Balance after
                    </div>
                    <div className={`mt-1 text-sm font-semibold ${balanceAfter >= 0 ? "text-white" : "text-red-400"}`}>
                      {stakeCents > 0 ? formatCurrency(balanceAfter) : formatCurrency(walletBalanceCents)}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Hidden submit button triggered by confirm dialog */}
            <button type="submit" id="slip-submit-btn" className="hidden" disabled={pending} />
          </div>
        )}
      </ActionForm>

      <ConfirmDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        title="Confirm your slip"
        confirmLabel="Place slip"
        onConfirm={() => {
          const btn = document.getElementById("slip-submit-btn") as HTMLButtonElement;
          btn?.click();
        }}
      >
        <div className="space-y-3">
          <div className="space-y-2">
            {uniqueSelections.map((option) => (
              <div
                key={option.value}
                className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 text-sm"
              >
                <div className="font-semibold text-white">{option.label}</div>
                <div className="font-mono text-xs text-[var(--muted-foreground)]">
                  {formatOdds(option.americanOdds)}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                Stake
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {formatCurrency(stakeCents)}
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                To win
              </div>
              <div className="mt-0.5 text-sm font-semibold text-emerald-400">
                {formatCurrency(potentialPayout)}
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/6 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
                After
              </div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {formatCurrency(balanceAfter)}
              </div>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
