import bcrypt from "bcryptjs";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./constants";

const SALT_ROUNDS = 12;

export function validatePassword(password: string): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
    return `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

let dummyHash: Promise<string> | null = null;

/** Spends the same time as a real check, for unknown accounts. */
export async function verifyAgainstDummyHash(password: string): Promise<void> {
  dummyHash ??= bcrypt.hash("sleevebuild-dummy-password", SALT_ROUNDS);
  await bcrypt.compare(password, await dummyHash);
}
