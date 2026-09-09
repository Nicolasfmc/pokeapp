import { requireUser } from "@/server/auth";
import {
  handleTrainingError,
  jsonOk,
  listMatches,
} from "@/modules/training";

export async function GET() {
  try {
    const user = await requireUser();
    const matches = await listMatches(user.id);
    return jsonOk({ matches });
  } catch (error) {
    return handleTrainingError(error);
  }
}
