import { requireUser } from "@/server/auth";
import { handleHostedError, jsonOk, startNextRound, type CodeContext } from "@/modules/hosted-tournaments";

/** Organizer: pairs and starts the next Swiss round. */
export async function POST(_request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    await startNextRound(user.id, code);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}
