import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { query } from "./db";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "./token";

export type AdminUser = { id: string; username: string; email: string };

/**
 * Valid token AND, checked in the database on every request, the account is
 * still an active admin. Removing `isAdmin` locks the person out immediately.
 */
export async function getAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const userId = await verifyAdminToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  if (!userId) return null;
  const rows = await query<AdminUser>(
    `SELECT id, username, email FROM users
      WHERE id = $1 AND "isAdmin" = true AND "accountStatus" = 'ACTIVE'`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}
