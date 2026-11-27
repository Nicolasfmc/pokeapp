import { requireUser } from "@/server/auth";
import { controlTimer, handleHostedError, jsonOk, readBody, type CodeContext } from "@/modules/hosted-tournaments";

/** Organizer: { action: "pause" | "resume" | "add", minutes?: number } */
export async function POST(request: Request, context: CodeContext) {
  try {
    const user = await requireUser();
    const { code } = await context.params;
    const body = await readBody(request);
    await controlTimer(user.id, code, body.action, body.minutes);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleHostedError(error);
  }
}
