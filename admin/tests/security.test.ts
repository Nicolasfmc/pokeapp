import { beforeAll, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import {
  buildContentSecurityPolicy,
  escapeLike,
  isCrossSiteMutation,
  isIpAllowed,
  parseUsersQuery,
} from "@/lib/security";
import { signAdminToken, verifyAdminToken } from "@/lib/token";

const ADMIN_SECRET = "admin-secret-long-enough-for-tests-0123456789";

beforeAll(() => {
  process.env.ADMIN_JWT_SECRET = ADMIN_SECRET;
  process.env.AUTH_SECRET = "main-app-secret-different-0123456789abcdef";
});

describe("admin token", () => {
  it("round-trips the user id", async () => {
    expect(await verifyAdminToken(await signAdminToken("user_1"))).toBe("user_1");
  });

  it("rejects main-app tokens and tampered tokens", async () => {
    const mainAppToken = await new SignJWT({ username: "x", sid: "s" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setIssuer("sleevebuild")
      .setAudience("sleevebuild-app")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(ADMIN_SECRET));
    expect(await verifyAdminToken(mainAppToken)).toBeNull();

    const token = await signAdminToken("user_1");
    expect(await verifyAdminToken(`${token.slice(0, -2)}xx`)).toBeNull();
    expect(await verifyAdminToken("garbage")).toBeNull();
  });

  it("refuses to run with the main app's secret", async () => {
    process.env.ADMIN_JWT_SECRET = process.env.AUTH_SECRET;
    await expect(signAdminToken("user_1")).rejects.toThrow(/differ/);
    process.env.ADMIN_JWT_SECRET = ADMIN_SECRET;
  });
});

describe("security helpers", () => {
  it("builds a nonce-based CSP", () => {
    const csp = buildContentSecurityPolicy("n0nce", false);
    expect(csp).toContain("'nonce-n0nce'");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("checks the IP allowlist", () => {
    expect(isIpAllowed("1.2.3.4", "")).toBe(true);
    expect(isIpAllowed("1.2.3.4", undefined)).toBe(true);
    expect(isIpAllowed("1.2.3.4", "1.2.3.4, 5.6.7.8")).toBe(true);
    expect(isIpAllowed("9.9.9.9", "1.2.3.4,5.6.7.8")).toBe(false);
  });

  it("blocks cross-site POSTs", () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(isCrossSiteMutation("POST", h({ origin: "https://evil.example" }), "admin.example")).toBe(true);
    expect(isCrossSiteMutation("POST", h({ origin: "https://admin.example" }), "admin.example")).toBe(false);
    expect(isCrossSiteMutation("GET", h({ origin: "https://evil.example" }), "admin.example")).toBe(false);
    // Form POST with a strict referrer policy: Origin "null", but same-origin.
    expect(isCrossSiteMutation("POST", h({ origin: "null", "sec-fetch-site": "same-origin" }), "admin.example")).toBe(false);
    expect(isCrossSiteMutation("POST", h({ origin: "https://admin.example", "sec-fetch-site": "cross-site" }), "admin.example")).toBe(true);
  });

  it("escapes LIKE wildcards and parses the query", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
    expect(parseUsersQuery({ q: "  ash ", page: "2" })).toEqual({ q: "ash", page: 2 });
    expect(parseUsersQuery({ page: "-1" }).page).toBe(1);
    expect(parseUsersQuery({ page: "1e9" }).page).toBe(1);
    expect(parseUsersQuery({ q: "x".repeat(300) }).q).toHaveLength(100);
  });
});
