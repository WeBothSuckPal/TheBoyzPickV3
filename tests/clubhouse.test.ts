import { afterEach, describe, expect, it, vi } from "vitest";

describe("clubhouse demo safeguards", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete (globalThis as typeof globalThis & { __clubhouseStore?: unknown }).__clubhouseStore;
  });

  it("deduplicates top-up requests by idempotency key in demo mode", async () => {
    delete process.env.DATABASE_URL;

    const { requestTopUp } = await import("@/lib/clubhouse");

    const first = await requestTopUp(
      "user_jules",
      5000,
      "Weekend bankroll reload",
      "topup-demo-key",
    );
    const second = await requestTopUp(
      "user_jules",
      5000,
      "Weekend bankroll reload",
      "topup-demo-key",
    );

    expect(second.id).toBe(first.id);
    expect(second.idempotencyKey).toBe("topup-demo-key");
  });
});
