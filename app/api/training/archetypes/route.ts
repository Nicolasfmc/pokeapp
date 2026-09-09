import { requireUser } from "@/server/auth";
import {
  createArchetype,
  handleTrainingError,
  jsonOk,
  listArchetypes,
  readJsonBody,
} from "@/modules/training";
import { MatchServiceError } from "@/server/services/match";

export async function GET(request: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? undefined;
    const archetypes = await listArchetypes(q);
    return jsonOk({ archetypes });
  } catch (error) {
    return handleTrainingError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const body = await readJsonBody(request);
    if (typeof body.name !== "string") {
      throw new MatchServiceError(
        "Nome do arquétipo é obrigatório.",
        400,
        "INVALID_NAME",
      );
    }
    const archetype = await createArchetype({
      name: body.name,
      displayPokemon: body.displayPokemon,
    });
    return jsonOk({ archetype }, 201);
  } catch (error) {
    return handleTrainingError(error);
  }
}
