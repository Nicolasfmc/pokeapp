/** Admin session token. Separate secret and audience from the main app. */
import { randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE_NAME = "sb_admin";
export const ADMIN_SESSION_SECONDS = 2 * 60 * 60;
const ISSUER = "sleevebuild";
const AUDIENCE = "sleevebuild-admin";

function secretKey() {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_JWT_SECRET missing or shorter than 32 characters");
  }
  if (secret === process.env.AUTH_SECRET) {
    throw new Error("ADMIN_JWT_SECRET must differ from the main app's AUTH_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export async function signAdminToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setJti(randomBytes(12).toString("base64url"))
    .setExpirationTime(`${ADMIN_SESSION_SECONDS}s`)
    .sign(secretKey());
}

/** Returns the user id of a valid, unexpired admin token; otherwise null. */
export async function verifyAdminToken(token: string | undefined | null): Promise<string | null> {
  if (!token || token.length > 2048) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      audience: AUDIENCE,
      requiredClaims: ["sub", "exp", "iat"],
      clockTolerance: 5,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export function adminCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge,
  };
}
