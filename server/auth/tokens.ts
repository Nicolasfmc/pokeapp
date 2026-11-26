/**
 * Token primitives. No `next/headers` here: used by the proxy, route handlers
 * and server components alike.
 */
import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from "./constants";

export type AccessTokenClaims = {
  /** User id (JWT `sub`). */
  id: string;
  username: string;
  /** user_sessions.id the token was issued for. */
  sessionId: string;
};

const MIN_SECRET_LENGTH = 32;

function getSecretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`AUTH_SECRET missing or shorter than ${MIN_SECRET_LENGTH} characters`);
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ username: claims.username, sid: claims.sessionId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.id)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setJti(randomBytes(12).toString("base64url"))
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

/** Returns the claims of a valid, unexpired access token; otherwise null. */
export async function verifyAccessToken(
  token: string | undefined | null,
): Promise<AccessTokenClaims | null> {
  if (!token || token.length > 4096) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: 5,
    });
    const { sub, username, sid } = payload;
    if (typeof sub !== "string" || typeof username !== "string" || typeof sid !== "string") {
      return null;
    }
    return { id: sub, username, sessionId: sid };
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const REFRESH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedRefreshToken(token: string | undefined | null): token is string {
  return typeof token === "string" && REFRESH_TOKEN_PATTERN.test(token);
}

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export function authCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}
