import { notFound } from "next/navigation";
import { prisma } from "@/server/database";
import { getSession } from "@/server/auth";
import type { SessionUser } from "@/server/auth";

export const ADMIN_USERS_PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Admin rights are read from the database on every request (not stored in the
 * session), so revoking `isAdmin` takes effect immediately.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true, accountStatus: true },
  });
  return Boolean(user?.isAdmin && user.accountStatus === "ACTIVE");
}

/** Use in admin pages: anyone who isn't an admin gets a plain 404. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await getSession();
  if (!session || !(await isAdminUser(session.id))) {
    notFound();
  }
  return session;
}

export type AdminOverview = {
  users: {
    total: number;
    active: number;
    deletionPending: number;
    newLast7Days: number;
    newLast30Days: number;
    publicProfiles: number;
  };
  decks: { total: number; sleeved: number };
  inventoryCopies: number;
  matches: number;
  tournaments: number;
};

export async function getAdminOverview(now = new Date()): Promise<AdminOverview> {
  const since7 = new Date(now.getTime() - 7 * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [
    total,
    active,
    deletionPending,
    newLast7Days,
    newLast30Days,
    publicProfiles,
    decks,
    sleeved,
    inventory,
    matches,
    tournaments,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { accountStatus: "ACTIVE" } }),
    prisma.user.count({ where: { accountStatus: "DELETION_PENDING" } }),
    prisma.user.count({ where: { createdAt: { gte: since7 } } }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.userProfile.count({ where: { isPublic: true } }),
    prisma.deck.count(),
    prisma.deck.count({ where: { physicalStatus: "SLEEVED" } }),
    prisma.inventoryItem.aggregate({ _sum: { quantity: true } }),
    prisma.match.count(),
    prisma.tournament.count(),
  ]);

  return {
    users: { total, active, deletionPending, newLast7Days, newLast30Days, publicProfiles },
    decks: { total: decks, sleeved },
    inventoryCopies: inventory._sum.quantity ?? 0,
    matches,
    tournaments,
  };
}

export type AdminUserRow = {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  accountStatus: string;
  isAdmin: boolean;
  isPublic: boolean;
  createdAt: string;
  decks: number;
  inventoryCopies: number;
  matches: number;
  tournaments: number;
};

export type AdminUsersQuery = { q: string; page: number };

export function parseAdminUsersQuery(
  raw: Record<string, string | string[] | undefined>,
): AdminUsersQuery {
  const first = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";
  const q = first(raw.q).trim().slice(0, 100);
  const page = Number.parseInt(first(raw.page), 10);
  return { q, page: Number.isFinite(page) && page > 1 ? page : 1 };
}

export async function listAdminUsers({ q, page }: AdminUsersQuery): Promise<{
  rows: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const where = q
    ? {
        OR: [
          { username: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * ADMIN_USERS_PAGE_SIZE,
      take: ADMIN_USERS_PAGE_SIZE,
      // Explicit select: never read passwordHash here.
      select: {
        id: true,
        username: true,
        email: true,
        accountStatus: true,
        isAdmin: true,
        createdAt: true,
        profile: { select: { displayName: true, isPublic: true } },
        _count: { select: { decks: true, matches: true, tournaments: true } },
      },
    }),
  ]);

  const copies = users.length
    ? await prisma.inventoryItem.groupBy({
        by: ["userId"],
        where: { userId: { in: users.map((u) => u.id) } },
        _sum: { quantity: true },
      })
    : [];
  const copiesByUser = new Map(copies.map((c) => [c.userId, c._sum.quantity ?? 0]));

  return {
    total,
    page,
    pageSize: ADMIN_USERS_PAGE_SIZE,
    rows: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.profile?.displayName ?? null,
      accountStatus: u.accountStatus,
      isAdmin: u.isAdmin,
      isPublic: u.profile?.isPublic ?? false,
      createdAt: u.createdAt.toISOString(),
      decks: u._count.decks,
      inventoryCopies: copiesByUser.get(u.id) ?? 0,
      matches: u._count.matches,
      tournaments: u._count.tournaments,
    })),
  };
}
