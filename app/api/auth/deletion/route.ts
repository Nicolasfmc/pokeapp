import { requestAccountDeletion, requireUser } from "@/server/auth";
import { handleAuthError, jsonOk } from "@/server/auth/http";
import {
  AUTH_RATE_LIMIT,
  enforceRateLimit,
} from "@/server/rate-limit";

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "auth:deletion", AUTH_RATE_LIMIT);
  if (limited) return limited;

  try {
    const session = await requireUser();
    const result = await requestAccountDeletion(session);
    return jsonOk(result);
  } catch (error) {
    return handleAuthError(error);
  }
}
