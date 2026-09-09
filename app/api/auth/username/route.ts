import { changeUsername, requireUser } from "@/server/auth";
import { handleAuthError, jsonOk, readJsonBody } from "@/server/auth/http";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
} from "@/server/rate-limit";

export async function PATCH(request: Request) {
  const limited = enforceRateLimit(request, "auth:username", AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    const session = await requireUser();
    const body = await readJsonBody<{ username?: string }>(request);
    const user = await changeUsername(session, String(body.username ?? ""));
    return jsonOk({ user });
  } catch (error) {
    return handleAuthError(error);
  }
}
