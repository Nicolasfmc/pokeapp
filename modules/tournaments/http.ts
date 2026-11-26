import { readJsonObject } from "@/server/http-body";
import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/server/auth";
import { TournamentServiceError } from "@/server/services/tournament";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, code: code ?? "ERROR" },
    { status },
  );
}

export function handleTournamentError(error: unknown) {
  if (error instanceof TournamentServiceError) {
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
    throw new TournamentServiceError(body.message, body.status, body.code);
  }
  return body.value as T;
}
