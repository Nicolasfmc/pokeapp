import {
  MatchResult,
  Prisma,
  TurnOrder,
  type MatchResult as PrismaMatchResult,
  type TurnOrder as PrismaTurnOrder,
} from "@prisma/client";
import { prisma } from "@/server/database";
import {
  TCG_LIVE_PARSER_VERSION,
  parseTcgLiveBattleLog,
  type StructuredMatchData,
} from "@/server/parsers";
import {
  normalizeDisplayPokemon,
  suggestArchetype,
  type ArchetypeSuggestion,
} from "./archetype-classifier";

export class MatchServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "MatchServiceError";
    this.status = status;
    this.code = code;
  }
}

export type ArchetypeDto = {
  id: string;
  name: string;
  displayPokemon: unknown;
  createdAt: string;
  updatedAt: string;
};

export type MatchDto = {
  id: string;
  userId: string;
  battleLogId: string | null;
  deckId: string;
  deck: {
    id: string;
    name: string;
    archetype: { id: string; name: string } | null;
  };
  opponentArchetypeId: string | null;
  opponentArchetype: { id: string; name: string } | null;
  result: PrismaMatchResult;
  turnOrder: PrismaTurnOrder | null;
  gameFormatCode: string | null;
  formatId: string | null;
  notes: string | null;
  playedAt: string | null;
  createdAt: string;
  updatedAt: string;
  battleLog: {
    id: string;
    source: string;
    parserVersion: string;
    importedAt: string;
  } | null;
  structured: StructuredMatchData | null;
};

export type ImportBattleLogInput = {
  rawLog: string;
  deckId: string;
  viewerName: string;
  opponentArchetypeId?: string | null;
  opponentArchetypeName?: string | null;
  notes?: string | null;
  playedAt?: string | null;
  result?: PrismaMatchResult | null;
  turnOrder?: PrismaTurnOrder | null;
};

export type ImportBattleLogResult = {
  match: MatchDto;
  structured: StructuredMatchData;
  parseOk: boolean;
};

export type UpdateMatchInput = {
  deckId?: string;
  opponentArchetypeId?: string | null;
  opponentArchetypeName?: string | null;
  result?: PrismaMatchResult;
  turnOrder?: PrismaTurnOrder | null;
  gameFormatCode?: string | null;
  notes?: string | null;
  playedAt?: string | null;
};

const RESULT_VALUES = new Set<string>(Object.values(MatchResult));
const TURN_ORDER_VALUES = new Set<string>(Object.values(TurnOrder));

const matchInclude = {
  deck: {
    select: {
      id: true,
      name: true,
      archetype: { select: { id: true, name: true } },
    },
  },
  opponentArchetype: { select: { id: true, name: true } },
  battleLog: {
    select: {
      id: true,
      source: true,
      parserVersion: true,
      importedAt: true,
      rawLog: true,
    },
  },
} satisfies Prisma.MatchInclude;

type MatchWithRelations = Prisma.MatchGetPayload<{
  include: typeof matchInclude;
}>;

function toArchetypeDto(row: {
  id: string;
  name: string;
  displayPokemon: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): ArchetypeDto {
  return {
    id: row.id,
    name: row.name,
    displayPokemon: row.displayPokemon,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMatchDto(
  match: MatchWithRelations,
  options: {
    structured?: StructuredMatchData | null;
    includeStructured?: boolean;
  } = {},
): MatchDto {
  let structured: StructuredMatchData | null = options.structured ?? null;
  if (
    !structured &&
    options.includeStructured &&
    match.battleLog?.rawLog
  ) {
    const parsed = parseTcgLiveBattleLog(match.battleLog.rawLog);
    structured = {
      ...parsed.value,
      raw_log: match.battleLog.rawLog,
      parser_version: match.battleLog.parserVersion,
    };
  }

  return {
    id: match.id,
    userId: match.userId,
    battleLogId: match.battleLogId,
    deckId: match.deckId,
    deck: match.deck,
    opponentArchetypeId: match.opponentArchetypeId,
    opponentArchetype: match.opponentArchetype,
    result: match.result,
    turnOrder: match.turnOrder,
    gameFormatCode: match.gameFormatCode,
    formatId: match.formatId,
    notes: match.notes,
    playedAt: match.playedAt ? match.playedAt.toISOString() : null,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
    battleLog: match.battleLog
      ? {
          id: match.battleLog.id,
          source: match.battleLog.source,
          parserVersion: match.battleLog.parserVersion,
          importedAt: match.battleLog.importedAt.toISOString(),
        }
      : null,
    structured,
  };
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new MatchServiceError(
      `${field} deve ser uma data ISO.`,
      400,
      "INVALID_DATE",
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new MatchServiceError(
      `${field} inválido.`,
      400,
      "INVALID_DATE",
    );
  }
  return date;
}

function parseResult(value: unknown): PrismaMatchResult | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || !RESULT_VALUES.has(value)) {
    throw new MatchServiceError("result inválido.", 400, "INVALID_RESULT");
  }
  return value as PrismaMatchResult;
}

function parseTurnOrder(value: unknown): PrismaTurnOrder | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !TURN_ORDER_VALUES.has(value)) {
    throw new MatchServiceError(
      "turnOrder inválido.",
      400,
      "INVALID_TURN_ORDER",
    );
  }
  return value as PrismaTurnOrder;
}

async function assertOwnedDeck(userId: string, deckId: string) {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    select: { id: true },
  });
  if (!deck) {
    throw new MatchServiceError("Deck não encontrado.", 404, "DECK_NOT_FOUND");
  }
}

async function resolveArchetypeId(params: {
  opponentArchetypeId?: string | null;
  opponentArchetypeName?: string | null;
}): Promise<string | null> {
  const id =
    params.opponentArchetypeId === undefined
      ? undefined
      : params.opponentArchetypeId;
  const name =
    typeof params.opponentArchetypeName === "string"
      ? params.opponentArchetypeName.trim()
      : params.opponentArchetypeName === null
        ? null
        : undefined;

  if (id === null && (name === undefined || name === null || name === "")) {
    return null;
  }

  if (typeof id === "string" && id.length > 0) {
    const existing = await prisma.archetype.findUnique({ where: { id } });
    if (!existing) {
      throw new MatchServiceError(
        "Arquétipo não encontrado.",
        404,
        "ARCHETYPE_NOT_FOUND",
      );
    }
    return existing.id;
  }

  if (typeof name === "string" && name.length > 0) {
    const existing = await prisma.archetype.findUnique({ where: { name } });
    if (existing) return existing.id;
    const created = await prisma.archetype.create({
      data: { name, displayPokemon: normalizeDisplayPokemon(undefined, name) },
    });
    return created.id;
  }

  if (id === null || name === null) {
    return null;
  }

  return null;
}

export async function listArchetypes(query?: string): Promise<ArchetypeDto[]> {
  const q = query?.trim();
  const rows = await prisma.archetype.findMany({
    where: q
      ? { name: { contains: q, mode: "insensitive" } }
      : undefined,
    orderBy: { name: "asc" },
    take: 200,
  });
  return rows.map(toArchetypeDto);
}

export async function createArchetype(input: {
  name: string;
  displayPokemon?: unknown;
}): Promise<ArchetypeDto> {
  const name = input.name?.trim();
  if (!name) {
    throw new MatchServiceError(
      "Nome do arquétipo é obrigatório.",
      400,
      "INVALID_NAME",
    );
  }

  const existing = await prisma.archetype.findUnique({ where: { name } });
  if (existing) {
    throw new MatchServiceError(
      "Arquétipo já existe.",
      409,
      "ARCHETYPE_EXISTS",
    );
  }

  // §69: o arquétipo define os Pokémon usados na apresentação.
  const displayPokemon = normalizeDisplayPokemon(input.displayPokemon, name);

  try {
    const row = await prisma.archetype.create({
      data: { name, displayPokemon },
    });
    return toArchetypeDto(row);
  } catch (error) {
    console.error(error);
    throw new MatchServiceError(
      "Falha ao criar arquétipo.",
      500,
      "ARCHETYPE_CREATE_FAILED",
    );
  }
}

export async function updateArchetype(
  id: string,
  input: { name?: string; displayPokemon?: unknown },
): Promise<ArchetypeDto> {
  const current = await prisma.archetype.findUnique({ where: { id } });
  if (!current) {
    throw new MatchServiceError(
      "Arquétipo não encontrado.",
      404,
      "ARCHETYPE_NOT_FOUND",
    );
  }

  const data: Prisma.ArchetypeUpdateInput = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new MatchServiceError(
        "Nome do arquétipo é obrigatório.",
        400,
        "INVALID_NAME",
      );
    }
    data.name = name;
  }
  if (input.displayPokemon !== undefined) {
    data.displayPokemon = normalizeDisplayPokemon(
      input.displayPokemon,
      typeof data.name === "string" ? data.name : current.name,
    );
  }

  try {
    const row = await prisma.archetype.update({ where: { id }, data });
    return toArchetypeDto(row);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new MatchServiceError(
        "Arquétipo já existe.",
        409,
        "ARCHETYPE_EXISTS",
      );
    }
    console.error(error);
    throw new MatchServiceError(
      "Falha ao atualizar arquétipo.",
      500,
      "ARCHETYPE_UPDATE_FAILED",
    );
  }
}

export async function listMatches(userId: string): Promise<MatchDto[]> {
  const rows = await prisma.match.findMany({
    where: { userId },
    include: matchInclude,
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((row) => toMatchDto(row));
}

export async function getMatch(
  userId: string,
  matchId: string,
): Promise<MatchDto> {
  const row = await prisma.match.findFirst({
    where: { id: matchId, userId },
    include: matchInclude,
  });
  if (!row) {
    throw new MatchServiceError("Match não encontrado.", 404, "MATCH_NOT_FOUND");
  }
  return toMatchDto(row, { includeStructured: true });
}

export type BattleLogPreview = {
  player1: string | null;
  player2: string | null;
  viewer: string | null;
  opponent: string | null;
  result: PrismaMatchResult;
  turnOrder: PrismaTurnOrder | null;
  gameFormatCode: string | null;
  parserVersion: string;
  opponentPokemon: string[];
  viewerPokemon: string[];
  suggestedArchetype: ArchetypeSuggestion | null;
  warnings: string[];
};

/**
 * §68 — Log → Detected Pokémon → Suggested Archetype → User Review.
 * Não persiste nada: o usuário revisa antes de salvar.
 */
export async function previewBattleLog(input: {
  rawLog: unknown;
  viewerName: string;
}): Promise<BattleLogPreview> {
  const rawLog = typeof input.rawLog === "string" ? input.rawLog : "";
  if (!rawLog.trim()) {
    throw new MatchServiceError("rawLog é obrigatório.", 400, "EMPTY_RAW_LOG");
  }
  const parsed = parseTcgLiveBattleLog(rawLog, { viewerName: input.viewerName });
  const structured = parsed.value;
  if (structured.errors.some((e) => e.code === "MISSING_PLAYERS")) {
    throw new MatchServiceError(
      'Não foi possível extrair "jogador vs oponente" do log.',
      400,
      "UNPARSEABLE_LOG",
    );
  }

  const opponentPokemon = structured.opponent
    ? (structured.pokemon_by_player[structured.opponent] ?? [])
    : [];
  const viewerPlayer =
    structured.opponent === structured.player1 ? structured.player2 : structured.player1;
  const viewerPokemon =
    structured.opponent && viewerPlayer
      ? (structured.pokemon_by_player[viewerPlayer] ?? [])
      : [];

  const archetypes = await prisma.archetype.findMany({
    select: { id: true, name: true, displayPokemon: true },
  });

  return {
    player1: structured.player1,
    player2: structured.player2,
    viewer: structured.viewer,
    opponent: structured.opponent,
    result: structured.result,
    turnOrder: structured.turn_order,
    gameFormatCode: structured.format,
    parserVersion: structured.parser_version,
    opponentPokemon,
    viewerPokemon,
    suggestedArchetype: suggestArchetype(opponentPokemon, archetypes),
    warnings: structured.errors.map((e) => e.message),
  };
}

export async function importBattleLog(
  userId: string,
  input: ImportBattleLogInput,
): Promise<ImportBattleLogResult> {
  const rawLog = typeof input.rawLog === "string" ? input.rawLog : "";
  if (!rawLog.trim()) {
    throw new MatchServiceError(
      "rawLog é obrigatório.",
      400,
      "EMPTY_RAW_LOG",
    );
  }

  if (!input.deckId || typeof input.deckId !== "string") {
    throw new MatchServiceError("deckId é obrigatório.", 400, "INVALID_DECK");
  }

  const viewerName =
    typeof input.viewerName === "string" ? input.viewerName.trim() : "";
  if (!viewerName) {
    throw new MatchServiceError(
      "viewerName é obrigatório para result/turn_order.",
      400,
      "MISSING_VIEWER_NAME",
    );
  }

  await assertOwnedDeck(userId, input.deckId);

  const parsed = parseTcgLiveBattleLog(rawLog, { viewerName });
  const structured = parsed.value;

  if (structured.errors.some((e) => e.code === "EMPTY_INPUT")) {
    throw new MatchServiceError(
      "Battle log vazio.",
      400,
      "EMPTY_RAW_LOG",
    );
  }

  if (structured.errors.some((e) => e.code === "MISSING_PLAYERS")) {
    throw new MatchServiceError(
      'Não foi possível extrair "jogador vs oponente" do log.',
      400,
      "UNPARSEABLE_LOG",
    );
  }

  const resultOverride = parseResult(input.result);
  const turnOrderOverride = parseTurnOrder(input.turnOrder);
  const playedAt = parseOptionalDate(input.playedAt, "playedAt");
  const opponentArchetypeId = await resolveArchetypeId({
    opponentArchetypeId: input.opponentArchetypeId,
    opponentArchetypeName: input.opponentArchetypeName,
  });

  const result = resultOverride ?? structured.result;
  const turnOrder =
    turnOrderOverride !== undefined
      ? turnOrderOverride
      : structured.turn_order;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const battleLog = await tx.battleLog.create({
        data: {
          userId,
          rawLog,
          source: structured.source,
          parserVersion: structured.parser_version || TCG_LIVE_PARSER_VERSION,
        },
      });

      const match = await tx.match.create({
        data: {
          userId,
          battleLogId: battleLog.id,
          deckId: input.deckId,
          opponentArchetypeId,
          result,
          turnOrder,
          gameFormatCode: structured.format,
          formatId: null,
          notes:
            typeof input.notes === "string"
              ? input.notes.trim() || null
              : input.notes ?? null,
          playedAt,
        },
        include: matchInclude,
      });

      return match;
    });

    return {
      match: toMatchDto(created, { structured }),
      structured,
      parseOk: parsed.ok,
    };
  } catch (error) {
    if (error instanceof MatchServiceError) throw error;
    console.error(error);
    throw new MatchServiceError(
      "Falha ao importar battle log.",
      500,
      "IMPORT_FAILED",
    );
  }
}

export async function updateMatch(
  userId: string,
  matchId: string,
  input: UpdateMatchInput,
): Promise<MatchDto> {
  const current = await prisma.match.findFirst({
    where: { id: matchId, userId },
    select: { id: true },
  });
  if (!current) {
    throw new MatchServiceError("Match não encontrado.", 404, "MATCH_NOT_FOUND");
  }

  const data: Prisma.MatchUpdateInput = {};

  if (input.deckId !== undefined) {
    if (typeof input.deckId !== "string" || !input.deckId) {
      throw new MatchServiceError("deckId inválido.", 400, "INVALID_DECK");
    }
    await assertOwnedDeck(userId, input.deckId);
    data.deck = { connect: { id: input.deckId } };
  }

  if (
    input.opponentArchetypeId !== undefined ||
    input.opponentArchetypeName !== undefined
  ) {
    const opponentArchetypeId = await resolveArchetypeId({
      opponentArchetypeId: input.opponentArchetypeId,
      opponentArchetypeName: input.opponentArchetypeName,
    });
    data.opponentArchetype = opponentArchetypeId
      ? { connect: { id: opponentArchetypeId } }
      : { disconnect: true };
  }

  const result = parseResult(input.result);
  if (result !== undefined) {
    data.result = result;
  }

  const turnOrder = parseTurnOrder(input.turnOrder);
  if (turnOrder !== undefined) {
    data.turnOrder = turnOrder;
  }

  if (input.gameFormatCode !== undefined) {
    data.gameFormatCode =
      typeof input.gameFormatCode === "string"
        ? input.gameFormatCode.trim() || null
        : input.gameFormatCode;
  }

  if (input.notes !== undefined) {
    data.notes =
      typeof input.notes === "string"
        ? input.notes.trim() || null
        : input.notes;
  }

  if (input.playedAt !== undefined) {
    data.playedAt = parseOptionalDate(input.playedAt, "playedAt");
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data,
    include: matchInclude,
  });

  return toMatchDto(updated);
}

export async function deleteMatch(
  userId: string,
  matchId: string,
): Promise<void> {
  const current = await prisma.match.findFirst({
    where: { id: matchId, userId },
    select: { id: true, battleLogId: true },
  });
  if (!current) {
    throw new MatchServiceError("Match não encontrado.", 404, "MATCH_NOT_FOUND");
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.delete({ where: { id: current.id } });
    if (current.battleLogId) {
      await tx.battleLog.delete({ where: { id: current.battleLogId } });
    }
  });
}
