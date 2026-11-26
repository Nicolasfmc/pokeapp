import { registerUser } from "@/server/auth";
import { handleAuthError, jsonOk, readJsonBody } from "@/server/auth/http";
import { REGISTER_IP_LIMIT, consumeRateLimit } from "@/server/auth/rate-limit-db";
import { rateLimitResponse } from "@/server/rate-limit";
import { clientIp } from "@/server/request-info";

export async function POST(request: Request) {
  try {
    const limited = await consumeRateLimit(`register:ip:${clientIp(request)}`, REGISTER_IP_LIMIT);
    if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

    const body = await readJsonBody<{
      email?: unknown;
      username?: unknown;
      password?: unknown;
      displayName?: unknown;
    }>(request);

    const session = await registerUser({
      email: typeof body.email === "string" ? body.email : "",
      username: typeof body.username === "string" ? body.username : "",
      password: typeof body.password === "string" ? body.password : "",
      displayName:
        typeof body.displayName === "string" ? body.displayName : undefined,
    });

    return jsonOk({ user: { id: session.id, username: session.username } }, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}
