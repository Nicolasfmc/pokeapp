export type ParserErrorCode =
  | "EMPTY_INPUT"
  | "EMPTY_LINE"
  | "INSUFFICIENT_TOKENS"
  | "INVALID_QUANTITY"
  | "MISSING_NAME"
  | "MISSING_SET_CODE"
  | "MISSING_COLLECTOR_NUMBER"
  | "MISSING_PLAYERS"
  | "UNPARSEABLE_MATCH";

export type ParserError = {
  code: ParserErrorCode;
  message: string;
  lineNumber?: number;
  raw?: string;
};

export function createParserError(
  code: ParserErrorCode,
  message: string,
  extras?: Pick<ParserError, "lineNumber" | "raw">,
): ParserError {
  return {
    code,
    message,
    ...extras,
  };
}
