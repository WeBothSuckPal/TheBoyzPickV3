import { describe, expect, it } from "vitest";

import { getLocalDateKey, getLocalDayBounds, getWeekKey } from "@/lib/time";

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

  it("builds local day bounds using the club timezone during spring DST", () => {
    const date = new Date("2026-03-09T03:30:00Z");
    const { start, end } = getLocalDayBounds(date, "America/New_York");

    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T03:59:59.999Z");
  });

  it("builds local day bounds using the club timezone during fall DST", () => {
    const date = new Date("2026-11-02T04:30:00Z");
    const { start, end } = getLocalDayBounds(date, "America/New_York");

    expect(start.toISOString()).toBe("2026-11-01T04:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-02T04:59:59.999Z");
  });
});
