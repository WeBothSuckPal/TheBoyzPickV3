import type {
  BetLegResult,
  BetLegView,
  BetSlipStatus,
  BetSlipType,
  GameCard,
  SelectionSide,
} from "@/lib/types";

function roundCents(value: number) {
  return Math.round(value);
}

export function americanToDecimal(americanOdds: number) {
  if (americanOdds > 0) {
    return 1 + americanOdds / 100;
  }

  return 1 + 100 / Math.abs(americanOdds);
}

export function calculateStraightPayout(stakeCents: number, americanOdds: number) {
  return roundCents(stakeCents * americanToDecimal(americanOdds));
}

export function calculateParlayPayout(stakeCents: number, americanOddsList: number[]) {
  const multiplier = americanOddsList.reduce(
    (total, americanOdds) => total * americanToDecimal(americanOdds),
    1,
  );

  return roundCents(stakeCents * multiplier);
}

export function scoreSpreadLeg(
  game: Pick<GameCard, "homeScore" | "awayScore">,
  selectionSide: SelectionSide,
  spread: number,
): BetLegResult {
  if (typeof game.homeScore !== "number" || typeof game.awayScore !== "number") {
    return "pending";
  }

  const selectedScore =
    selectionSide === "home" ? game.homeScore + spread : game.awayScore + spread;
  const opponentScore =
    selectionSide === "home" ? game.awayScore : game.homeScore;

  if (selectedScore > opponentScore) {
    return "win";
  }

  if (selectedScore < opponentScore) {
    return "loss";
  }

  return "push";
}

export function settleSlip(
  type: BetSlipType,
  stakeCents: number,
  legs: BetLegView[],
): { status: BetSlipStatus; payoutCents: number; legs: BetLegView[] } {
  const complete = legs.every((leg) => leg.result !== "pending");
  if (!complete) {
    return { status: "open", payoutCents: 0, legs };
  }

  if (type === "straight") {
    const leg = legs[0];

    if (!leg || leg.result === "void") {
      return { status: "void", payoutCents: stakeCents, legs };
    }

    if (leg.result === "push") {
      return { status: "push", payoutCents: stakeCents, legs };
    }

    if (leg.result === "win") {
      return {
        status: "won",
        payoutCents: calculateStraightPayout(stakeCents, leg.americanOdds),
        legs,
      };
    }

    return { status: "lost", payoutCents: 0, legs };
  }

  const losses = legs.filter((leg) => leg.result === "loss");
  if (losses.length > 0) {
    return { status: "lost", payoutCents: 0, legs };
  }

  const wins = legs.filter((leg) => leg.result === "win");
  const voids = legs.filter((leg) => leg.result === "void");
  const pushes = legs.filter((leg) => leg.result === "push");

  if (voids.length === legs.length) {
    return { status: "void", payoutCents: stakeCents, legs };
  }

  if (wins.length === 0) {
    return {
      status: pushes.length > 0 ? "push" : "void",
      payoutCents: stakeCents,
      legs,
    };
  }

  return {
    status: "won",
    payoutCents: calculateParlayPayout(
      stakeCents,
      wins.map((leg) => leg.americanOdds),
    ),
    legs,
  };
}
