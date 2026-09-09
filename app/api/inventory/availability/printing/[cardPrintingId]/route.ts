import { requireUser, UnauthorizedError } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/auth/http";
import { getPrintingAvailability } from "@/server/services/availability";

type RouteContext = {
  params: Promise<{ cardPrintingId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { cardPrintingId } = await context.params;

    if (!cardPrintingId?.trim()) {
      return jsonError(
        "cardPrintingId obrigatório.",
        400,
        "INVALID_PRINTING_ID",
      );
    }

    const availability = await getPrintingAvailability(
      user.id,
      cardPrintingId.trim(),
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
