import { requireUser } from "@/server/auth";
import {
  cardsJsonOk,
  handleCardsError,
  listSets,
  parseSetListParams,
} from "@/modules/cards";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const params = parseSetListParams(searchParams);
    const result = await listSets(params);
    return cardsJsonOk(result);
  } catch (error) {
    return handleCardsError(error);
  }
}
