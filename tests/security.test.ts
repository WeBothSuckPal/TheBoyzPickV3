import { afterEach, describe, expect, it, vi } from "vitest";

import { safeCompare } from "@/lib/security";

describe("security helpers", () => {
  afterEach(() => {
    vi.resetModules();
    delete process.env.CRON_SECRET;
  });

  it("matches equal secrets and rejects different ones", () => {
    expect(safeCompare("abcdefghijklmnopqrstuvwxyz123456", "abcdefghijklmnopqrstuvwxyz123456")).toBe(true);
    expect(safeCompare("abcdefghijklmnopqrstuvwxyz123456", "abcdefghijklmnopqrstuvwxyz123457")).toBe(false);
    expect(safeCompare("short", "longer")).toBe(false);
  });

  it("fails closed when CRON_SECRET is missing", async () => {
    delete process.env.CRON_SECRET;

    const { requireConfiguredCronSecret, SecurityError } = await import("@/lib/security");
    expect(() => requireConfiguredCronSecret()).toThrow(SecurityError);
  });

  it("rejects CRON_SECRET shorter than 32 chars", async () => {
    process.env.CRON_SECRET = "short-secret";

    const { requireCronSecret } = await import("@/lib/env");
    expect(() => requireCronSecret()).toThrow("at least 32 characters");
  });
});
