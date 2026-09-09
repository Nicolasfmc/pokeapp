import { requireUser } from "@/server/auth";
import {
  getStatisticsSummary,
  handleStatisticsError,
  jsonOk,
  type StatisticsFilters,
} from "@/modules/statistics";

function parseFilters(url: URL): StatisticsFilters {
  const filters: StatisticsFilters = {};
  const deckId = url.searchParams.get("deckId");
  const opponentArchetypeId = url.searchParams.get("opponentArchetypeId");
  const gameFormatCode = url.searchParams.get("gameFormatCode");
  const tournamentId = url.searchParams.get("tournamentId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (deckId) filters.deckId = deckId;
  if (opponentArchetypeId) filters.opponentArchetypeId = opponentArchetypeId;
  if (gameFormatCode) filters.gameFormatCode = gameFormatCode;
  if (tournamentId) filters.tournamentId = tournamentId;
  if (from) filters.from = from;
  if (to) filters.to = to;

  return filters;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const summary = await getStatisticsSummary(user.id, parseFilters(url));
    return jsonOk(summary);
  } catch (error) {
    return handleStatisticsError(error);
  }
}
