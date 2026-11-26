/**
 * Cookie helpers for route handlers and server actions (they use
 * `next/headers`). Server components may only read cookies.
 */
import { cookies, headers } from "next/headers";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  LEGACY_SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "./constants";
import { createUserSession, pruneOldSessions, revokeSessionByRefreshToken } from "./sessions";
import { authCookieOptions, signAccessToken } from "./tokens";
import { clientIpFromHeaders } from "@/server/request-info";

export async function startSession(
  user: { id: string; username: string },
  rememberMe: boolean,
): Promise<string> {
  const headerStore = await headers();
  const issued = await createUserSession({
    user,
    rememberMe,
    userAgent: headerStore.get("user-agent"),
    ipAddress: clientIpFromHeaders(headerStore),
  });
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, issued.accessToken, authCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
  cookieStore.set(REFRESH_COOKIE_NAME, issued.refreshToken, authCookieOptions(issued.maxAgeSeconds));
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
  // Housekeeping on sign-in keeps the table small without a cron job.
  if (Math.random() < 0.05) {
    await pruneOldSessions().catch((error) => console.error("pruneOldSessions", error));
  }
  return issued.sessionId;
}

/** Replaces the access token (e.g. after a username change) for the same session. */
export async function reissueAccessToken(user: { id: string; username: string; sessionId: string }) {
  const token = await signAccessToken(user);
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE_NAME, token, authCookieOptions(ACCESS_TOKEN_TTL_SECONDS));
}

/** Revokes the current session in the database and clears every auth cookie. */
export async function endSession(): Promise<void> {
  const cookieStore = await cookies();
  await revokeSessionByRefreshToken(cookieStore.get(REFRESH_COOKIE_NAME)?.value);
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
}

export async function readAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_COOKIE_NAME)?.value;
}
