import { requireUser } from "@/server/auth";
import {
  handleTrainingError,
  importBattleLog,
  jsonOk,
  readJsonBody,
} from "@/modules/training";
import { MatchServiceError } from "@/server/services/match";
import type { MatchResult, TurnOrder } from "@prisma/client";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody(request);

    const rawLog = body.rawLog;
    if (typeof rawLog !== "string") {
      throw new MatchServiceError(
        "rawLog é obrigatório.",
        400,
        "EMPTY_RAW_LOG",
      );
    }

    const deckId = body.deckId;
    if (typeof deckId !== "string" || !deckId) {
      throw new MatchServiceError("deckId é obrigatório.", 400, "INVALID_DECK");
    }

    const viewerName =
      typeof body.viewerName === "string" && body.viewerName.trim()
        ? body.viewerName.trim()
        : user.username;

    const result = await importBattleLog(user.id, {
      rawLog,
      deckId,
      viewerName,
      opponentArchetypeId:
        body.opponentArchetypeId === undefined
          ? undefined
          : (body.opponentArchetypeId as string | null),
      opponentArchetypeName:
        body.opponentArchetypeName === undefined
          ? undefined
          : (body.opponentArchetypeName as string | null),
      notes:
        body.notes === undefined ? undefined : (body.notes as string | null),
      playedAt:
        body.playedAt === undefined
          ? undefined
          : (body.playedAt as string | null),
      result:
        body.result === undefined
          ? undefined
          : (body.result as MatchResult | null),
      turnOrder:
        body.turnOrder === undefined
          ? undefined
          : (body.turnOrder as TurnOrder | null),
    });

    return jsonOk(result, 201);
  } catch (error) {
    return handleTrainingError(error);
  }
}
