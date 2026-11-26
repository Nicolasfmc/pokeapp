import { readAccessToken } from "./session";
import { verifyAccessToken } from "./tokens";
import type { SessionUser } from "./types";

/**
 * Current user from the access token. The proxy refreshes an expired access
 * token from the session cookie before the request reaches the app, so an
 * invalid or missing token here means "not signed in".
 */
export async function getSession(): Promise<SessionUser | null> {
  return verifyAccessToken(await readAccessToken());
}

export class UnauthorizedError extends Error {
  constructor(message = "Não autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}
