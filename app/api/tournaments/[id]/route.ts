import { requireUser } from "@/server/auth";
import {
  deleteTournament,
  getTournament,
  handleTournamentError,
  jsonOk,
  readJsonBody,
  updateTournament,
} from "@/modules/tournaments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const tournament = await getTournament(user.id, id);
    return jsonOk({ tournament });
  } catch (error) {
    return handleTournamentError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const tournament = await updateTournament(user.id, id, {
      name: body.name as string | undefined,
      date: body.date === undefined ? undefined : (body.date as string | null),
      location:
        body.location === undefined
          ? undefined
          : (body.location as string | null),
      formatId:
        body.formatId === undefined
          ? undefined
          : (body.formatId as string | null),
      placement:
        body.placement === undefined
          ? undefined
          : (body.placement as number | null),
      participantCount:
        body.participantCount === undefined
          ? undefined
          : (body.participantCount as number | null),
    });
    return jsonOk({ tournament });
  } catch (error) {
    return handleTournamentError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteTournament(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleTournamentError(error);
  }
}
