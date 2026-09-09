import { NextResponse } from "next/server";
import { PublicProfileError } from "./errors";

export function publicJsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function publicJsonError(
  message: string,
  status: number,
  code?: string,
) {
  return NextResponse.json(
    { error: message, code: code ?? "ERROR" },
    { status },
  );
}

export function handlePublicProfileError(error: unknown) {
  if (error instanceof PublicProfileError) {
    return publicJsonError(error.message, error.status, error.code);
  }
  console.error(error);
  return publicJsonError("Erro interno.", 500, "INTERNAL");
}
