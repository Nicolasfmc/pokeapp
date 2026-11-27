import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/server/auth";
import { readJsonObject } from "@/server/http-body";
import { HostedTournamentError } from "@/server/services/hosted-tournament/service";

const NO_STORE = { "Cache-Control": "no-store" };

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonError(message: string, status: number, code: string, retryAfterSec?: number) {
  const headers: Record<string, string> = { ...NO_STORE };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return NextResponse.json({ error: message, code }, { status, headers });
}

export function handleHostedError(error: unknown) {
  if (error instanceof HostedTournamentError) {
    return jsonError(error.message, error.status, error.code, error.retryAfterSec);
  }
  if (error instanceof UnauthorizedError) {
    return jsonError(error.message, 401, "UNAUTHORIZED");
  }
  console.error(error);
  return jsonError("Erro interno.", 500, "INTERNAL");
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await readJsonObject(request, 16 * 1024);
  if (!body.ok) throw new HostedTournamentError(body.message, body.status, body.code);
  return body.value;
}

export type CodeContext = { params: Promise<{ code: string }> };
