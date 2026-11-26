/**
 * Revocable login sessions (user_sessions). The refresh token is never stored:
 * only its SHA-256 hash. No `next/headers` here so the proxy can use it.
 */
import { AccountStatus } from "@prisma/client";
import { prisma } from "@/server/database";
import {
  REMEMBER_ME_SESSION_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from "./constants";
import {
  generateRefreshToken,
  hashRefreshToken,
  isWellFormedRefreshToken,
  signAccessToken,
} from "./tokens";

const LAST_USED_UPDATE_MS = 5 * 60 * 1000;

export function sessionTtlSeconds(rememberMe: boolean) {
  return rememberMe ? REMEMBER_ME_SESSION_TTL_SECONDS : SESSION_TTL_SECONDS;
}

export type IssuedSession = {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  /** Seconds until the session (and its refresh cookie) expires. */
  maxAgeSeconds: number;
};

export async function createUserSession(input: {
  user: { id: string; username: string };
  rememberMe: boolean;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<IssuedSession> {
  const refreshToken = generateRefreshToken();
  const maxAgeSeconds = sessionTtlSeconds(input.rememberMe);
  const session = await prisma.userSession.create({
    data: {
      userId: input.user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      rememberMe: input.rememberMe,
      expiresAt: new Date(Date.now() + maxAgeSeconds * 1000),
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      ipAddress: input.ipAddress?.slice(0, 64) ?? null,
    },
    select: { id: true },
  });
  const accessToken = await signAccessToken({
    id: input.user.id,
    username: input.user.username,
    sessionId: session.id,
  });
  return { sessionId: session.id, accessToken, refreshToken, maxAgeSeconds };
}

export type RefreshedAccess = {
  accessToken: string;
  user: { id: string; username: string };
  sessionId: string;
  /** Seconds left on the session; the refresh cookie keeps this max-age. */
  remainingSeconds: number;
};

/**
 * Issues a new access token for a valid refresh token. Returns null (and the
 * caller must clear the cookies) if the session is unknown, revoked, expired,
 * or the account was deleted.
 */
export async function refreshAccessToken(
  refreshToken: string | undefined | null,
): Promise<RefreshedAccess | null> {
  if (!isWellFormedRefreshToken(refreshToken)) return null;

  const session = await prisma.userSession.findUnique({
    where: { refreshTokenHash: hashRefreshToken(refreshToken) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      user: { select: { id: true, username: true, accountStatus: true } },
    },
  });

  const now = Date.now();
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= now ||
    session.user.accountStatus === AccountStatus.PERMANENTLY_DELETED
  ) {
    return null;
  }

  if (now - session.lastUsedAt.getTime() > LAST_USED_UPDATE_MS) {
    await prisma.userSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(now) },
    });
  }

  const user = { id: session.user.id, username: session.user.username };
  const accessToken = await signAccessToken({ ...user, sessionId: session.id });
  return {
    accessToken,
    user,
    sessionId: session.id,
    remainingSeconds: Math.max(1, Math.floor((session.expiresAt.getTime() - now) / 1000)),
  };
}

export async function revokeSessionByRefreshToken(refreshToken: string | undefined | null) {
  if (!isWellFormedRefreshToken(refreshToken)) return;
  await prisma.userSession.updateMany({
    where: { refreshTokenHash: hashRefreshToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revokes every session of a user, optionally keeping the current one. */
export async function revokeUserSessions(userId: string, exceptSessionId?: string) {
  await prisma.userSession.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

/** Removes sessions that expired or were revoked more than 30 days ago. */
export async function pruneOldSessions() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await prisma.userSession.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
}
