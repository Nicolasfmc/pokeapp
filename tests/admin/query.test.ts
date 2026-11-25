import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@/server/auth", () => ({ getSession: async () => null }));
vi.mock("@/server/database", () => ({ prisma: {} }));

const { parseAdminUsersQuery, requireAdmin } = await import("@/server/services/admin");

describe("parseAdminUsersQuery", () => {
  it("defaults to page 1 and an empty search", () => {
    expect(parseAdminUsersQuery({})).toEqual({ q: "", page: 1 });
  });

  it("reads and trims the search, and ignores invalid pages", () => {
    expect(parseAdminUsersQuery({ q: "  nico ", page: "3" })).toEqual({ q: "nico", page: 3 });
    expect(parseAdminUsersQuery({ page: "-2" }).page).toBe(1);
    expect(parseAdminUsersQuery({ page: "abc" }).page).toBe(1);
    expect(parseAdminUsersQuery({ q: ["a", "b"] }).q).toBe("a");
  });

  it("caps the search length", () => {
    expect(parseAdminUsersQuery({ q: "x".repeat(500) }).q).toHaveLength(100);
  });
});

describe("requireAdmin", () => {
  it("returns 404 when there is no session", async () => {
    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
  });
});
