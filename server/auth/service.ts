import { prisma } from "@/server/database";
import { writeAuditLog } from "@/server/audit";
import { AccountStatus, Prisma } from "@prisma/client";
import { PASSWORD_MAX_LENGTH, USERNAME_CHANGE_COOLDOWN_MS } from "./constants";
import { hashPassword, validatePassword, verifyPassword, verifyAgainstDummyHash } from "./password";
import { endSession, reissueAccessToken, startSession } from "./session";
import { revokeUserSessions } from "./sessions";
import {
  LOGIN_FAILURE_LIMIT,
  consumeRateLimit,
  peekRateLimit,
  resetRateLimit,
} from "./rate-limit-db";
import type { SessionUser } from "./types";
import {
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validateUsername,
} from "./username";

export class AuthServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AuthServiceError";
    this.status = status;
    this.code = code;
  }
}

export class RateLimitedError extends AuthServiceError {
  readonly retryAfterSec: number;

  constructor(retryAfterSec: number) {
    super("Muitas requisições. Tente novamente em breve.", 429, "RATE_LIMITED");
    this.name = "RateLimitedError";
    this.retryAfterSec = retryAfterSec;
  }
}

const loginFailureKey = (email: string) => `login:fail:${email}`;

async function writeAudit(
  userId: string | null,
  action: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) {
  await writeAuditLog({
    userId,
    action,
    entity: "User",
    entityId,
    metadata,
  });
}

export async function registerUser(input: {
  email: string;
  username: string;
  password: string;
  displayName?: string;
}): Promise<SessionUser> {
  const emailError = validateEmail(input.email);
  if (emailError) {
    throw new AuthServiceError(emailError, 400, "INVALID_EMAIL");
  }

  const usernameError = validateUsername(input.username);
  if (usernameError) {
    throw new AuthServiceError(usernameError, 400, "INVALID_USERNAME");
  }

  const passwordError = validatePassword(input.password);
  if (passwordError) {
    throw new AuthServiceError(passwordError, 400, "INVALID_PASSWORD");
  }

  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const displayName =
    input.displayName?.trim() || username;
  const passwordHash = await hashPassword(input.password);

  try {
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        accountStatus: AccountStatus.ACTIVE,
        profile: {
          create: {
            displayName,
            isPublic: true,
          },
        },
      },
      select: { id: true, username: true },
    });

    const sessionId = await startSession(user, false);
    await writeAudit(user.id, "USER_REGISTERED", user.id, { username });
    return { id: user.id, username: user.username, sessionId };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.join(",")
        : String(error.meta?.target ?? "");
      if (target.includes("email")) {
        throw new AuthServiceError("E-mail já cadastrado.", 409, "EMAIL_TAKEN");
      }
      if (target.includes("username")) {
        throw new AuthServiceError(
          "Username já está em uso.",
          409,
          "USERNAME_TAKEN",
        );
      }
      throw new AuthServiceError("Dados já cadastrados.", 409, "CONFLICT");
    }
    console.error(error);
    throw new AuthServiceError(
      "Não foi possível criar a conta.",
      500,
      "REGISTER_FAILED",
    );
  }
}

export async function loginUser(input: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<SessionUser> {
  const emailError = validateEmail(input.email);
  if (emailError) {
    throw new AuthServiceError(emailError, 400, "INVALID_EMAIL");
  }

  if (
    typeof input.password !== "string" ||
    input.password.length === 0 ||
    input.password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new AuthServiceError(
      "Credenciais inválidas.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  const email = normalizeEmail(input.email);

  // Too many failed attempts for this account: refuse before checking the
  // password, so guessing can't continue from many IPs.
  const throttle = await peekRateLimit(loginFailureKey(email), LOGIN_FAILURE_LIMIT);
  if (!throttle.ok) {
    await writeAudit(null, "LOGIN_THROTTLED", email);
    throw new RateLimitedError(throttle.retryAfterSec);
  }
  const recordFailure = () => consumeRateLimit(loginFailureKey(email), LOGIN_FAILURE_LIMIT);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      accountStatus: true,
    },
  });

  if (!user) {
    // Same bcrypt cost as a real check, so response time doesn't reveal
    // whether the email is registered.
    await verifyAgainstDummyHash(input.password);
    await recordFailure();
    await writeAudit(null, "LOGIN_FAILED", email, { reason: "UNKNOWN_EMAIL" });
    throw new AuthServiceError(
      "Credenciais inválidas.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  if (user.accountStatus === AccountStatus.PERMANENTLY_DELETED) {
    await writeAudit(user.id, "LOGIN_FAILED", user.id, {
      reason: "ACCOUNT_DELETED",
    });
    throw new AuthServiceError(
      "Conta indisponível.",
      403,
      "ACCOUNT_DELETED",
    );
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    await recordFailure();
    await writeAudit(user.id, "LOGIN_FAILED", user.id, {
      reason: "BAD_PASSWORD",
    });
    throw new AuthServiceError(
      "Credenciais inválidas.",
      401,
      "INVALID_CREDENTIALS",
    );
  }

  await resetRateLimit(loginFailureKey(email));
  const sessionId = await startSession(user, Boolean(input.rememberMe));
  await writeAudit(user.id, "LOGIN_SUCCEEDED", user.id, { rememberMe: Boolean(input.rememberMe) });
  return { id: user.id, username: user.username, sessionId };
}

export async function logoutUser(): Promise<void> {
  await endSession();
}

export async function getAuthMe(session: SessionUser) {
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      username: true,
      accountStatus: true,
      usernameChangedAt: true,
      deletionRequestedAt: true,
      profile: {
        select: {
          displayName: true,
          bio: true,
          isPublic: true,
        },
      },
    },
  });

  if (!user || user.accountStatus === AccountStatus.PERMANENTLY_DELETED) {
    // Server components can't change cookies: revoke in the database so the
    // proxy stops refreshing the access token.
    await revokeUserSessions(session.id);
    throw new AuthServiceError("Sessão inválida.", 401, "INVALID_SESSION");
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    accountStatus: user.accountStatus,
    usernameChangedAt: user.usernameChangedAt,
    deletionRequestedAt: user.deletionRequestedAt,
    displayName: user.profile?.displayName ?? user.username,
    bio: user.profile?.bio ?? null,
    isPublic: user.profile?.isPublic ?? true,
  };
}

const DISPLAY_NAME_MAX = 60;
const BIO_MAX = 500;

/** §83 (display name livre), §84 (perfil público desabilitável), §86 (bio). */
export async function updateProfileSettings(
  session: SessionUser,
  input: { displayName?: unknown; bio?: unknown; isPublic?: unknown },
) {
  const data: { displayName?: string; bio?: string | null; isPublic?: boolean } = {};

  if (input.displayName !== undefined) {
    if (typeof input.displayName !== "string" || !input.displayName.trim()) {
      throw new AuthServiceError("Nome de exibição é obrigatório.", 400, "INVALID_DISPLAY_NAME");
    }
    const displayName = input.displayName.trim().replace(/\s+/g, " ");
    if (displayName.length > DISPLAY_NAME_MAX) {
      throw new AuthServiceError(
        `Nome de exibição deve ter até ${DISPLAY_NAME_MAX} caracteres.`,
        400,
        "INVALID_DISPLAY_NAME",
      );
    }
    data.displayName = displayName;
  }

  if (input.bio !== undefined) {
    if (input.bio !== null && typeof input.bio !== "string") {
      throw new AuthServiceError("Bio inválida.", 400, "INVALID_BIO");
    }
    const bio = typeof input.bio === "string" ? input.bio.trim() : "";
    if (bio.length > BIO_MAX) {
      throw new AuthServiceError(`Bio deve ter até ${BIO_MAX} caracteres.`, 400, "INVALID_BIO");
    }
    data.bio = bio || null;
  }

  if (input.isPublic !== undefined) {
    if (typeof input.isPublic !== "boolean") {
      throw new AuthServiceError("isPublic deve ser booleano.", 400, "INVALID_IS_PUBLIC");
    }
    data.isPublic = input.isPublic;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { accountStatus: true, username: true },
  });
  if (!user || user.accountStatus === AccountStatus.PERMANENTLY_DELETED) {
    throw new AuthServiceError("Conta indisponível.", 403, "ACCOUNT_DELETED");
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId: session.id },
    create: {
      userId: session.id,
      displayName: data.displayName ?? user.username,
      bio: data.bio ?? null,
      isPublic: data.isPublic ?? true,
    },
    update: data,
    select: { displayName: true, bio: true, isPublic: true },
  });

  if (data.isPublic !== undefined) {
    await writeAudit(
      session.id,
      data.isPublic ? "PUBLIC_PROFILE_ENABLED" : "PUBLIC_PROFILE_DISABLED",
      session.id,
    );
  }

  return profile;
}

export async function requestAccountDeletion(
  session: SessionUser,
): Promise<{ accountStatus: AccountStatus; deletionRequestedAt: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, accountStatus: true },
  });

  if (!user) {
    throw new AuthServiceError("Usuário não encontrado.", 404, "NOT_FOUND");
  }

  if (user.accountStatus === AccountStatus.PERMANENTLY_DELETED) {
    throw new AuthServiceError("Conta indisponível.", 403, "ACCOUNT_DELETED");
  }

  if (user.accountStatus === AccountStatus.DELETION_PENDING) {
    throw new AuthServiceError(
      "Exclusão já solicitada.",
      409,
      "DELETION_ALREADY_PENDING",
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.id },
    data: {
      // O perfil público já fica indisponível por accountStatus != ACTIVE (§93);
      // a preferência isPublic do usuário é preservada.
      accountStatus: AccountStatus.DELETION_PENDING,
      deletionRequestedAt: new Date(),
    },
    select: {
      accountStatus: true,
      deletionRequestedAt: true,
    },
  });

  // Sign out every other device; this one stays so the user can cancel.
  await revokeUserSessions(session.id, session.sessionId);
  await writeAudit(session.id, "ACCOUNT_DELETION_REQUESTED", session.id);

  return {
    accountStatus: updated.accountStatus,
    deletionRequestedAt: updated.deletionRequestedAt!,
  };
}

export async function cancelAccountDeletion(
  session: SessionUser,
): Promise<{ accountStatus: AccountStatus }> {
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, accountStatus: true },
  });

  if (!user) {
    throw new AuthServiceError("Usuário não encontrado.", 404, "NOT_FOUND");
  }

  if (user.accountStatus !== AccountStatus.DELETION_PENDING) {
    throw new AuthServiceError(
      "Não há exclusão pendente.",
      409,
      "NO_DELETION_PENDING",
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.id },
    data: {
      accountStatus: AccountStatus.ACTIVE,
      deletionRequestedAt: null,
    },
    select: { accountStatus: true },
  });

  await writeAudit(session.id, "ACCOUNT_DELETION_CANCELLED", session.id);

  return { accountStatus: updated.accountStatus };
}

export async function changeUsername(
  session: SessionUser,
  nextUsernameRaw: string,
): Promise<SessionUser> {
  const usernameError = validateUsername(nextUsernameRaw);
  if (usernameError) {
    throw new AuthServiceError(usernameError, 400, "INVALID_USERNAME");
  }

  const nextUsername = normalizeUsername(nextUsernameRaw);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      username: true,
      usernameChangedAt: true,
      accountStatus: true,
    },
  });

  if (!user) {
    throw new AuthServiceError("Usuário não encontrado.", 404, "NOT_FOUND");
  }

  if (user.accountStatus !== AccountStatus.ACTIVE) {
    throw new AuthServiceError(
      "Conta não pode alterar username neste estado.",
      403,
      "ACCOUNT_NOT_ACTIVE",
    );
  }

  if (user.username === nextUsername) {
    throw new AuthServiceError(
      "O novo username é igual ao atual.",
      400,
      "USERNAME_UNCHANGED",
    );
  }

  if (user.usernameChangedAt) {
    const elapsed = Date.now() - user.usernameChangedAt.getTime();
    if (elapsed < USERNAME_CHANGE_COOLDOWN_MS) {
      const remainingDays = Math.ceil(
        (USERNAME_CHANGE_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000),
      );
      throw new AuthServiceError(
        `Username só pode ser alterado a cada 3 meses. Aguarde cerca de ${remainingDays} dia(s).`,
        429,
        "USERNAME_CHANGE_COOLDOWN",
      );
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: session.id },
      data: {
        username: nextUsername,
        usernameChangedAt: new Date(),
      },
      select: { id: true, username: true },
    });

    const nextSession = { id: updated.id, username: updated.username, sessionId: session.sessionId };
    await reissueAccessToken(nextSession);
    await writeAudit(session.id, "USERNAME_CHANGED", session.id, {
      from: user.username,
      to: nextUsername,
    });
    return nextSession;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AuthServiceError(
        "Username já está em uso.",
        409,
        "USERNAME_TAKEN",
      );
    }
    console.error(error);
    throw new AuthServiceError(
      "Não foi possível alterar o username.",
      500,
      "USERNAME_CHANGE_FAILED",
    );
  }
}
