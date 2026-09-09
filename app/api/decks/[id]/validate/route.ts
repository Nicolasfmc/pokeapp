import { requireUser } from "@/server/auth";
import { handleDeckError, jsonOk, validateDeck } from "@/modules/decks";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await validateDeck(user.id, id);
    return jsonOk(result);
  } catch (error) {
    return handleDeckError(error);
  }
}
