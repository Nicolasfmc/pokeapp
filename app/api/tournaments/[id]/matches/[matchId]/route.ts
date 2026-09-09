import { requireUser } from "@/server/auth";
import {
  detachMatch,
  handleTournamentError,
  jsonOk,
  readJsonBody,
  updateTournamentMatch,
} from "@/modules/tournaments";

type RouteContext = {
  params: Promise<{ id: string; matchId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, matchId } = await context.params;
    const body = await readJsonBody(request);
    const tournamentMatch = await updateTournamentMatch(user.id, id, matchId, {
      round: body.round === undefined ? undefined : (body.round as number | null),
    });
    return jsonOk({ tournamentMatch });
  } catch (error) {
    return handleTournamentError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id, matchId } = await context.params;
    await detachMatch(user.id, id, matchId);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleTournamentError(error);
  }
}
