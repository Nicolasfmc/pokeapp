import { logoutUser } from "@/server/auth";
import { handleAuthError, jsonOk } from "@/server/auth/http";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
} from "@/server/rate-limit";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "auth:logout", AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    await logoutUser();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleAuthError(error);
  }
}
