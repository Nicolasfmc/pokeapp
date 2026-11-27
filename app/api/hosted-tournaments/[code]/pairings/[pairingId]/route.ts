import { requireUser } from "@/server/auth";
import {
  HostedTournamentError,
  handleHostedError,
  judgeResult,
  jsonOk,
  readBody,
  reportResult,
  respondToReport,
} from "@/modules/hosted-tournaments";

type Context = { params: Promise<{ code: string; pairingId: string }> };

/**
 * { action: "report", myGames, opponentGames, drawGames }
 * { action: "confirm" } | { action: "dispute" }
 * { action: "judge", player1Games, player2Games, drawGames } | { action: "judge", reset: true }
 */
export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { code, pairingId } = await context.params;
    const body = await readBody(request);
    switch (body.action) {
      case "report":
        await reportResult(user.id, code, pairingId, body);
        break;
      case "confirm":
        await respondToReport(user.id, code, pairingId, true);
        break;
      case "dispute":
        await respondToReport(user.id, code, pairingId, false);
        break;
      case "judge":
        await judgeResult(user.id, code, pairingId, body);
        break;
      default:
        throw new HostedTournamentError("Ação inválida.", 400, "INVALID_INPUT");
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}
