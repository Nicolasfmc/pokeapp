import { CollectionStatus } from "@prisma/client";
import { requireUser, UnauthorizedError } from "@/server/auth";
import { AuthServiceError } from "@/server/auth/service";
import { jsonError, jsonOk, readJsonBody } from "@/server/auth/http";
import {
  addInventoryStock,
  handleInventoryError,
  listInventoryItems,
  InventoryServiceError,
} from "@/server/services/inventory";

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

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("collectionStatus");
    const q = searchParams.get("q") ?? undefined;

    let collectionStatus: CollectionStatus | undefined;
    if (statusParam) {
      if (
        statusParam !== CollectionStatus.COMPETITIVE &&
        statusParam !== CollectionStatus.COLLECTION
      ) {
        throw new InventoryServiceError(
          "Status de coleção inválido.",
          400,
          "INVALID_COLLECTION_STATUS",
        );
      }
      collectionStatus = statusParam;
    }

    const items = await listInventoryItems(user.id, {
      collectionStatus,
      q,
    });

    return jsonOk({ items });
  } catch (error) {
    return respondError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody<Record<string, unknown>>(request);
    const item = await addInventoryStock(user.id, body);
    return jsonOk({ item }, 201);
  } catch (error) {
    return respondError(error);
  }
}
