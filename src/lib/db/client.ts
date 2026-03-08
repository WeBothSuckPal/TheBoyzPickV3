import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import * as schema from "@/lib/db/schema";

type DbInstance = NeonHttpDatabase<typeof schema>;

declare global {
  var __clubhouseDb: DbInstance | undefined;
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalThis.__clubhouseDb) {
    const sql = neon(process.env.DATABASE_URL);
    globalThis.__clubhouseDb = drizzle({ client: sql, schema });
  }

  return globalThis.__clubhouseDb;
}
