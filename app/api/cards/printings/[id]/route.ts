import { requireUser } from "@/server/auth";
import {
  cardsJsonOk,
  getPrintingById,
  handleCardsError,
} from "@/modules/cards";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    const printing = await getPrintingById(id);
    return cardsJsonOk({ printing });
  } catch (error) {
    return handleCardsError(error);
  }
}
