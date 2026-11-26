/**
 * Revocable sessions and the database rate limiter against real PostgreSQL.
 * Runs only with RUN_DB_TESTS=1.
 */
import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

config();
const RUN = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!RUN)("integração: sessões e rate limit", async () => {
  process.env.AUTH_SECRET ??= "integration-secret-long-enough-0123456789abcdef";
  const { prisma } = await import("@/server/database");
  const sessions = await import("@/server/auth/sessions");
  const { verifyAccessToken, hashRefreshToken } = await import("@/server/auth/tokens");
  const { consumeRateLimit, peekRateLimit, resetRateLimit } = await import(
    "@/server/auth/rate-limit-db"
  );

  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let user: { id: string; username: string };

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        email: `sess-${suffix}@sleevebuild.test`,
        username: `s${suffix}`.slice(0, 20),
        passwordHash: "x",
      },
      select: { id: true, username: true },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.authRateLimit.deleteMany({ where: { key: { contains: suffix } } });
  });

  it("issues a 1-day session, or 7 days with remember me", async () => {
    const day = await sessions.createUserSession({ user, rememberMe: false });
    const week = await sessions.createUserSession({ user, rememberMe: true });
    expect(day.maxAgeSeconds).toBe(24 * 60 * 60);
    expect(week.maxAgeSeconds).toBe(7 * 24 * 60 * 60);

    const rows = await prisma.userSession.findMany({ where: { userId: user.id } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const dayMs = byId.get(day.sessionId)!.expiresAt.getTime() - Date.now();
    const weekMs = byId.get(week.sessionId)!.expiresAt.getTime() - Date.now();
    expect(Math.round(dayMs / 3600_000)).toBe(24);
    expect(Math.round(weekMs / 3600_000)).toBe(7 * 24);

    // The raw refresh token is never stored.
    expect(rows.some((r) => r.refreshTokenHash === day.refreshToken)).toBe(false);
    expect(byId.get(day.sessionId)!.refreshTokenHash).toBe(hashRefreshToken(day.refreshToken));

    expect(await verifyAccessToken(day.accessToken)).toEqual({
      id: user.id,
      username: user.username,
      sessionId: day.sessionId,
    });
  });

  it("refreshes until the session is revoked", async () => {
    const issued = await sessions.createUserSession({ user, rememberMe: false });
    const refreshed = await sessions.refreshAccessToken(issued.refreshToken);
    expect(refreshed?.sessionId).toBe(issued.sessionId);
    expect((await verifyAccessToken(refreshed!.accessToken))?.id).toBe(user.id);

    await sessions.revokeSessionByRefreshToken(issued.refreshToken);
    expect(await sessions.refreshAccessToken(issued.refreshToken)).toBeNull();
  });

  it("refuses expired sessions, unknown tokens and deleted accounts", async () => {
    const issued = await sessions.createUserSession({ user, rememberMe: false });
    await prisma.userSession.update({
      where: { id: issued.sessionId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await sessions.refreshAccessToken(issued.refreshToken)).toBeNull();
    expect(await sessions.refreshAccessToken("a".repeat(43))).toBeNull();

    const other = await sessions.createUserSession({ user, rememberMe: false });
    await prisma.user.update({ where: { id: user.id }, data: { accountStatus: "PERMANENTLY_DELETED" } });
    expect(await sessions.refreshAccessToken(other.refreshToken)).toBeNull();
    await prisma.user.update({ where: { id: user.id }, data: { accountStatus: "ACTIVE" } });
  });

  it("revokes every other session of a user", async () => {
    const keep = await sessions.createUserSession({ user, rememberMe: false });
    const drop = await sessions.createUserSession({ user, rememberMe: true });
    await sessions.revokeUserSessions(user.id, keep.sessionId);
    expect(await sessions.refreshAccessToken(keep.refreshToken)).not.toBeNull();
    expect(await sessions.refreshAccessToken(drop.refreshToken)).toBeNull();
  });

  it("rate limits across calls and resets", async () => {
    const key = `test:${suffix}`;
    const options = { limit: 3, windowSeconds: 60 };
    for (let i = 0; i < 3; i += 1) {
      expect((await consumeRateLimit(key, options)).ok).toBe(true);
    }
    const blocked = await consumeRateLimit(key, options);
    expect(blocked.ok).toBe(false);
    expect(blocked.ok === false && blocked.retryAfterSec).toBeGreaterThan(0);
    expect((await peekRateLimit(key, options)).ok).toBe(false);

    await resetRateLimit(key);
    expect((await peekRateLimit(key, options)).ok).toBe(true);
  });

  it("stores hostile keys as plain data", async () => {
    const key = `'); DROP TABLE users; -- ${suffix}`;
    expect((await consumeRateLimit(key, { limit: 5, windowSeconds: 60 })).ok).toBe(true);
    expect(await prisma.user.count()).toBeGreaterThan(0);
    await resetRateLimit(key);
  });
});
