import {
  clearSessionCookie,
  decryptSession,
  readSessionToken,
} from "./session";
import type { SessionUser } from "./types";

export async function getSession(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) {
    return null;
  }

  const session = await decryptSession(token);
  if (!session) {
    await clearSessionCookie();
    return null;
  }

  return session;
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
