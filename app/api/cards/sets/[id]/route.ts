import { requireUser } from "@/server/auth";
import {
  cardsJsonOk,
  getSetById,
  handleCardsError,
} from "@/modules/cards";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    const set = await getSetById(id);
    return cardsJsonOk({ set });
  } catch (error) {
    return handleCardsError(error);
  }
}
