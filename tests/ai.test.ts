import { describe, expect, it } from "vitest";

import { buildSpreadIntelligence, summarizeOpsHealth } from "@/lib/ai";

describe("ai helpers", () => {
  it("builds spread intelligence tags and confidence bands", () => {
    const intelligence = buildSpreadIntelligence({
      currentSpread: -4.5,
      currentOdds: -140,
      history: [
        { spread: -3.5, capturedAt: "2026-03-07T10:00:00.000Z" },
        { spread: -4.0, capturedAt: "2026-03-07T11:00:00.000Z" },
      ],
      commenceTime: "2026-03-07T12:30:00.000Z",
      now: new Date("2026-03-07T12:00:00.000Z"),
    });

    expect(intelligence.riskTags).toContain("line_shift");
    expect(intelligence.riskTags).toContain("heavy_juice");
    expect(intelligence.riskTags).toContain("closing_soon");
    expect(intelligence.confidenceBand).toBe("medium");
  });

  it("summarizes ops health with score penalties by severity", () => {
    const report = summarizeOpsHealth({
      mode: "hourly",
      findings: [
        {
          code: "sync_stale_warning",
          severity: "warning",
          message: "Stale sync",
          metric: 90,
        },
        {
          code: "retry_storm_critical",
          severity: "critical",
          message: "Retry storm",
          metric: 30,
        },
      ],
      remediations: [
        {
          action: "run_odds_sync",
          status: "applied",
          detail: "ran",
        },
      ],
      now: new Date("2026-03-07T13:00:00.000Z"),
    });

    expect(report.score).toBeLessThan(80);
    expect(report.summary).toContain("critical");
    expect(report.findings).toHaveLength(2);
  });
});
