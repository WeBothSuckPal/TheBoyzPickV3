import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db/client";
import { adminAuditLogs, rateLimitBuckets } from "@/lib/db/schema";
import { getCronSecret, isDatabaseConfigured } from "@/lib/env";
import type { ViewerProfile } from "@/lib/types";

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityError";
  }
}

export class RateLimitError extends SecurityError {
  retryAfterSeconds?: number;

  constructor(message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

type RateLimitPolicy = {
  category: string;
  limit: number;
  windowMs: number;
  blockMs: number;
};

type RequestContext = {
  ipHash: string;
  requestId: string;
  ipAddress: string;
};

const memoryBuckets = new Map<
  string,
  { hits: number; windowStart: number; blockedUntil?: number }
>();
const rateLimitStorePath = path.join(
  process.cwd(),
  ".clubhouse-cache",
  "rate-limit-buckets.json",
);
let rateLimitStoreLock = Promise.resolve();

function toBuffer(value: string) {
  return Buffer.from(value);
}

export function safeCompare(secret: string, candidate: string) {
  const left = toBuffer(secret);
  const right = toBuffer(candidate);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function getClientIpValue(headersObject: Headers) {
  return (
    headersObject.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersObject.get("x-real-ip") ||
    headersObject.get("cf-connecting-ip") ||
    "unknown"
  );
}

function hashIp(ipAddress: string) {
  return createHash("sha256").update(ipAddress).digest("hex");
}

async function getRequestContextFromHeaders(headersObject: Headers): Promise<RequestContext> {
  const ipAddress = getClientIpValue(headersObject);
  const requestId =
    headersObject.get("x-vercel-id") ||
    headersObject.get("x-request-id") ||
    createHash("sha256")
      .update(`${Date.now()}:${ipAddress}`)
      .digest("hex")
      .slice(0, 16);

  return {
    ipAddress,
    ipHash: hashIp(ipAddress),
    requestId,
  };
}

export async function getServerRequestContext() {
  return getRequestContextFromHeaders(await headers());
}

export async function getRouteRequestContext(request: Request) {
  return getRequestContextFromHeaders(new Headers(request.headers));
}

export async function recordSecurityEvent(input: {
  actor?: ViewerProfile | null;
  action: string;
  targetType: string;
  targetId: string;
  outcome?: string;
  metadata?: Record<string, unknown>;
  requestContext?: RequestContext;
}) {
  if (!isDatabaseConfigured()) {
    return;
  }

  const db = getDb();
  if (!db) {
    return;
  }

  await db.insert(adminAuditLogs).values({
    actorUserProfileId: input.actor?.id,
    actorEmail: input.actor?.email,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    requestId: input.requestContext?.requestId,
    ipHash: input.requestContext?.ipHash,
    outcome: input.outcome ?? "success",
    metadata: input.metadata,
  });
}

async function consumeDbRateLimit(subjectKey: string, policy: RateLimitPolicy) {
  const db = getDb();
  if (!db) {
    return;
  }

  const key = `${policy.category}:${subjectKey}`;
  const now = new Date();
  const blockUntil = new Date(now.getTime() + policy.blockMs);
  const windowStart = new Date(now.getTime() - policy.windowMs);

  await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(rateLimitBuckets)
      .where(eq(rateLimitBuckets.key, key))
      .limit(1);

    const current = rows[0];
    if (!current) {
      await tx.insert(rateLimitBuckets).values({
        key,
        category: policy.category,
        subjectKey,
        hits: 1,
        windowStart: now,
        updatedAt: now,
      }).onConflictDoNothing();
      return;
    }

    if (current.blockedUntil && current.blockedUntil > now) {
      throw new RateLimitError(
        "Too many requests. Try again later.",
        Math.ceil((current.blockedUntil.getTime() - now.getTime()) / 1000),
      );
    }

    if (current.windowStart < windowStart) {
      await tx
        .update(rateLimitBuckets)
        .set({
          hits: 1,
          windowStart: now,
          blockedUntil: null,
          updatedAt: now,
        })
        .where(eq(rateLimitBuckets.key, key));
      return;
    }

    const nextHits = current.hits + 1;
    if (nextHits > policy.limit) {
      await tx
        .update(rateLimitBuckets)
        .set({
          hits: nextHits,
          blockedUntil: blockUntil,
          updatedAt: now,
        })
        .where(eq(rateLimitBuckets.key, key));

      throw new RateLimitError(
        "Too many requests. Try again later.",
        Math.ceil(policy.blockMs / 1000),
      );
    }

    await tx
      .update(rateLimitBuckets)
      .set({
        hits: nextHits,
        updatedAt: now,
      })
      .where(eq(rateLimitBuckets.key, key));
  });
}

function consumeMemoryRateLimit(subjectKey: string, policy: RateLimitPolicy) {
  const key = `${policy.category}:${subjectKey}`;
  const now = Date.now();
  const current = memoryBuckets.get(key);

  if (!current || current.windowStart < now - policy.windowMs) {
    memoryBuckets.set(key, { hits: 1, windowStart: now });
    return;
  }

  if (current.blockedUntil && current.blockedUntil > now) {
    throw new RateLimitError(
      "Too many requests. Try again later.",
      Math.ceil((current.blockedUntil - now) / 1000),
    );
  }

  const nextHits = current.hits + 1;
  if (nextHits > policy.limit) {
    current.hits = nextHits;
    current.blockedUntil = now + policy.blockMs;
    memoryBuckets.set(key, current);
    throw new RateLimitError(
      "Too many requests. Try again later.",
      Math.ceil(policy.blockMs / 1000),
    );
  }

  current.hits = nextHits;
  memoryBuckets.set(key, current);
}

async function withPersistentRateLimitStore<T>(
  handler: (
    buckets: Record<string, { hits: number; windowStart: number; blockedUntil?: number }>,
  ) => T,
) {
  const currentLock = rateLimitStoreLock;
  let release: () => void = () => undefined;

  rateLimitStoreLock = new Promise<void>((resolve) => {
    release = resolve;
  });

  await currentLock;

  try {
    await mkdir(path.dirname(rateLimitStorePath), { recursive: true });

    let buckets: Record<
      string,
      { hits: number; windowStart: number; blockedUntil?: number }
    > = {};

    try {
      buckets = JSON.parse(await readFile(rateLimitStorePath, "utf8")) as typeof buckets;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const result = handler(buckets);
    await writeFile(rateLimitStorePath, JSON.stringify(buckets), "utf8");
    return result;
  } finally {
    release();
  }
}

async function consumePersistentRateLimit(subjectKey: string, policy: RateLimitPolicy) {
  return withPersistentRateLimitStore((buckets) => {
    const key = `${policy.category}:${subjectKey}`;
    const now = Date.now();
    const current = buckets[key];

    if (!current || current.windowStart < now - policy.windowMs) {
      buckets[key] = { hits: 1, windowStart: now };
      return;
    }

    if (current.blockedUntil && current.blockedUntil > now) {
      throw new RateLimitError(
        "Too many requests. Try again later.",
        Math.ceil((current.blockedUntil - now) / 1000),
      );
    }

    const nextHits = current.hits + 1;
    if (nextHits > policy.limit) {
      current.hits = nextHits;
      current.blockedUntil = now + policy.blockMs;
      buckets[key] = current;
      throw new RateLimitError(
        "Too many requests. Try again later.",
        Math.ceil(policy.blockMs / 1000),
      );
    }

    current.hits = nextHits;
    buckets[key] = current;
  });
}

export async function assertRateLimit(input: {
  viewer?: ViewerProfile | null;
  requestContext: RequestContext;
  policies: RateLimitPolicy[];
}) {
  for (const policy of input.policies) {
    const subjectKey =
      policy.category.includes("ip")
        ? input.requestContext.ipHash
        : input.viewer?.id ?? input.requestContext.ipHash;

    try {
      if (isDatabaseConfigured()) {
        await consumeDbRateLimit(subjectKey, policy);
      } else {
        try {
          await consumePersistentRateLimit(subjectKey, policy);
        } catch (error) {
          if (error instanceof RateLimitError) {
            throw error;
          }

          consumeMemoryRateLimit(subjectKey, policy);
        }
      }
    } catch (error) {
      if (error instanceof RateLimitError) {
        await recordSecurityEvent({
          actor: input.viewer,
          action: "rate_limit_blocked",
          targetType: "rate_limit",
          targetId: policy.category,
          outcome: "blocked",
          metadata: {
            category: policy.category,
            subjectKey,
            retryAfterSeconds: error.retryAfterSeconds,
          },
          requestContext: input.requestContext,
        });
      }

      throw error;
    }
  }
}

export function requireConfiguredCronSecret() {
  const secret = getCronSecret();
  if (!secret) {
    throw new SecurityError("CRON_SECRET is not configured.");
  }

  return secret;
}

export async function assertCronAuthorization(request: Request) {
  const secret = requireConfiguredCronSecret();
  const authorization = request.headers.get("authorization") ?? "";

  if (!authorization.startsWith("Bearer ")) {
    throw new SecurityError("Unauthorized");
  }

  const token = authorization.slice("Bearer ".length);
  if (!safeCompare(secret, token)) {
    throw new SecurityError("Unauthorized");
  }
}
