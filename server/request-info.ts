type HeaderReader = { get(name: string): string | null };

const MAX_IP_LENGTH = 64;

/**
 * Client IP as seen by the platform. On Vercel `x-real-ip` and the first
 * `x-forwarded-for` entry are set by the edge and cannot be spoofed by clients.
 */
export function clientIpFromHeaders(headers: HeaderReader): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, MAX_IP_LENGTH);
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, MAX_IP_LENGTH);
  return "unknown";
}

export function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers);
}
