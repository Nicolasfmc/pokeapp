import { getSession, requireUser } from "@/server/auth";
import {
  deleteHostedTournament,
  getHostedTournamentView,
  handleHostedError,
  jsonOk,
  readBody,
  updateHostedTournament,
  type CodeContext,
} from "@/modules/hosted-tournaments";

/** Public: anyone with the link can follow pairings and standings. */
export async function GET(_request: Request, context: CodeContext) {
  try {
    const { code } = await context.params;
    const session = await getSession();
    return jsonOk({ view: await getHostedTournamentView(code, session?.id ?? null) });
  } catch (error) {
    return handleHostedError(error);
  }
}

export async function PATCH(request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    await updateHostedTournament(user.id, code, await readBody(request));
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}

export async function DELETE(_request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    await deleteHostedTournament(user.id, code);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}
