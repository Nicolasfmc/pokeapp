import { requireUser } from "@/server/auth";
import {
  changeEntryDeck,
  handleHostedError,
  joinHostedTournament,
  jsonOk,
  leaveHostedTournament,
  readBody,
  type CodeContext,
} from "@/modules/hosted-tournaments";

/** Join with an optional deck: { deckId }. */
export async function POST(request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    const body = await readBody(request);
    await joinHostedTournament(user.id, code, body.deckId ?? null);
    return jsonOk({ ok: true }, 201);
  } catch (error) {
    return handleHostedError(error);
  }
}

/** Change the registered deck before the start: { deckId }. */
export async function PATCH(request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    const body = await readBody(request);
    await changeEntryDeck(user.id, code, body.deckId ?? null);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}

/** Leave before the start, or drop during the tournament. */
export async function DELETE(_request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    await leaveHostedTournament(user.id, code);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}
