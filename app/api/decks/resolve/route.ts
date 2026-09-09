import { requireUser } from "@/server/auth";
import {
  handleDeckError,
  jsonOk,
  readJsonBody,
  resolvePrintingLine,
} from "@/modules/decks";

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = await readJsonBody(request);
    const card = await resolvePrintingLine(body);
    return jsonOk({ card });
  } catch (error) {
    return handleDeckError(error);
  }
}
