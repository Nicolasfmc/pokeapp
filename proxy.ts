import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_TTL_SECONDS,
  LEGACY_SESSION_COOKIE_NAME,
  REFRESH_COOKIE_NAME,
} from "@/server/auth/constants";
import { authCookieOptions, verifyAccessToken } from "@/server/auth/tokens";
import { refreshAccessToken } from "@/server/auth/sessions";
import { buildContentSecurityPolicy, isCrossSiteMutation } from "@/server/security";

const PUBLIC_PREFIXES = ["/login", "/register", "/user"];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

type AuthState =
  | { kind: "valid" }
  | { kind: "refreshed"; accessToken: string; refreshMaxAge: number; refreshToken: string }
  | { kind: "none"; clearCookies: boolean };

async function resolveAuth(request: NextRequest): Promise<AuthState> {
  const access = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  if (await verifyAccessToken(access)) return { kind: "valid" };

  const refreshToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
  if (!refreshToken) return { kind: "none", clearCookies: Boolean(access) };

  try {
    const refreshed = await refreshAccessToken(refreshToken);
    if (!refreshed) return { kind: "none", clearCookies: true };
    return {
      kind: "refreshed",
      accessToken: refreshed.accessToken,
      refreshMaxAge: refreshed.remainingSeconds,
      refreshToken,
    };
  } catch (error) {
    // Database hiccup: treat as signed out for this request, keep the cookies
    // so the next request can try again.
    console.error("proxy: refresh failed", error);
    return { kind: "none", clearCookies: false };
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (isApi && isCrossSiteMutation(request)) {
    return NextResponse.json(
      { error: "Origem não permitida.", code: "CSRF_REJECTED" },
      { status: 403 },
    );
  }

  const auth = await resolveAuth(request);
  const signedIn = auth.kind !== "none";

  if (!isApi) {
    if (isPublicPath(pathname)) {
      if (signedIn && (pathname === "/login" || pathname === "/register")) {
        return withAuthCookies(NextResponse.redirect(new URL("/", request.url)), request, auth);
      }
    } else if (!signedIn) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return withAuthCookies(NextResponse.redirect(loginUrl), request, auth);
    }
  }

  // A refreshed access token must be visible to the page/route rendering this
  // same request, so it goes on the forwarded request cookies too.
  if (auth.kind === "refreshed") {
    request.cookies.set(ACCESS_COOKIE_NAME, auth.accessToken);
  }

  const requestHeaders = new Headers(request.headers);
  let csp: string | null = null;
  if (!isApi) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", csp);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) response.headers.set("Content-Security-Policy", csp);
  return withAuthCookies(response, request, auth);
}

function withAuthCookies(response: NextResponse, request: NextRequest, auth: AuthState) {
  if (auth.kind === "refreshed") {
    response.cookies.set(
      ACCESS_COOKIE_NAME,
      auth.accessToken,
      authCookieOptions(ACCESS_TOKEN_TTL_SECONDS),
    );
    // Same token, same absolute expiry: the session isn't extended.
    response.cookies.set(REFRESH_COOKIE_NAME, auth.refreshToken, authCookieOptions(auth.refreshMaxAge));
  } else if (auth.kind === "none" && auth.clearCookies) {
    response.cookies.delete(ACCESS_COOKIE_NAME);
    response.cookies.delete(REFRESH_COOKIE_NAME);
  }
  if (request.cookies.has(LEGACY_SESSION_COOKIE_NAME)) {
    response.cookies.delete(LEGACY_SESSION_COOKIE_NAME);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
