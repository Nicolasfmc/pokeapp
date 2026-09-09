import { requireUser } from "@/server/auth";
import {
  createDeck,
  handleDeckError,
  jsonOk,
  listDecks,
  readJsonBody,
} from "@/modules/decks";

export async function GET() {
  try {
    const user = await requireUser();
    const decks = await listDecks(user.id);
    return jsonOk({ decks });
  } catch (error) {
    return handleDeckError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const deck = await createDeck(user.id, body);
    return jsonOk({ deck }, 201);
  } catch (error) {
    return handleDeckError(error);
  }
}
