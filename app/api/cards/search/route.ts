import { requireUser } from "@/server/auth";
import {
  handleCardsError,
  cardsJsonOk,
  parseCardSearchParams,
  searchCards,
} from "@/modules/cards";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const params = parseCardSearchParams(searchParams);
    const result = await searchCards(params);
    return cardsJsonOk(result);
  } catch (error) {
    return handleCardsError(error);
  }
}
