import type { MatchResult, Prisma, TurnOrder } from "@prisma/client";
import { prisma } from "@/server/database";

export class StatisticsServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "StatisticsServiceError";
    this.status = status;
    this.code = code;
  }
}

export type StatisticsFilters = {
  deckId?: string;
  opponentArchetypeId?: string;
  gameFormatCode?: string;
  tournamentId?: string;
  from?: string;
  to?: string;
};

export type RecordStats = {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  unknowns: number;
  winRate: number | null;
};

export type DeckStatsRow = RecordStats & {
  deckId: string;
  deckName: string;
};

export type MatchupStatsRow = RecordStats & {
  opponentArchetypeId: string | null;
  opponentArchetypeName: string | null;
};

export type TurnOrderStatsRow = RecordStats & {
  turnOrder: TurnOrder | "UNKNOWN";
};

export type StatisticsSummary = {
  overall: RecordStats;
  byDeck: DeckStatsRow[];
  byMatchup: MatchupStatsRow[];
  byTurnOrder: TurnOrderStatsRow[];
  filters: StatisticsFilters;
};

export type StatisticsFilterOptions = {
  decks: Array<{ id: string; name: string }>;
  archetypes: Array<{ id: string; name: string }>;
  gameFormatCodes: string[];
  tournaments: Array<{ id: string; name: string }>;
};

type MatchAggRow = {
  result: MatchResult;
  turnOrder: TurnOrder | null;
  deckId: string;
  deckName: string;
  opponentArchetypeId: string | null;
  opponentArchetypeName: string | null;
};

function emptyRecord(): RecordStats {
  return {
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    unknowns: 0,
    winRate: null,
  };
}

function applyResult(record: RecordStats, result: MatchResult) {
  record.matches += 1;
  if (result === "WIN") record.wins += 1;
  else if (result === "LOSS") record.losses += 1;
  else if (result === "DRAW") record.draws += 1;
  else record.unknowns += 1;
}

function finalizeWinRate(record: RecordStats) {
  const decided = record.wins + record.losses;
  record.winRate = decided === 0 ? null : record.wins / decided;
}

function parseDateBound(value: string | undefined, endOfDay: boolean): Date | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const hasTime = trimmed.includes("T");
  const date = new Date(
    hasTime ? trimmed : endOfDay ? `${trimmed}T23:59:59.999` : `${trimmed}T00:00:00.000`,
  );
  if (Number.isNaN(date.getTime())) {
    throw new StatisticsServiceError(
      endOfDay ? "Data final inválida." : "Data inicial inválida.",
      400,
      "INVALID_DATE",
    );
  }
  return date;
}

function buildWhere(
  userId: string,
  filters: StatisticsFilters,
): Prisma.MatchWhereInput {
  const from = parseDateBound(filters.from, false);
  const to = parseDateBound(filters.to, true);

  if (from && to && from > to) {
    throw new StatisticsServiceError(
      "Intervalo de datas inválido.",
      400,
      "INVALID_DATE_RANGE",
    );
  }

  const where: Prisma.MatchWhereInput = { userId };

  if (filters.deckId) where.deckId = filters.deckId;
  if (filters.opponentArchetypeId) {
    where.opponentArchetypeId = filters.opponentArchetypeId;
  }
  if (filters.gameFormatCode) {
    where.gameFormatCode = filters.gameFormatCode;
  }
  if (from || to) {
    where.playedAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }
  if (filters.tournamentId) {
    where.tournamentMatch = { tournamentId: filters.tournamentId };
  }

  return where;
}

function aggregateRows(rows: MatchAggRow[]): Omit<StatisticsSummary, "filters"> {
  const overall = emptyRecord();
  const byDeckMap = new Map<string, DeckStatsRow>();
  const byMatchupMap = new Map<string, MatchupStatsRow>();
  const byTurnOrderMap = new Map<string, TurnOrderStatsRow>();

  for (const row of rows) {
    applyResult(overall, row.result);

    let deckRow = byDeckMap.get(row.deckId);
    if (!deckRow) {
      deckRow = {
        ...emptyRecord(),
        deckId: row.deckId,
        deckName: row.deckName,
      };
      byDeckMap.set(row.deckId, deckRow);
    }
    applyResult(deckRow, row.result);

    const matchupKey = row.opponentArchetypeId ?? "__none__";
    let matchupRow = byMatchupMap.get(matchupKey);
    if (!matchupRow) {
      matchupRow = {
        ...emptyRecord(),
        opponentArchetypeId: row.opponentArchetypeId,
        opponentArchetypeName: row.opponentArchetypeName,
      };
      byMatchupMap.set(matchupKey, matchupRow);
    }
    applyResult(matchupRow, row.result);

    const turnKey = row.turnOrder ?? "UNKNOWN";
    let turnRow = byTurnOrderMap.get(turnKey);
    if (!turnRow) {
      turnRow = {
        ...emptyRecord(),
        turnOrder: turnKey as TurnOrder | "UNKNOWN",
      };
      byTurnOrderMap.set(turnKey, turnRow);
    }
    applyResult(turnRow, row.result);
  }

  finalizeWinRate(overall);
  for (const row of byDeckMap.values()) finalizeWinRate(row);
  for (const row of byMatchupMap.values()) finalizeWinRate(row);
  for (const row of byTurnOrderMap.values()) finalizeWinRate(row);

  const byDeck = [...byDeckMap.values()].sort((a, b) => b.matches - a.matches);
  const byMatchup = [...byMatchupMap.values()].sort(
    (a, b) => b.matches - a.matches,
  );
  const byTurnOrder = [...byTurnOrderMap.values()].sort(
    (a, b) => b.matches - a.matches,
  );

  return { overall, byDeck, byMatchup, byTurnOrder };
}

export async function getStatisticsSummary(
  userId: string,
  filters: StatisticsFilters = {},
): Promise<StatisticsSummary> {
  const where = buildWhere(userId, filters);

  const matches = await prisma.match.findMany({
    where,
    select: {
      result: true,
      turnOrder: true,
      deckId: true,
      playedAt: true,
      gameFormatCode: true,
      opponentArchetypeId: true,
      deck: { select: { id: true, name: true } },
      opponentArchetype: { select: { id: true, name: true } },
    },
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
  });

  const rows: MatchAggRow[] = matches.map((match) => ({
    result: match.result,
    turnOrder: match.turnOrder,
    deckId: match.deckId,
    deckName: match.deck.name,
    opponentArchetypeId: match.opponentArchetypeId,
    opponentArchetypeName: match.opponentArchetype?.name ?? null,
  }));

  return {
    ...aggregateRows(rows),
    filters,
  };
}

export async function getStatisticsFilterOptions(
  userId: string,
): Promise<StatisticsFilterOptions> {
  const [decks, archetypes, formatGroups, tournaments] = await Promise.all([
    prisma.deck.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.archetype.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.match.findMany({
      where: {
        userId,
        gameFormatCode: { not: null },
      },
      select: { gameFormatCode: true },
      distinct: ["gameFormatCode"],
      orderBy: { gameFormatCode: "asc" },
    }),
    prisma.tournament.findMany({
      where: { userId },
      select: { id: true, name: true },
      orderBy: [{ date: "desc" }, { name: "asc" }],
    }),
  ]);

  return {
    decks,
    archetypes,
    gameFormatCodes: formatGroups
      .map((row) => row.gameFormatCode)
      .filter((code): code is string => Boolean(code)),
    tournaments,
  };
}
