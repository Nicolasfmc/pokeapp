import { registerUser } from "@/server/auth";
import { handleAuthError, jsonOk, readJsonBody } from "@/server/auth/http";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
} from "@/server/rate-limit";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "auth:register", AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    const body = await readJsonBody<{
      email?: string;
      username?: string;
      password?: string;
      displayName?: string;
    }>(request);

    const session = await registerUser({
      email: String(body.email ?? ""),
      username: String(body.username ?? ""),
      password: String(body.password ?? ""),
      displayName:
        typeof body.displayName === "string" ? body.displayName : undefined,
    });

    return jsonOk({ user: session }, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}
