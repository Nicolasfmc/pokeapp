import { requireUser } from "@/server/auth";
import {
  handleTrainingError,
  jsonOk,
  readJsonBody,
} from "@/modules/training";
import { previewBattleLog } from "@/server/services/match";

/** §68 — prévia do log (Pokémon detectados + arquétipo sugerido), sem persistir. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const viewerName =
      typeof body.viewerName === "string" && body.viewerName.trim()
        ? body.viewerName.trim()
        : user.username;
    const preview = await previewBattleLog({ rawLog: body.rawLog, viewerName });
    return jsonOk({ preview });
  } catch (error) {
    return handleTrainingError(error);
  }
}
