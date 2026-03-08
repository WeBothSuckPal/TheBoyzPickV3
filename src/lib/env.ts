import { z } from "zod";

export type AppMode = "demo" | "live";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  ODDS_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().optional(),
  PRIMARY_BOOKMAKER: z.string().default("draftkings"),
  CLUB_TIME_ZONE: z.string().default("America/New_York"),
  BANKROLL_PAYMENT_INSTRUCTIONS: z
    .string()
    .default("Send payment to the commissioner and request approval here once sent."),
});

type ParsedEnv = z.infer<typeof envSchema>;

let cachedEnv: ParsedEnv | null = null;

const requiredProductionKeys = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "DATABASE_URL",
  "ODDS_API_KEY",
  "CRON_SECRET",
  "ADMIN_EMAILS",
] as const;

function formatZodErrors(error: z.ZodError) {
  const details = error.issues.map((issue) => {
    const field = issue.path.join(".") || "environment";
    return `${field}: ${issue.message}`;
  });

  return details.join("; ");
}

function parseEnv(): ParsedEnv {
  if (!cachedEnv) {
    try {
      cachedEnv = envSchema.parse(process.env);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ConfigurationError(`Invalid environment configuration: ${formatZodErrors(error)}`);
      }

      throw error;
    }
  }

  return cachedEnv;
}

export function isProduction() {
  return parseEnv().NODE_ENV === "production";
}

export function isClerkConfigured() {
  const env = parseEnv();
  return Boolean(env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY);
}

export function isDatabaseConfigured() {
  return Boolean(parseEnv().DATABASE_URL);
}

export function isOddsConfigured() {
  return Boolean(parseEnv().ODDS_API_KEY);
}

export function requireOddsApiKey() {
  const key = parseEnv().ODDS_API_KEY;

  if (!key) {
    throw new ConfigurationError(
      "ODDS_API_KEY is required before odds sync and settlement jobs can run.",
    );
  }

  return key;
}

export function getAppMode(): AppMode {
  return isDatabaseConfigured() ? "live" : "demo";
}

export function getAdminEmails() {
  const value = parseEnv().ADMIN_EMAILS ?? "commissioner@example.com";

  return value
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function getClubTimeZone() {
  return parseEnv().CLUB_TIME_ZONE;
}

export function getCronSecret() {
  return parseEnv().CRON_SECRET ?? "";
}

export function requireCronSecret() {
  const secret = getCronSecret();

  if (!secret) {
    throw new Error("CRON_SECRET must be configured before cron routes are enabled.");
  }

  if (secret.length < 32) {
    throw new Error("CRON_SECRET must be at least 32 characters.");
  }

  return secret;
}

export function getMissingProductionEnvKeys() {
  const env = parseEnv();
  const missing: string[] = [];

  for (const key of requiredProductionKeys) {
    const value = env[key];
    if (typeof value !== "string" || value.trim().length === 0) {
      missing.push(key);
    }
  }

  if (env.CRON_SECRET && env.CRON_SECRET.length < 32) {
    missing.push("CRON_SECRET(min:32)");
  }

  return missing;
}

export function assertProductionEnvReady() {
  if (!isProduction()) {
    return;
  }

  const missing = getMissingProductionEnvKeys();
  if (missing.length > 0) {
    throw new ConfigurationError(
      `Missing required production environment configuration: ${missing.join(", ")}`,
    );
  }
}

export function getRuntimeConfig() {
  return parseEnv();
}
