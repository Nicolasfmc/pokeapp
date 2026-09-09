import { NextResponse } from "next/server";
import { UnauthorizedError } from "@/server/auth";
import { CardsServiceError } from "./errors";

export function cardsJsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function cardsJsonError(message: string, status: number, code?: string) {
  return NextResponse.json(
    { error: message, code: code ?? "ERROR" },
    { status },
  );
}

export function handleCardsError(error: unknown) {
  if (error instanceof CardsServiceError) {
    return cardsJsonError(error.message, error.status, error.code);
  }
  if (error instanceof UnauthorizedError) {
    return cardsJsonError(error.message, 401, "UNAUTHORIZED");
  }
  console.error(error);
  return cardsJsonError("Erro interno.", 500, "INTERNAL");
}
