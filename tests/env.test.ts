import { afterEach, describe, expect, it, vi } from "vitest";

describe("environment helpers", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  it("fails with a configuration error when odds jobs run without an api key", async () => {
    const { ConfigurationError, requireOddsApiKey } = await import("@/lib/env");

    expect(() => requireOddsApiKey()).toThrow(ConfigurationError);
  });

  it("reports missing required production environment keys", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.ODDS_API_KEY;
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_EMAILS;

    const { getMissingProductionEnvKeys } = await import("@/lib/env");
    const missing = getMissingProductionEnvKeys();

    expect(missing).toContain("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
    expect(missing).toContain("CLERK_SECRET_KEY");
    expect(missing).toContain("DATABASE_URL");
    expect(missing).toContain("ODDS_API_KEY");
    expect(missing).toContain("CRON_SECRET");
    expect(missing).toContain("ADMIN_EMAILS");
  });

  it("wraps invalid env values in a configuration error", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "invalid";

    const { ConfigurationError, getRuntimeConfig } = await import("@/lib/env");
    expect(() => getRuntimeConfig()).toThrow(ConfigurationError);
  });
});
