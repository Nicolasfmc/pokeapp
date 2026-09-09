import { requireUser } from "@/server/auth";
import { handleDeckError, jsonOk, listFormats } from "@/modules/decks";

export async function GET() {
  try {
    await requireUser();
    const formats = await listFormats();
    return jsonOk({ formats });
  } catch (error) {
    return handleDeckError(error);
  }
}
