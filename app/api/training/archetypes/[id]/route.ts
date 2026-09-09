import { requireUser } from "@/server/auth";
import {
  handleTrainingError,
  jsonOk,
  readJsonBody,
  updateArchetype,
} from "@/modules/training";
import { MatchServiceError } from "@/server/services/match";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);

    if (body.name !== undefined && typeof body.name !== "string") {
      throw new MatchServiceError(
        "Nome do arquétipo inválido.",
        400,
        "INVALID_NAME",
      );
    }

    const archetype = await updateArchetype(id, {
      name: body.name as string | undefined,
      displayPokemon: body.displayPokemon,
    });
    return jsonOk({ archetype });
  } catch (error) {
    return handleTrainingError(error);
  }
}
