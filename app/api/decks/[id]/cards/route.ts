import { requireUser } from "@/server/auth";
import {
  handleDeckError,
  jsonOk,
  readJsonBody,
  replaceCards,
} from "@/modules/decks";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const result = await replaceCards(user.id, id, body.cards);
    return jsonOk(result);
  } catch (error) {
    return handleDeckError(error);
  }
}
