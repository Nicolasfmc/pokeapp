import { requireUser } from "@/server/auth";
import { finishHostedTournament, handleHostedError, jsonOk, type CodeContext } from "@/modules/hosted-tournaments";

export async function POST(_request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    await finishHostedTournament(user.id, code);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}
