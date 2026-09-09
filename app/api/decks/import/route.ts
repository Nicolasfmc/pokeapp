import { requireUser } from "@/server/auth";
import {
  handleDeckError,
  importLimitlessDeck,
  jsonOk,
  readJsonBody,
} from "@/modules/decks";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const result = await importLimitlessDeck(user.id, body);
    return jsonOk(result, 201);
  } catch (error) {
    return handleDeckError(error);
  }
}
