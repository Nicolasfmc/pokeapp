import { requireUser } from "@/server/auth";
import {
  deleteMatch,
  getMatch,
  handleTrainingError,
  jsonOk,
  readJsonBody,
  updateMatch,
} from "@/modules/training";
import type { MatchResult, TurnOrder } from "@prisma/client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const match = await getMatch(user.id, id);
    return jsonOk({ match });
  } catch (error) {
    return handleTrainingError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);

    const match = await updateMatch(user.id, id, {
      deckId: body.deckId as string | undefined,
      opponentArchetypeId:
        body.opponentArchetypeId === undefined
          ? undefined
          : (body.opponentArchetypeId as string | null),
      opponentArchetypeName:
        body.opponentArchetypeName === undefined
          ? undefined
          : (body.opponentArchetypeName as string | null),
      result: body.result as MatchResult | undefined,
      turnOrder:
        body.turnOrder === undefined
          ? undefined
          : (body.turnOrder as TurnOrder | null),
      gameFormatCode:
        body.gameFormatCode === undefined
          ? undefined
          : (body.gameFormatCode as string | null),
      notes:
        body.notes === undefined ? undefined : (body.notes as string | null),
      playedAt:
        body.playedAt === undefined
          ? undefined
          : (body.playedAt as string | null),
    });

    return jsonOk({ match });
  } catch (error) {
    return handleTrainingError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteMatch(user.id, id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleTrainingError(error);
  }
}
