/** Largest JSON body the API accepts (battle logs are the biggest payload). */
export const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

export type JsonBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413; code: "INVALID_JSON" | "BODY_TOO_LARGE"; message: string };

const TOO_LARGE = {
  ok: false,
  status: 413,
  code: "BODY_TOO_LARGE",
  message: "Requisição grande demais.",
} as const;
const INVALID = { ok: false, status: 400, code: "INVALID_JSON", message: "JSON inválido." } as const;

/**
 * Reads a JSON object body with a size cap. Anything that isn't a plain object
 * (array, string, null) is rejected, so handlers can safely read fields.
 */
export async function readJsonObject(
  request: Request,
  maxBytes = MAX_JSON_BODY_BYTES,
): Promise<JsonBodyResult> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return TOO_LARGE;

  let text: string;
  try {
    text = await request.text();
  } catch {
    return INVALID;
  }
  if (Buffer.byteLength(text, "utf8") > maxBytes) return TOO_LARGE;

  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value)) return INVALID;
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return INVALID;
  }
}
