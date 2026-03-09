import ws from "ws";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "@/lib/db/schema";

// Required for Node.js environments (Vercel serverless functions)
neonConfig.webSocketConstructor = ws;

type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

declare global {
  var __clubhouseDb: DbInstance | undefined;
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!globalThis.__clubhouseDb) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    globalThis.__clubhouseDb = drizzle({ client: pool, schema });
  }

  return globalThis.__clubhouseDb;
}
