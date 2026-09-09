import { loginUser } from "@/server/auth";
import { handleAuthError, jsonOk, readJsonBody } from "@/server/auth/http";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
} from "@/server/rate-limit";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "auth:login", AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    const body = await readJsonBody<{
      email?: string;
      password?: string;
    }>(request);

    const session = await loginUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? ""),
    });

    return jsonOk({ user: session });
  } catch (error) {
    return handleAuthError(error);
  }
}
