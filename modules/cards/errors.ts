export class CardsServiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = "CARDS_ERROR") {
    super(message);
    this.name = "CardsServiceError";
    this.status = status;
    this.code = code;
  }
}
