import { getAuthMe, getSession } from "@/server/auth";
import { handleAuthError, jsonError, jsonOk } from "@/server/auth/http";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
} from "@/server/rate-limit";

export async function GET(request: Request) {
  const limited = enforceRateLimit(request, "auth:me", AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    const session = await getSession();
    if (!session) {
      return jsonError("Não autenticado", 401, "UNAUTHORIZED");
    }

    const user = await getAuthMe(session);
    return jsonOk({ user });
  } catch (error) {
    return handleAuthError(error);
  }
}
