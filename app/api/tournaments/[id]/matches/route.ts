import { requireUser } from "@/server/auth";
import {
  attachMatch,
  handleTournamentError,
  jsonOk,
  readJsonBody,
} from "@/modules/tournaments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const tournamentMatch = await attachMatch(user.id, id, {
      matchId: body.matchId as string,
      round: body.round === undefined ? undefined : (body.round as number | null),
    });
    return jsonOk({ tournamentMatch }, 201);
  } catch (error) {
    return handleTournamentError(error);
  }
}
