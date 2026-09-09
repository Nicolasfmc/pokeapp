import { requireUser } from "@/server/auth";
import {
  cardsJsonOk,
  getLogicalById,
  handleCardsError,
} from "@/modules/cards";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    const logical = await getLogicalById(id);
    return cardsJsonOk({ logical });
  } catch (error) {
    return handleCardsError(error);
  }
}
