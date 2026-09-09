import { createParserError, type ParserError } from "./errors";

export const LIMITLESS_PARSER_VERSION = "1.0.0";

export type LimitlessCardLine = {
  quantity: number;
  name: string;
  setCode: string;
  collectorNumber: string;
};

export type LimitlessSectionKind = "Pokemon" | "Trainer" | "Energy";

export type LimitlessSectionHeader = {
  kind: LimitlessSectionKind;
  declaredCount: number | null;
  raw: string;
  lineNumber: number;
};

export type LimitlessParseResult = {
  parser_version: string;
  cards: LimitlessCardLine[];
  sections: LimitlessSectionHeader[];
  errors: ParserError[];
};

export type LimitlessLineSuccess = {
  ok: true;
  value: LimitlessCardLine;
};

export type LimitlessLineFailure = {
  ok: false;
  error: ParserError;
};

export type LimitlessLineResult = LimitlessLineSuccess | LimitlessLineFailure;

const SECTION_HEADER =
  /^(Pok[eé]mon|Trainer|Energy)\s*:\s*(\d+)?\s*$/i;

function tokenize(line: string): string[] {
  return line.trim().split(/\s+/).filter(Boolean);
}

function normalizeSectionKind(raw: string): LimitlessSectionKind {
  const key = raw.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (key.startsWith("pokemon")) return "Pokemon";
  if (key.startsWith("trainer")) return "Trainer";
  return "Energy";
}

export function isLimitlessSectionHeader(line: string): boolean {
  return SECTION_HEADER.test(line.trim());
}

export function parseLimitlessSectionHeader(
  line: string,
  lineNumber = 1,
): LimitlessSectionHeader | null {
  const trimmed = line.trim();
  const match = trimmed.match(SECTION_HEADER);
  if (!match) return null;

  return {
    kind: normalizeSectionKind(match[1] ?? ""),
    declaredCount:
      match[2] !== undefined && match[2] !== ""
        ? Number.parseInt(match[2], 10)
        : null,
    raw: line,
    lineNumber,
  };
}

export function parseLimitlessLine(
  line: string,
  lineNumber = 1,
): LimitlessLineResult {
  const raw = line;
  const trimmed = line.trim();

  if (trimmed.length === 0) {
    return {
      ok: false,
      error: createParserError("EMPTY_LINE", "Linha vazia", {
        lineNumber,
        raw,
      }),
    };
  }

  const tokens = tokenize(trimmed);

  if (tokens.length < 4) {
    return {
      ok: false,
      error: createParserError(
        "INSUFFICIENT_TOKENS",
        "Esperado [quantity] [name] [set_code] [collector_number]",
        { lineNumber, raw },
      ),
    };
  }

  const quantityToken = tokens[0] ?? "";
  if (!/^\d+$/.test(quantityToken)) {
    return {
      ok: false,
      error: createParserError(
        "INVALID_QUANTITY",
        `Quantidade inválida: "${quantityToken}"`,
        { lineNumber, raw },
      ),
    };
  }

  const quantity = Number.parseInt(quantityToken, 10);
  if (quantity < 1) {
    return {
      ok: false,
      error: createParserError(
        "INVALID_QUANTITY",
        "Quantidade deve ser maior que zero",
        { lineNumber, raw },
      ),
    };
  }

  const collectorNumber = tokens[tokens.length - 1] ?? "";
  const setCode = tokens[tokens.length - 2] ?? "";
  const nameTokens = tokens.slice(1, -2);
  const name = nameTokens.join(" ").trim();

  if (!name) {
    return {
      ok: false,
      error: createParserError("MISSING_NAME", "Nome da carta ausente", {
        lineNumber,
        raw,
      }),
    };
  }

  if (!setCode) {
    return {
      ok: false,
      error: createParserError("MISSING_SET_CODE", "set_code ausente", {
        lineNumber,
        raw,
      }),
    };
  }

  if (!collectorNumber) {
    return {
      ok: false,
      error: createParserError(
        "MISSING_COLLECTOR_NUMBER",
        "collector_number ausente",
        { lineNumber, raw },
      ),
    };
  }

  return {
    ok: true,
    value: {
      quantity,
      name,
      setCode,
      collectorNumber,
    },
  };
}

export function parseLimitlessDecklist(input: string): LimitlessParseResult {
  const errors: ParserError[] = [];
  const cards: LimitlessCardLine[] = [];
  const sections: LimitlessSectionHeader[] = [];

  if (input.trim().length === 0) {
    return {
      parser_version: LIMITLESS_PARSER_VERSION,
      cards,
      sections,
      errors: [
        createParserError("EMPTY_INPUT", "Decklist Limitless vazia"),
      ],
    };
  }

  const lines = input.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const lineNumber = i + 1;
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    const section = parseLimitlessSectionHeader(line, lineNumber);
    if (section) {
      sections.push(section);
      continue;
    }

    const result = parseLimitlessLine(line, lineNumber);
    if (result.ok) {
      cards.push(result.value);
    } else {
      errors.push(result.error);
    }
  }

  return {
    parser_version: LIMITLESS_PARSER_VERSION,
    cards,
    sections,
    errors,
  };
}
