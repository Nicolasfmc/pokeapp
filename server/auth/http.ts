import { readJsonObject } from "@/server/http-body";
import { NextResponse } from "next/server";
import { AuthServiceError } from "./service";
import { UnauthorizedError } from "./get-session";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, code: code ?? "ERROR" },
    { status },
  );
}

export function handleAuthError(error: unknown) {
  if (error instanceof AuthServiceError) {
    return jsonError(error.message, error.status, error.code);
  }
  if (error instanceof UnauthorizedError) {
    return jsonError(error.message, 401, "UNAUTHORIZED");
  }
  console.error(error);
  return jsonError("Erro interno.", 500, "INTERNAL");
}

export async function readJsonBody<T extends Record<string, unknown>>(
  request: Request,
): Promise<T> {
  const body = await readJsonObject(request);
  if (!body.ok) {
    throw new AuthServiceError(body.message, body.status, body.code);
  }
  return body.value as T;
}
