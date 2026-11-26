import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildContentSecurityPolicy,
  clientIpFromHeaders,
  isCrossSiteMutation,
  isIpAllowed,
} from "@/lib/security";
import { ADMIN_COOKIE_NAME, verifyAdminToken } from "@/lib/token";

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/robots.txt"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Optional IP allowlist: anyone else doesn't even learn the panel exists.
  if (!isIpAllowed(clientIpFromHeaders(request.headers), process.env.ADMIN_ALLOWED_IPS)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isCrossSiteMutation(request.method, request.headers, request.nextUrl.host)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Cheap signature/expiry check here; pages also confirm admin rights in the DB.
  if (!PUBLIC_PATHS.has(pathname)) {
    const userId = await verifyAdminToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
    if (!userId) {
      if (pathname.startsWith("/api/")) return new NextResponse("Unauthorized", { status: 401 });
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildContentSecurityPolicy(nonce, process.env.NODE_ENV !== "production");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
