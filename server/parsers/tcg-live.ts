import { createParserError, type ParserError } from "./errors";

export const TCG_LIVE_PARSER_VERSION = "1.1.0";

export type MatchResult = "WIN" | "LOSS" | "DRAW" | "UNKNOWN";
export type TurnOrder = "FIRST" | "SECOND";

export type StructuredMatchData = {
  parser_version: string;
  raw_log: string;
  source: "TCG_LIVE";
  player1: string | null;
  player2: string | null;
  viewer: string | null;
  winner: string | null;
  result: MatchResult;
  turn_order: TurnOrder | null;
  going_first_player: string | null;
  format: string | null;
  /** Oponente do viewer (null sem viewer válido). */
  opponent: string | null;
  /**
   * Pokémon colocados em campo / evoluídos por jogador, na ordem em que
   * aparecem. Só nomes que o log comprovadamente associa ao jogador (§60).
   */
  pokemon_by_player: Record<string, string[]>;
  errors: ParserError[];
};

export type ParseTcgLiveOptions = {
  viewerName?: string;
};

export type TcgLiveParseResult = {
  ok: boolean;
  value: StructuredMatchData;
};

const VS_LINE = /^(.+?)\s+vs\.?\s+(.+)$/i;
const FORMAT_LINE =
  /^(?:Game\s+)?Format\s*:\s*(.+)$/i;
const FORMAT_CODE_ONLY = /^([A-Z0-9]+(?:-[A-Z0-9]+)+)\s*$/;
const GOING_FIRST = /^(.+?)\s+will go first\.?$/i;
const WINS_LINE =
  /^(?:All of .+?'s Pokémon are Knocked Out\.\s*)?(.+?)\s+wins\.?$/i;
const PRIZE_WINS =
  /^(.+?)\s+took all (?:of )?(?:their|his|her) Prize cards\.\s*(?:(.+?)\s+wins\.?)?$/i;
const RESULT_CODE = /\bResult\s*:\s*([WLD])\b/i;
const TURN_ORDER_CODE = /\bTurn\s*Order\s*:\s*(FIRST|SECOND|1st|2nd)\b/i;

// "<player> played (twm_128) Dreepy to the Bench." / "... to the Active Spot."
const PLAYED_TO_FIELD =
  /^(.+?)\s+played\s+(?:\([^)]*\)\s+)?(.+?)\s+to\s+(?:the|their)\s+(?:Bench|Active Spot)\.?$/i;
// "<player>'s (twm_128) Dreepy evolved into (twm_129) Drakloak[ on the Bench]."
const EVOLVED_INTO =
  /^(.+?)'s\s+(?:\([^)]*\)\s+)?.+?\s+evolved into\s+(?:\([^)]*\)\s+)?(.+?)(?:\s+(?:on the Bench|in the Active Spot))?\.?$/i;

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function namesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}

function mapResultCode(code: string): MatchResult {
  switch (code.toUpperCase()) {
    case "W":
      return "WIN";
    case "L":
      return "LOSS";
    case "D":
      return "DRAW";
    default:
      return "UNKNOWN";
  }
}

function mapTurnOrderToken(token: string): TurnOrder | null {
  const value = token.toUpperCase();
  if (value === "FIRST" || value === "1ST") return "FIRST";
  if (value === "SECOND" || value === "2ND") return "SECOND";
  return null;
}

function extractPlayers(lines: string[]): {
  player1: string | null;
  player2: string | null;
} {
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(VS_LINE);
    if (match) {
      return {
        player1: normalizeName(match[1] ?? ""),
        player2: normalizeName(match[2] ?? ""),
      };
    }
  }
  return { player1: null, player2: null };
}

function extractFormat(lines: string[]): string | null {
  for (const line of lines) {
    const trimmed = line.trim();
    const labeled = trimmed.match(FORMAT_LINE);
    if (labeled) {
      return normalizeName(labeled[1] ?? "");
    }
    const codeOnly = trimmed.match(FORMAT_CODE_ONLY);
    if (codeOnly) {
      return codeOnly[1] ?? null;
    }
  }
  return null;
}

function extractGoingFirst(lines: string[]): string | null {
  for (const line of lines) {
    const match = line.trim().match(GOING_FIRST);
    if (match) {
      return normalizeName(match[1] ?? "");
    }
  }
  return null;
}

function extractWinner(lines: string[]): string | null {
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = (lines[i] ?? "").trim();
    if (!trimmed) continue;

    const prize = trimmed.match(PRIZE_WINS);
    if (prize) {
      const explicit = prize[2] ? normalizeName(prize[2]) : null;
      return explicit ?? normalizeName(prize[1] ?? "");
    }

    const wins = trimmed.match(WINS_LINE);
    if (wins) {
      return normalizeName(wins[1] ?? "");
    }
  }
  return null;
}

export function extractPokemonByPlayer(
  lines: string[],
  players: Array<string | null>,
): Record<string, string[]> {
  const known = players.filter((p): p is string => Boolean(p));
  const result: Record<string, string[]> = {};
  for (const player of known) result[player] = [];

  const add = (playerRaw: string, cardRaw: string) => {
    const player = known.find((p) => namesEqual(p, normalizeName(playerRaw)));
    if (!player) return;
    const card = normalizeName(cardRaw);
    if (card && !result[player].includes(card)) {
      result[player].push(card);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const evolved = trimmed.match(EVOLVED_INTO);
    if (evolved) {
      add(evolved[1] ?? "", evolved[2] ?? "");
      continue;
    }
    const played = trimmed.match(PLAYED_TO_FIELD);
    if (played) {
      add(played[1] ?? "", played[2] ?? "");
    }
  }
  return result;
}

function extractResultCode(lines: string[]): MatchResult | null {
  for (const line of lines) {
    const match = line.match(RESULT_CODE);
    if (match?.[1]) {
      return mapResultCode(match[1]);
    }
  }
  return null;
}

function extractTurnOrderCode(lines: string[]): TurnOrder | null {
  for (const line of lines) {
    const match = line.match(TURN_ORDER_CODE);
    if (match?.[1]) {
      return mapTurnOrderToken(match[1]);
    }
  }
  return null;
}

function resolveResult(params: {
  viewer: string | null;
  winner: string | null;
  player1: string | null;
  player2: string | null;
  resultCode: MatchResult | null;
}): MatchResult {
  if (params.resultCode && params.resultCode !== "UNKNOWN") {
    return params.resultCode;
  }

  if (!params.winner) {
    return "UNKNOWN";
  }

  if (!params.viewer) {
    return "UNKNOWN";
  }

  if (namesEqual(params.winner, params.viewer)) {
    return "WIN";
  }

  if (
    namesEqual(params.winner, params.player1) ||
    namesEqual(params.winner, params.player2)
  ) {
    return "LOSS";
  }

  return "UNKNOWN";
}

function resolveTurnOrder(params: {
  viewer: string | null;
  goingFirstPlayer: string | null;
  turnOrderCode: TurnOrder | null;
}): TurnOrder | null {
  if (params.turnOrderCode) {
    return params.turnOrderCode;
  }

  if (!params.goingFirstPlayer || !params.viewer) {
    return null;
  }

  return namesEqual(params.goingFirstPlayer, params.viewer)
    ? "FIRST"
    : "SECOND";
}

export function parseTcgLiveBattleLog(
  rawLog: string,
  options: ParseTcgLiveOptions = {},
): TcgLiveParseResult {
  const raw_log = rawLog;
  const errors: ParserError[] = [];
  const viewer = options.viewerName
    ? normalizeName(options.viewerName)
    : null;

  if (raw_log.trim().length === 0) {
    const value: StructuredMatchData = {
      parser_version: TCG_LIVE_PARSER_VERSION,
      raw_log,
      source: "TCG_LIVE",
      player1: null,
      player2: null,
      viewer,
      winner: null,
      result: "UNKNOWN",
      turn_order: null,
      going_first_player: null,
      format: null,
      opponent: null,
      pokemon_by_player: {},
      errors: [
        createParserError("EMPTY_INPUT", "Battle log TCG Live vazio"),
      ],
    };
    return { ok: false, value };
  }

  const lines = raw_log.split(/\r?\n/);
  const { player1, player2 } = extractPlayers(lines);
  const format = extractFormat(lines);
  const going_first_player = extractGoingFirst(lines);
  const winner = extractWinner(lines);
  const resultCode = extractResultCode(lines);
  const turnOrderCode = extractTurnOrderCode(lines);

  if (!player1 || !player2) {
    errors.push(
      createParserError(
        "MISSING_PLAYERS",
        'Não foi possível extrair "jogador vs oponente" do log',
      ),
    );
  }

  if (viewer && player1 && player2) {
    const viewerInMatch =
      namesEqual(viewer, player1) || namesEqual(viewer, player2);
    if (!viewerInMatch) {
      errors.push(
        createParserError(
          "UNPARSEABLE_MATCH",
          `viewer "${viewer}" não corresponde a ${player1} ou ${player2}`,
        ),
      );
    }
  }

  const result = resolveResult({
    viewer,
    winner,
    player1,
    player2,
    resultCode,
  });

  const turn_order = resolveTurnOrder({
    viewer,
    goingFirstPlayer: going_first_player,
    turnOrderCode,
  });

  const opponent =
    viewer && player1 && player2
      ? namesEqual(viewer, player1)
        ? player2
        : namesEqual(viewer, player2)
          ? player1
          : null
      : null;

  const value: StructuredMatchData = {
    parser_version: TCG_LIVE_PARSER_VERSION,
    raw_log,
    source: "TCG_LIVE",
    player1,
    player2,
    viewer,
    winner,
    result,
    turn_order,
    going_first_player,
    format,
    opponent,
    pokemon_by_player: extractPokemonByPlayer(lines, [player1, player2]),
    errors,
  };

  return {
    ok: errors.length === 0,
    value,
  };
}
