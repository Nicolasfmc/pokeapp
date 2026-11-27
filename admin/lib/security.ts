/** Pure helpers (no Next.js imports) shared by the proxy and route handlers. */

export function buildContentSecurityPolicy(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export const STATIC_SECURITY_HEADERS: Array<{ key: string; value: string }> = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  { key: "Cache-Control", value: "no-store" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
];

type HeaderReader = { get(name: string): string | null };

export function clientIpFromHeaders(headers: HeaderReader): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded ? forwarded.slice(0, 64) : "unknown";
}

/** Empty/unset allowlist = everyone may reach the login page. */
export function isIpAllowed(ip: string, allowlist: string | undefined): boolean {
  const allowed = (allowlist ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.length === 0 || allowed.includes(ip);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Any state-changing request must come from this same origin. */
export function isCrossSiteMutation(method: string, headers: HeaderReader, host: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  // Sec-Fetch-Site is set by the browser itself and can't be forged by
  // pages; when present it decides. Origin is the fallback for older browsers.
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "same-origin" && fetchSite !== "none";
  const origin = headers.get("origin");
  if (!origin) return false;
  if (origin === "null") return true;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Escapes LIKE wildcards so user input is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function parseUsersQuery(raw: Record<string, string | string[] | undefined>) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
  const q = first(raw.q).trim().slice(0, 100);
  const page = Number.parseInt(first(raw.page), 10);
  return { q, page: Number.isSafeInteger(page) && page > 1 && page < 100_000 ? page : 1 };
}

/** Same `q` + `page` parsing for every paginated list. */
export const parseListQuery = parseUsersQuery;

export type StandardChoice = "standard" | "not-standard" | "auto";

/** Form value → override stored on the set (null = back to automatic). */
export function parseStandardChoice(value: unknown): { override: boolean | null } | null {
  if (value === "standard") return { override: true };
  if (value === "not-standard") return { override: false };
  if (value === "auto") return { override: null };
  return null;
}

/** Prisma cuid ids: lowercase letters and digits only. */
export function isValidRecordId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]{20,40}$/.test(value);
}
