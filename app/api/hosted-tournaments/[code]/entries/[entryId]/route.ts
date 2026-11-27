import { requireUser } from "@/server/auth";
import { handleHostedError, jsonOk, manageEntry, readBody } from "@/modules/hosted-tournaments";

type Context = { params: Promise<{ code: string; entryId: string }> };

/** Organizer: { action: "remove" | "drop" | "reinstate" } */
export async function POST(request: Request, context: Context) {
  try {
    const user = await requireUser();
    const { code, entryId } = await context.params;
    const body = await readBody(request);
    await manageEntry(user.id, code, entryId, body.action);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}
