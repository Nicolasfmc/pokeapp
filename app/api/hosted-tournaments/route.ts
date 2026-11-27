import { requireUser } from "@/server/auth";
import {
  createHostedTournament,
  handleHostedError,
  jsonOk,
  listMyHostedTournaments,
  readBody,
} from "@/modules/hosted-tournaments";

export async function GET() {
  try {
    const user = await requireUser();
    return jsonOk({ tournaments: await listMyHostedTournaments(user.id) });
  } catch (error) {
    return handleHostedError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await readBody(request);
    const created = await createHostedTournament(user.id, body);
    return jsonOk({ code: created.code }, 201);
  } catch (error) {
    return handleHostedError(error);
  }
}
