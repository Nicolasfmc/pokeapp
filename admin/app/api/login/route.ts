import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import {
  ADMIN_LOGIN_IP_LIMIT,
  LOGIN_FAILURE_LIMIT,
  consume,
  failureKey,
  ipKey,
  isUnderLimit,
} from "@/lib/rate-limit";
import { clientIpFromHeaders } from "@/lib/security";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_SECONDS,
  adminCookieOptions,
  signAdminToken,
} from "@/lib/token";

const MAX_FORM_BYTES = 8 * 1024;
const MAX_PASSWORD_LENGTH = 128;

let dummyHash: Promise<string> | null = null;
/** Same bcrypt cost for unknown emails, so timing doesn't reveal accounts. */
async function compareDummy(password: string) {
  dummyHash ??= bcrypt.hash("sleevebuild-admin-dummy", 12);
  await bcrypt.compare(password, await dummyHash);
}

function backToLogin(request: Request, error: "invalid" | "rate") {
  return NextResponse.redirect(new URL(`/login?error=${error}`, request.url), 303);
}

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  try {
    if (Number(request.headers.get("content-length")) > MAX_FORM_BYTES) {
      return backToLogin(request, "invalid");
    }
    if (!(await consume(ipKey(ip), ADMIN_LOGIN_IP_LIMIT))) {
      console.warn("admin login rate limited", { ip });
      return backToLogin(request, "rate");
    }

    const form = await request.formData();
    const emailRaw = form.get("email");
    const passwordRaw = form.get("password");
    const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase().slice(0, 254) : "";
    const password = typeof passwordRaw === "string" ? passwordRaw : "";
    if (!email || !password || password.length > MAX_PASSWORD_LENGTH) {
      return backToLogin(request, "invalid");
    }

    if (!(await isUnderLimit(failureKey(email), LOGIN_FAILURE_LIMIT))) {
      console.warn("admin login throttled for account", { ip });
      return backToLogin(request, "rate");
    }

    const [user] = await query<{
      id: string;
      passwordHash: string;
      isAdmin: boolean;
      accountStatus: string;
    }>(
      `SELECT id, "passwordHash", "isAdmin", "accountStatus" FROM users WHERE email = $1`,
      [email],
    );

    let passwordOk = false;
    if (user) {
      passwordOk = await bcrypt.compare(password, user.passwordHash);
    } else {
      await compareDummy(password);
    }

    if (!passwordOk) {
      await consume(failureKey(email), LOGIN_FAILURE_LIMIT);
    }
    // Same answer for every failure: wrong password, unknown email, or an
    // account that isn't an active admin.
    if (!user || !passwordOk || !user.isAdmin || user.accountStatus !== "ACTIVE") {
      console.warn("admin login refused", { ip, known: Boolean(user), passwordOk });
      return backToLogin(request, "invalid");
    }

    const token = await signAdminToken(user.id);
    const response = NextResponse.redirect(new URL("/", request.url), 303);
    response.cookies.set(ADMIN_COOKIE_NAME, token, adminCookieOptions(ADMIN_SESSION_SECONDS));
    console.info("admin login", { userId: user.id, ip });
    return response;
  } catch (error) {
    console.error("admin login failed", error);
    return backToLogin(request, "invalid");
  }
}
