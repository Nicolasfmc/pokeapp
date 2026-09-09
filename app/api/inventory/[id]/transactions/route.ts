import { requireUser, UnauthorizedError } from "@/server/auth";
import { jsonError, jsonOk } from "@/server/auth/http";
import {
  handleInventoryError,
  listInventoryTransactions,
} from "@/server/services/inventory";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function respondError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return jsonError(error.message, 401, "UNAUTHORIZED");
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
    const transactions = await listInventoryTransactions(user.id, id);
    return jsonOk({ transactions });
  } catch (error) {
    return respondError(error);
  }
}
