import { requireUser, UnauthorizedError } from "@/server/auth";
import { AuthServiceError } from "@/server/auth/service";
import { jsonError, jsonOk, readJsonBody } from "@/server/auth/http";
import {
  adjustInventoryItem,
  getInventoryItem,
  handleInventoryError,
} from "@/server/services/inventory";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function respondError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return jsonError(error.message, 401, "UNAUTHORIZED");
  }
  if (error instanceof AuthServiceError) {
    return jsonError(error.message, error.status, error.code);
  }
  const inventoryError = handleInventoryError(error);
  if (inventoryError) {
    return jsonError(
      inventoryError.message,
      inventoryError.status,
      inventoryError.code,
    );
  }
  console.error(error);
  return jsonError("Erro interno.", 500, "INTERNAL");
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const item = await getInventoryItem(user.id, id);
    return jsonOk({ item });
  } catch (error) {
    return respondError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody<Record<string, unknown>>(request);
    const item = await adjustInventoryItem(user.id, id, body);
    return jsonOk({ item });
  } catch (error) {
    return respondError(error);
  }
}
