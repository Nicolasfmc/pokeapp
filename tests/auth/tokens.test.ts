import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import {
  generateRefreshToken,
  hashRefreshToken,
  isWellFormedRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from "@/server/auth/tokens";
import { ACCESS_TOKEN_TTL_SECONDS } from "@/server/auth/constants";

const SECRET = "test-secret-that-is-long-enough-for-hs256-0123";
const claims = { id: "user_1", username: "ash", sessionId: "sess_1" };

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("access tokens", () => {
  it("round-trips the claims", async () => {
    const token = await signAccessToken(claims);
    expect(await verifyAccessToken(token)).toEqual(claims);
  });

  it("expires after the access TTL", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T12:00:00Z"));
    const token = await signAccessToken(claims);
    vi.setSystemTime(new Date(Date.now() + (ACCESS_TOKEN_TTL_SECONDS - 30) * 1000));
    expect(await verifyAccessToken(token)).not.toBeNull();
    vi.setSystemTime(new Date(Date.now() + 60 * 1000));
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it("rejects tampered tokens", async () => {
    const token = await signAccessToken(claims);
    const [header, payload, signature] = token.split(".");
    const forged = JSON.parse(Buffer.from(payload, "base64url").toString());
    forged.sub = "someone_else";
    const tampered = [header, Buffer.from(JSON.stringify(forged)).toString("base64url"), signature].join(".");
    expect(await verifyAccessToken(tampered)).toBeNull();
  });

  it("rejects tokens signed with another secret or for another audience", async () => {
    const otherKey = new TextEncoder().encode("another-secret-also-long-enough-0123456789");
    const wrongSecret = await new SignJWT({ username: "ash", sid: "s" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setIssuer("sleevebuild")
      .setAudience("sleevebuild-app")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(otherKey);
    expect(await verifyAccessToken(wrongSecret)).toBeNull();

    const adminAudience = await new SignJWT({ username: "ash", sid: "s" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("user_1")
      .setIssuer("sleevebuild")
      .setAudience("sleevebuild-admin")
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyAccessToken(adminAudience)).toBeNull();
  });

  it("rejects unsigned (alg: none) and garbage tokens", async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(
      JSON.stringify({ sub: "user_1", username: "ash", sid: "s", exp: 9999999999 }),
    ).toString("base64url")}.`;
    expect(await verifyAccessToken(none)).toBeNull();
    expect(await verifyAccessToken("not-a-jwt")).toBeNull();
    expect(await verifyAccessToken(undefined)).toBeNull();
    expect(await verifyAccessToken("x".repeat(5000))).toBeNull();
  });

  it("refuses to sign with a short secret", async () => {
    process.env.AUTH_SECRET = "short";
    await expect(signAccessToken(claims)).rejects.toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = SECRET;
  });
});

describe("refresh tokens", () => {
  it("are random, well-formed and stored only as a hash", () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(isWellFormedRefreshToken(a)).toBe(true);
    expect(hashRefreshToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashRefreshToken(a)).not.toContain(a);
  });

  it("rejects malformed values before touching the database", () => {
    expect(isWellFormedRefreshToken("' OR 1=1 --")).toBe(false);
    expect(isWellFormedRefreshToken("")).toBe(false);
    expect(isWellFormedRefreshToken(undefined)).toBe(false);
  });
});
