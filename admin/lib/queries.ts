import "server-only";
import { query } from "./db";
import { escapeLike } from "./security";

export const USERS_PAGE_SIZE = 50;

export type Overview = {
  users: number;
  active: number;
  deletionPending: number;
  newLast7Days: number;
  newLast30Days: number;
  publicProfiles: number;
  decks: number;
  sleevedDecks: number;
  inventoryCopies: number;
  matches: number;
  tournaments: number;
  activeSessions: number;
};

export async function getOverview(): Promise<Overview> {
  const [row] = await query<Record<keyof Overview, string>>(`
    SELECT
      (SELECT count(*) FROM users) AS "users",
      (SELECT count(*) FROM users WHERE "accountStatus" = 'ACTIVE') AS "active",
      (SELECT count(*) FROM users WHERE "accountStatus" = 'DELETION_PENDING') AS "deletionPending",
      (SELECT count(*) FROM users WHERE "createdAt" >= (now() AT TIME ZONE 'UTC') - interval '7 days') AS "newLast7Days",
      (SELECT count(*) FROM users WHERE "createdAt" >= (now() AT TIME ZONE 'UTC') - interval '30 days') AS "newLast30Days",
      (SELECT count(*) FROM user_profiles WHERE "isPublic") AS "publicProfiles",
      (SELECT count(*) FROM decks) AS "decks",
      (SELECT count(*) FROM decks WHERE "physicalStatus" = 'SLEEVED') AS "sleevedDecks",
      (SELECT coalesce(sum(quantity), 0) FROM inventory_items) AS "inventoryCopies",
      (SELECT count(*) FROM matches) AS "matches",
      (SELECT count(*) FROM tournaments) AS "tournaments",
      (SELECT count(*) FROM user_sessions
        WHERE "revokedAt" IS NULL AND "expiresAt" > (now() AT TIME ZONE 'UTC')) AS "activeSessions"
  `);
  // count()/sum() come back as strings (bigint).
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, Number(value)]),
  ) as Overview;
}

export type UserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  accountStatus: string;
  isAdmin: boolean;
  isPublic: boolean | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  decks: number;
  inventoryCopies: number;
  matches: number;
  tournaments: number;
};

export async function listUsers(search: string, page: number) {
  const pattern = search ? `%${escapeLike(search)}%` : null;
  const offset = (page - 1) * USERS_PAGE_SIZE;

  const [{ total }] = await query<{ total: string }>(
    `SELECT count(*) AS total FROM users
      WHERE $1::text IS NULL OR username ILIKE $1 OR email ILIKE $1`,
    [pattern],
  );

  // Explicit column list: password hashes are never read.
  const rows = await query<UserRow & { decks: string; inventoryCopies: string; matches: string; tournaments: string }>(
    `SELECT u.id, u.username, u.email, p."displayName", u."accountStatus", u."isAdmin",
            p."isPublic", u."createdAt",
            (SELECT max(s."lastUsedAt") FROM user_sessions s WHERE s."userId" = u.id) AS "lastSeenAt",
            (SELECT count(*) FROM decks d WHERE d."userId" = u.id) AS decks,
            (SELECT coalesce(sum(i.quantity), 0) FROM inventory_items i WHERE i."userId" = u.id) AS "inventoryCopies",
            (SELECT count(*) FROM matches m WHERE m."userId" = u.id) AS matches,
            (SELECT count(*) FROM tournaments t WHERE t."userId" = u.id) AS tournaments
       FROM users u
       LEFT JOIN user_profiles p ON p."userId" = u.id
      WHERE $1::text IS NULL OR u.username ILIKE $1 OR u.email ILIKE $1
      ORDER BY u."createdAt" DESC, u.id
      LIMIT $2 OFFSET $3`,
    [pattern, USERS_PAGE_SIZE, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((row) => ({
      ...row,
      decks: Number(row.decks),
      inventoryCopies: Number(row.inventoryCopies),
      matches: Number(row.matches),
      tournaments: Number(row.tournaments),
    })),
  };
}
