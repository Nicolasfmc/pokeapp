import "server-only";
import { query, withWriteTransaction } from "./db";

/**
 * Same table and key format as the main app (auth_rate_limits), so failed
 * sign-ins on either app count against the same account.
 */
export type Limit = { limit: number; windowSeconds: number };

export const ADMIN_LOGIN_IP_LIMIT: Limit = { limit: 10, windowSeconds: 15 * 60 };
export const LOGIN_FAILURE_LIMIT: Limit = { limit: 8, windowSeconds: 15 * 60 };

export const ipKey = (ip: string) => `admin-login:ip:${ip}`;
export const failureKey = (email: string) => `login:fail:${email}`;

type Row = { count: number; windowStart: Date };

/** Adds one hit; returns false once the limit is exceeded. */
export async function consume(key: string, { limit, windowSeconds }: Limit): Promise<boolean> {
  const rows = await withWriteTransaction((run) =>
    run<Row>(
      `INSERT INTO auth_rate_limits ("key", "count", "windowStart")
       VALUES ($1, 1, (now() AT TIME ZONE 'UTC'))
       ON CONFLICT ("key") DO UPDATE SET
         "count" = CASE
           WHEN auth_rate_limits."windowStart" <= (now() AT TIME ZONE 'UTC') - ($2::int * interval '1 second')
           THEN 1 ELSE auth_rate_limits."count" + 1 END,
         "windowStart" = CASE
           WHEN auth_rate_limits."windowStart" <= (now() AT TIME ZONE 'UTC') - ($2::int * interval '1 second')
           THEN (now() AT TIME ZONE 'UTC') ELSE auth_rate_limits."windowStart" END
       RETURNING "count", "windowStart"`,
      [key, windowSeconds],
    ),
  );
  return (rows[0]?.count ?? 0) <= limit;
}

/** True while the key is under the limit (doesn't add a hit). */
export async function isUnderLimit(key: string, { limit, windowSeconds }: Limit): Promise<boolean> {
  const rows = await query<Row>(
    `SELECT "count", "windowStart" FROM auth_rate_limits
      WHERE "key" = $1
        AND "windowStart" > (now() AT TIME ZONE 'UTC') - ($2::int * interval '1 second')`,
    [key, windowSeconds],
  );
  return !rows[0] || rows[0].count < limit;
}
