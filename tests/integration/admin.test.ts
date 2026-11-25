/**
 * Admin panel service against real PostgreSQL. Runs only with RUN_DB_TESTS=1
 * (as in CI). Creates users with a unique suffix and removes them at the end.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

config();
const RUN = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

// requireAdmin() is not exercised here; keep next/navigation and the session
// module out of the import graph.
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/server/auth", () => ({ getSession: async () => null }));

describe.skipIf(!RUN)("integração: painel admin", async () => {
  const { prisma } = await import("@/server/database");
  const { isAdminUser, getAdminOverview, listAdminUsers } = await import(
    "@/server/services/admin"
  );

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const ids = { admin: "", regular: "", pending: "" };

  beforeAll(async () => {
    const make = (name: string, data: Record<string, unknown> = {}) =>
      prisma.user.create({
        data: {
          email: `adm-${name}-${suffix}@sleevebuild.test`,
          username: `a${name}${suffix}`.slice(0, 20),
          passwordHash: "secret-hash",
          profile: { create: { displayName: `Admin test ${name}` } },
          ...data,
        },
      });
    ids.admin = (await make("x", { isAdmin: true })).id;
    ids.regular = (await make("y")).id;
    ids.pending = (await make("z", { isAdmin: true, accountStatus: "DELETION_PENDING" })).id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  });

  it("only active users flagged isAdmin are admins", async () => {
    expect(await isAdminUser(ids.admin)).toBe(true);
    expect(await isAdminUser(ids.regular)).toBe(false);
    expect(await isAdminUser(ids.pending)).toBe(false);
    expect(await isAdminUser("missing-user")).toBe(false);
  });

  it("counts users in the overview", async () => {
    const overview = await getAdminOverview();
    expect(overview.users.total).toBeGreaterThanOrEqual(3);
    expect(overview.users.newLast7Days).toBeGreaterThanOrEqual(3);
    expect(overview.users.deletionPending).toBeGreaterThanOrEqual(1);
  });

  it("searches users by username or email and never exposes the password hash", async () => {
    const result = await listAdminUsers({ q: suffix, page: 1 });
    expect(result.total).toBe(3);
    expect(result.rows.map((r) => r.id).sort()).toEqual(Object.values(ids).sort());
    for (const row of result.rows) {
      expect(row).not.toHaveProperty("passwordHash");
      expect(JSON.stringify(row)).not.toContain("secret-hash");
    }
    const byEmail = await listAdminUsers({ q: `adm-y-${suffix}`, page: 1 });
    expect(byEmail.rows.map((r) => r.id)).toEqual([ids.regular]);
  });
});
