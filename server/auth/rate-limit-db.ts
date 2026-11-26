/**
 * Fixed-window rate limiter stored in PostgreSQL (auth_rate_limits), so the
 * limit holds across every serverless instance. All values go through
 * parameterized queries.
 */
import { prisma } from "@/server/database";

export type DbRateLimit = { limit: number; windowSeconds: number };

export const LOGIN_IP_LIMIT: DbRateLimit = { limit: 30, windowSeconds: 15 * 60 };
/** Failed sign-ins per account before it is throttled. */
export const LOGIN_FAILURE_LIMIT: DbRateLimit = { limit: 8, windowSeconds: 15 * 60 };
export const REGISTER_IP_LIMIT: DbRateLimit = { limit: 10, windowSeconds: 60 * 60 };

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

function retryAfter(windowStart: Date, windowSeconds: number) {
  const resetAt = windowStart.getTime() + windowSeconds * 1000;
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

/** Counts one hit for `key` and tells whether it is still within the limit. */
export async function consumeRateLimit(key: string, options: DbRateLimit): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<Array<{ count: number; windowStart: Date }>>`
    INSERT INTO auth_rate_limits ("key", "count", "windowStart")
    VALUES (${key}, 1, (now() AT TIME ZONE 'UTC'))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN auth_rate_limits."windowStart" <= (now() AT TIME ZONE 'UTC') - (${options.windowSeconds}::int * interval '1 second')
        THEN 1 ELSE auth_rate_limits."count" + 1 END,
      "windowStart" = CASE
        WHEN auth_rate_limits."windowStart" <= (now() AT TIME ZONE 'UTC') - (${options.windowSeconds}::int * interval '1 second')
        THEN (now() AT TIME ZONE 'UTC') ELSE auth_rate_limits."windowStart" END
    RETURNING "count", "windowStart"
  `;
  const row = rows[0];
  if (row && row.count > options.limit) {
    return { ok: false, retryAfterSec: retryAfter(row.windowStart, options.windowSeconds) };
  }
  return { ok: true };
}

/** Checks the counter without adding a hit. */
export async function peekRateLimit(key: string, options: DbRateLimit): Promise<RateLimitResult> {
  const row = await prisma.authRateLimit.findUnique({ where: { key } });
  if (!row) return { ok: true };
  const expired = row.windowStart.getTime() + options.windowSeconds * 1000 <= Date.now();
  if (!expired && row.count >= options.limit) {
    return { ok: false, retryAfterSec: retryAfter(row.windowStart, options.windowSeconds) };
  }
  return { ok: true };
}

export async function resetRateLimit(key: string) {
  await prisma.authRateLimit.deleteMany({ where: { key } });
}

/** Drops counters whose window ended more than a day ago. */
export async function pruneRateLimits() {
  await prisma.authRateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}
