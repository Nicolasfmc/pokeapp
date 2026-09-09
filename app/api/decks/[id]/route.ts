import { requireUser } from "@/server/auth";
import {
  deleteDeck,
  getDeck,
  handleDeckError,
  jsonOk,
  readJsonBody,
  updateDeck,
} from "@/modules/decks";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const deck = await getDeck(user.id, id);
    return jsonOk({ deck });
  } catch (error) {
    return handleDeckError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const deck = await updateDeck(user.id, id, body);
    return jsonOk({ deck });
  } catch (error) {
    return handleDeckError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteDeck(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleDeckError(error);
  }
}
