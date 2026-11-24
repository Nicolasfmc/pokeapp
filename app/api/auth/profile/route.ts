import { requireUser } from "@/server/auth";
import { updateProfileSettings } from "@/server/auth/service";
import { handleAuthError, jsonOk, readJsonBody } from "@/server/auth/http";
import { AUTH_RATE_LIMIT, enforceRateLimit } from "@/server/rate-limit";

/** PATCH { displayName?, bio?, isPublic? } — §83, §84, §86. */
export async function PATCH(request: Request) {
  const limited = enforceRateLimit(request, "auth:profile", AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    const session = await requireUser();
    const body = await readJsonBody<Record<string, unknown>>(request);
    const profile = await updateProfileSettings(session, body);
    return jsonOk({ profile });
  } catch (error) {
    return handleAuthError(error);
  }
}
