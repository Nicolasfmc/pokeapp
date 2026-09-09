import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/server/auth";
import { getDeck, jsonOk, readJsonBody, DeckServiceError } from "@/modules/decks";
import { handleAllocationError } from "@/server/services/allocation";
import { transferSleevedDeck } from "@/server/services/transfer";

type RouteContext = { params: Promise<{ id: string }> };

function handleError(error: unknown) {
  const allocation = handleAllocationError(error);
  if (allocation) {
    return NextResponse.json(
      {
        error: allocation.message,
        code: allocation.code,
        shortages: allocation.shortages,
      },
      { status: allocation.status },
    );
  }
  if (error instanceof DeckServiceError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message, code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }
  console.error(error);
  return NextResponse.json(
    { error: "Erro interno.", code: "INTERNAL" },
    { status: 500 },
  );
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id: targetDeckId } = await context.params;
    const body = await readJsonBody<{ sourceDeckId?: unknown }>(request);
    const sourceDeckId =
      typeof body.sourceDeckId === "string" ? body.sourceDeckId : "";

    const result = await transferSleevedDeck(
      user.id,
      targetDeckId,
      sourceDeckId,
    );

    const [sourceDeck, targetDeck] = await Promise.all([
      getDeck(user.id, result.sourceDeckId),
      getDeck(user.id, result.targetDeckId),
    ]);

    return jsonOk({
      sourceDeck,
      targetDeck,
      allocations: result.allocations,
      sourcePhysicalStatus: result.sourcePhysicalStatus,
      targetPhysicalStatus: result.targetPhysicalStatus,
    });
  } catch (error) {
    return handleError(error);
  }
}
