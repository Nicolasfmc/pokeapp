/**
 * HTTP security policies shared by the proxy and next.config.
 * Pure functions (no Next.js imports) so they are unit-testable.
 */

/**
 * Content-Security-Policy with a per-request nonce. Scripts only run from this
 * origin or with the nonce (Next.js and Mantine's color-scheme script receive
 * it), so injected markup can't execute JavaScript.
 *
 * Styles keep 'unsafe-inline': Mantine sets style attributes, which nonces
 * can't cover, and CSS can't run code.
 */
export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://assets.tcgdex.net",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ];
  // HTTPS is enforced by HSTS (STATIC_SECURITY_HEADERS).
  return directives.join("; ");
}

/** Headers applied to every response (see next.config.ts). */
export const STATIC_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

type RequestLike = {
  method: string;
  headers: { get(name: string): string | null };
  nextUrl: { host: string };
};

/**
 * CSRF guard for state-changing API calls: browsers always send `Origin` (and
 * `Sec-Fetch-Site`) on cross-site requests, so anything not from this host is
 * refused. Requests without those headers aren't from a browser and carry no
 * victim cookies.
 */
export function isCrossSiteMutation(request: RequestLike): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return true;

  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (origin === "null") return true;
  try {
    return new URL(origin).host !== request.nextUrl.host;
  } catch {
    return true;
  }
}

/**
 * Where to go after sign-in. Only same-site paths are accepted: "//evil.com",
 * "/\\evil.com" or absolute URLs would send the user to another site.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/"): string {
  if (!value || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "http://localhost");
    if (url.origin !== "http://localhost") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
