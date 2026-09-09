import { requireUser } from "@/server/auth";
import {
  createTournament,
  handleTournamentError,
  jsonOk,
  listTournaments,
  readJsonBody,
} from "@/modules/tournaments";

export async function GET() {
  try {
    const user = await requireUser();
    const tournaments = await listTournaments(user.id);
    return jsonOk({ tournaments });
  } catch (error) {
    return handleTournamentError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const tournament = await createTournament(user.id, {
      name: body.name as string,
      date: body.date === undefined ? undefined : (body.date as string | null),
      location:
        body.location === undefined
          ? undefined
          : (body.location as string | null),
      formatId:
        body.formatId === undefined
          ? undefined
          : (body.formatId as string | null),
      placement:
        body.placement === undefined
          ? undefined
          : (body.placement as number | null),
      participantCount:
        body.participantCount === undefined
          ? undefined
          : (body.participantCount as number | null),
    });
    return jsonOk({ tournament }, 201);
  } catch (error) {
    return handleTournamentError(error);
  }
}
