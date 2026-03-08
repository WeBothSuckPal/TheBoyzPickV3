import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type JournalEntry = {
  idx: number;
  tag: string;
};

const requireProductionEnv = process.argv.includes("--production-env");

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function run() {
  const projectRoot = process.cwd();
  const failures: string[] = [];
  const passes: string[] = [];

  const journalPath = path.join(projectRoot, "drizzle", "meta", "_journal.json");
  if (!existsSync(journalPath)) {
    failures.push("Missing drizzle journal file: drizzle/meta/_journal.json");
  } else {
    const journal = readJson<{ entries: JournalEntry[] }>(journalPath);
    if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
      failures.push("No migrations found in drizzle journal.");
    } else {
      for (const entry of journal.entries) {
        const migrationFile = path.join(projectRoot, "drizzle", `${entry.tag}.sql`);
        if (!existsSync(migrationFile)) {
          failures.push(`Migration listed in journal is missing: drizzle/${entry.tag}.sql`);
        }
      }

      if (failures.length === 0) {
        passes.push(`Validated ${journal.entries.length} migrations from drizzle journal.`);
      }
    }
  }

  if (requireProductionEnv) {
    const requiredKeys = [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
      "DATABASE_URL",
      "ODDS_API_KEY",
      "CRON_SECRET",
      "ADMIN_EMAILS",
    ] as const;

    const missingKeys = requiredKeys.filter((key) => {
      const value = process.env[key];
      return typeof value !== "string" || value.trim().length === 0;
    });

    if (missingKeys.length > 0) {
      failures.push(`Missing required production env keys: ${missingKeys.join(", ")}`);
    } else {
      passes.push("Required production env keys are present.");
    }

    const cronSecret = process.env.CRON_SECRET ?? "";
    if (cronSecret.length < 32) {
      failures.push("CRON_SECRET must be at least 32 characters.");
    } else {
      passes.push("CRON_SECRET length is valid.");
    }
  } else {
    passes.push("Skipped production env checks (run with --production-env to enable).");
  }

  for (const message of passes) {
    console.log(`[PASS] ${message}`);
  }

  if (failures.length > 0) {
    for (const message of failures) {
      console.error(`[FAIL] ${message}`);
    }
    process.exit(1);
  }

  console.log("[PASS] Deployment preflight checks passed.");
}

run();
