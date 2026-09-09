import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/server/auth";
import { getDeck, jsonOk } from "@/modules/decks";
import {
  handleAllocationError,
  listDeckAllocations,
  sleeveDeck,
} from "@/server/services/allocation";

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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const allocations = await listDeckAllocations(user.id, id);
    return jsonOk({ allocations });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await sleeveDeck(user.id, id);
    const deck = await getDeck(user.id, id);
    return jsonOk({
      deck,
      allocations: result.allocations,
      physicalStatus: result.physicalStatus,
    });
  } catch (error) {
    return handleError(error);
  }
}
