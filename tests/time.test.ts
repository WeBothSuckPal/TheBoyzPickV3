import { describe, expect, it } from "vitest";

import { getLocalDateKey, getWeekKey } from "@/lib/time";

describe("club time helpers", () => {
  it("uses club-local calendar dates instead of utc dates around spring DST", () => {
    const date = new Date("2026-03-09T03:30:00Z");

    expect(getLocalDateKey(date, "America/New_York")).toBe("2026-03-08");
    expect(getWeekKey(date, "America/New_York")).toBe("2026-03-02");
  });

  it("uses club-local calendar dates instead of utc dates around fall DST", () => {
    const date = new Date("2026-11-02T04:30:00Z");

    expect(getLocalDateKey(date, "America/New_York")).toBe("2026-11-01");
    expect(getWeekKey(date, "America/New_York")).toBe("2026-10-26");
  });
});
