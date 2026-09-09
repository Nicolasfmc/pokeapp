import { requireUser, UnauthorizedError } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/auth/http";
import { getLogicalAvailability } from "@/server/services/availability";

type RouteContext = {
  params: Promise<{ logicalCardId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { logicalCardId } = await context.params;

    if (!logicalCardId?.trim()) {
      return jsonError("logicalCardId obrigatório.", 400, "INVALID_LOGICAL_ID");
    }

    const availability = await getLogicalAvailability(
      user.id,
      logicalCardId.trim(),
    );
    return jsonOk({ availability });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError(error.message, 401, "UNAUTHORIZED");
    }
    console.error(error);
    return jsonError("Erro interno.", 500, "INTERNAL");
  }
}
