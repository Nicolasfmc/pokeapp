import { loginUser } from "@/server/auth";
import { RateLimitedError } from "@/server/auth/service";
import { handleAuthError, jsonOk, readJsonBody } from "@/server/auth/http";
import { LOGIN_IP_LIMIT, consumeRateLimit } from "@/server/auth/rate-limit-db";
import { rateLimitResponse } from "@/server/rate-limit";
import { clientIp } from "@/server/request-info";

export async function POST(request: Request) {
  try {
    const limited = await consumeRateLimit(`login:ip:${clientIp(request)}`, LOGIN_IP_LIMIT);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const body = await readJsonBody<{
      email?: unknown;
      password?: unknown;
      rememberMe?: unknown;
    }>(request);

    const session = await loginUser({
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : "",
      rememberMe: body.rememberMe === true,
    });

    return jsonOk({ user: { id: session.id, username: session.username } });
  } catch (error) {
    if (error instanceof RateLimitedError) return rateLimitResponse(error.retryAfterSec);
    return handleAuthError(error);
  }
}
