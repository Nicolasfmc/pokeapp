import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/server/auth";
import {
  getDeckInventoryCheck,
  InventoryCheckError,
} from "@/server/services/inventory-check";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const inventoryCheck = await getDeckInventoryCheck(user.id, id);
    return NextResponse.json({ inventoryCheck });
  } catch (error) {
    if (error instanceof InventoryCheckError) {
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
}
