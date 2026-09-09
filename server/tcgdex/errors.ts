export class TcgdexNotFoundError extends Error {
  readonly resource: string;
  readonly resourceId: string;

  constructor(resource: string, resourceId: string) {
    super(`${resource} não encontrado na TCGdex: ${resourceId}`);
    this.name = "TcgdexNotFoundError";
    this.resource = resource;
    this.resourceId = resourceId;
  }
}

export class TcgdexSyncError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TcgdexSyncError";
  }
}
