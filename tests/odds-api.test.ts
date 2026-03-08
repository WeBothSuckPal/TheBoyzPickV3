import { describe, expect, it } from "vitest";

import { normalizeOddsEvent, normalizeScoreEvent } from "@/lib/odds-api";

describe("odds api normalization", () => {
  it("normalizes spread markets into two-sided selections", () => {
    const event = normalizeOddsEvent(
      {
        id: "evt_1",
        commence_time: "2026-03-08T00:00:00Z",
        home_team: "Knicks",
        away_team: "Celtics",
        bookmakers: [
          {
            key: "draftkings",
            title: "DraftKings",
            markets: [
              {
                key: "spreads",
                outcomes: [
                  { name: "Knicks", price: -110, point: -3.5 },
                  { name: "Celtics", price: -110, point: 3.5 },
                ],
              },
            ],
          },
        ],
      },
      "draftkings",
      new Date("2026-03-07T15:00:00Z"),
    );

    expect(event).toMatchObject({
      externalId: "evt_1",
      homeTeam: "Knicks",
      awayTeam: "Celtics",
    });
    expect(event?.outcomes).toHaveLength(2);
    expect(event?.outcomes[0]).toMatchObject({
      side: "home",
      spread: -3.5,
      bookmaker: "draftkings",
    });
  });

  it("maps missing-score completed events to cancelled and stale past events to postponed", () => {
    const cancelled = normalizeScoreEvent(
      {
        id: "evt_cancelled",
        commence_time: "2026-03-07T19:00:00Z",
        home_team: "Knicks",
        away_team: "Celtics",
        completed: true,
        scores: [],
      },
      new Date("2026-03-08T06:00:00Z"),
    );

    const postponed = normalizeScoreEvent(
      {
        id: "evt_postponed",
        commence_time: "2026-03-07T19:00:00Z",
        home_team: "Knicks",
        away_team: "Celtics",
        completed: false,
        scores: [],
      },
      new Date("2026-03-08T06:00:00Z"),
    );

    expect(cancelled.status).toBe("cancelled");
    expect(postponed.status).toBe("postponed");
  });
});
