import { describe, expect, it } from "vitest";

import {
  americanToDecimal,
  calculateParlayPayout,
  calculateStraightPayout,
  scoreSpreadLeg,
  settleSlip,
} from "@/lib/betting";
import type { BetLegView } from "@/lib/types";

describe("betting utilities", () => {
  it("converts american odds to decimal", () => {
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 2);
    expect(americanToDecimal(150)).toBeCloseTo(2.5, 2);
  });

  it("calculates payouts for straight bets and parlays", () => {
    expect(calculateStraightPayout(2000, -110)).toBe(3818);
    expect(calculateParlayPayout(1000, [-110, 120])).toBeGreaterThan(4000);
  });

  it("grades spread legs correctly", () => {
    expect(scoreSpreadLeg({ homeScore: 110, awayScore: 100 }, "home", -4.5)).toBe("win");
    expect(scoreSpreadLeg({ homeScore: 110, awayScore: 106 }, "away", 4)).toBe("push");
    expect(scoreSpreadLeg({ homeScore: 99, awayScore: 110 }, "home", -3.5)).toBe("loss");
  });

  it("settles straight bets and parlays with pushes handled correctly", () => {
    const straightLeg: BetLegView[] = [
      {
        id: "leg_1",
        gameId: "game_1",
        selectionId: "game_1:home",
        selectionTeam: "Knicks",
        selectionSide: "home",
        spread: -3.5,
        americanOdds: -110,
        bookmaker: "draftkings",
        quoteTimestamp: new Date().toISOString(),
        result: "win",
      },
    ];

    const parlayLegs: BetLegView[] = [
      {
        ...straightLeg[0],
        id: "leg_2",
        gameId: "game_2",
        selectionId: "game_2:home",
        result: "win",
      },
      {
        ...straightLeg[0],
        id: "leg_3",
        gameId: "game_3",
        selectionId: "game_3:away",
        selectionSide: "away",
        result: "push",
      },
    ];

    expect(settleSlip("straight", 1500, straightLeg)).toMatchObject({
      status: "won",
      payoutCents: 2864,
    });

    expect(settleSlip("parlay", 1000, parlayLegs)).toMatchObject({
      status: "won",
      payoutCents: calculateParlayPayout(1000, [-110]),
    });
  });

  it("refunds fully voided and push-only parlays correctly", () => {
    const voidLegs: BetLegView[] = [
      {
        id: "leg_void_1",
        gameId: "game_void_1",
        selectionId: "game_void_1:home",
        selectionTeam: "Knicks",
        selectionSide: "home",
        spread: -2.5,
        americanOdds: -110,
        bookmaker: "draftkings",
        quoteTimestamp: new Date().toISOString(),
        result: "void",
      },
      {
        id: "leg_void_2",
        gameId: "game_void_2",
        selectionId: "game_void_2:away",
        selectionTeam: "Celtics",
        selectionSide: "away",
        spread: 2.5,
        americanOdds: -110,
        bookmaker: "draftkings",
        quoteTimestamp: new Date().toISOString(),
        result: "void",
      },
    ];

    const pushLegs: BetLegView[] = [
      {
        ...voidLegs[0],
        id: "leg_push_1",
        result: "push",
      },
      {
        ...voidLegs[1],
        id: "leg_push_2",
        result: "void",
      },
    ];

    expect(settleSlip("parlay", 2500, voidLegs)).toMatchObject({
      status: "void",
      payoutCents: 2500,
    });

    expect(settleSlip("parlay", 1800, pushLegs)).toMatchObject({
      status: "push",
      payoutCents: 1800,
    });
  });
});
