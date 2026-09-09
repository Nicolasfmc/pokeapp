import { Prisma, type MatchResult, type TurnOrder } from "@prisma/client";
import { prisma } from "@/server/database";

export class TournamentServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "TournamentServiceError";
    this.status = status;
    this.code = code;
  }
}

export type TournamentListItemDto = {
  id: string;
  userId: string;
  name: string;
  date: string | null;
  location: string | null;
  formatId: string | null;
  format: { id: string; name: string; code: string } | null;
  placement: number | null;
  participantCount: number | null;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TournamentMatchSummaryDto = {
  id: string;
  tournamentId: string;
  matchId: string;
  round: number | null;
  match: {
    id: string;
    result: MatchResult;
    turnOrder: TurnOrder | null;
    playedAt: string | null;
    notes: string | null;
    deck: { id: string; name: string };
    opponentArchetype: { id: string; name: string } | null;
  };
};

export type TournamentDetailDto = Omit<TournamentListItemDto, "matchCount"> & {
  tournamentMatches: TournamentMatchSummaryDto[];
};

export type AttachableMatchDto = {
  id: string;
  result: MatchResult;
  turnOrder: TurnOrder | null;
  playedAt: string | null;
  notes: string | null;
  deck: { id: string; name: string };
  opponentArchetype: { id: string; name: string } | null;
};

export type CreateTournamentInput = {
  name: string;
  date?: string | null;
  location?: string | null;
  formatId?: string | null;
  placement?: number | null;
  participantCount?: number | null;
};

export type UpdateTournamentInput = {
  name?: string;
  date?: string | null;
  location?: string | null;
  formatId?: string | null;
  placement?: number | null;
  participantCount?: number | null;
};

const tournamentListInclude = {
  format: { select: { id: true, name: true, code: true } },
  _count: { select: { tournamentMatches: true } },
} satisfies Prisma.TournamentInclude;

const tournamentDetailInclude = {
  format: { select: { id: true, name: true, code: true } },
  tournamentMatches: {
    orderBy: [{ round: "asc" }, { id: "asc" }],
    include: {
      match: {
        select: {
          id: true,
          result: true,
          turnOrder: true,
          playedAt: true,
          notes: true,
          deck: { select: { id: true, name: true } },
          opponentArchetype: { select: { id: true, name: true } },
        },
      },
    },
  },
} satisfies Prisma.TournamentInclude;

type TournamentListRow = Prisma.TournamentGetPayload<{
  include: typeof tournamentListInclude;
}>;

type TournamentDetailRow = Prisma.TournamentGetPayload<{
  include: typeof tournamentDetailInclude;
}>;

function toListItem(row: TournamentListRow): TournamentListItemDto {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    date: row.date ? row.date.toISOString() : null,
    location: row.location,
    formatId: row.formatId,
    format: row.format,
    placement: row.placement,
    participantCount: row.participantCount,
    matchCount: row._count.tournamentMatches,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type TournamentMatchRow = {
  id: string;
  tournamentId: string;
  matchId: string;
  round: number | null;
  match: {
    id: string;
    result: MatchResult;
    turnOrder: TurnOrder | null;
    playedAt: Date | null;
    notes: string | null;
    deck: { id: string; name: string };
    opponentArchetype: { id: string; name: string } | null;
  };
};

function toMatchSummary(row: TournamentMatchRow): TournamentMatchSummaryDto {
  return {
    id: row.id,
    tournamentId: row.tournamentId,
    matchId: row.matchId,
    round: row.round,
    match: {
      id: row.match.id,
      result: row.match.result,
      turnOrder: row.match.turnOrder,
      playedAt: row.match.playedAt ? row.match.playedAt.toISOString() : null,
      notes: row.match.notes,
      deck: row.match.deck,
      opponentArchetype: row.match.opponentArchetype,
    },
  };
}

function toDetail(row: TournamentDetailRow): TournamentDetailDto {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    date: row.date ? row.date.toISOString() : null,
    location: row.location,
    formatId: row.formatId,
    format: row.format,
    placement: row.placement,
    participantCount: row.participantCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    tournamentMatches: row.tournamentMatches.map(toMatchSummary),
  };
}

function parseOptionalDate(value: unknown, field: string): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new TournamentServiceError(
      `${field} deve ser uma data ISO.`,
      400,
      "INVALID_DATE",
    );
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TournamentServiceError(
      `${field} inválido.`,
      400,
      "INVALID_DATE",
    );
  }
  return date;
}

function parseOptionalNonNegativeInt(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new TournamentServiceError(
      `${field} deve ser um inteiro >= 0.`,
      400,
      "INVALID_INT",
    );
  }
  return n;
}

function parseOptionalPositiveInt(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 1) {
    throw new TournamentServiceError(
      `${field} deve ser um inteiro >= 1.`,
      400,
      "INVALID_INT",
    );
  }
  return n;
}

async function assertFormat(formatId: string | null | undefined) {
  if (formatId === undefined || formatId === null || formatId === "") {
    return null;
  }
  const format = await prisma.format.findFirst({
    where: { id: formatId, isActive: true },
    select: { id: true },
  });
  if (!format) {
    throw new TournamentServiceError(
      "Formato inválido.",
      400,
      "INVALID_FORMAT",
    );
  }
  return format.id;
}

async function getOwnedTournament(userId: string, tournamentId: string) {
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, userId },
    select: { id: true },
  });
  if (!tournament) {
    throw new TournamentServiceError(
      "Torneio não encontrado.",
      404,
      "TOURNAMENT_NOT_FOUND",
    );
  }
  return tournament;
}

export async function listTournaments(
  userId: string,
): Promise<TournamentListItemDto[]> {
  const rows = await prisma.tournament.findMany({
    where: { userId },
    include: tournamentListInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toListItem);
}

export async function getTournament(
  userId: string,
  tournamentId: string,
): Promise<TournamentDetailDto> {
  const row = await prisma.tournament.findFirst({
    where: { id: tournamentId, userId },
    include: tournamentDetailInclude,
  });
  if (!row) {
    throw new TournamentServiceError(
      "Torneio não encontrado.",
      404,
      "TOURNAMENT_NOT_FOUND",
    );
  }
  return toDetail(row);
}

export async function createTournament(
  userId: string,
  input: CreateTournamentInput,
): Promise<TournamentDetailDto> {
  const name = input.name?.trim();
  if (!name) {
    throw new TournamentServiceError(
      "Nome é obrigatório.",
      400,
      "NAME_REQUIRED",
    );
  }

  const formatId = await assertFormat(input.formatId);
  const date =
    input.date === undefined
      ? null
      : parseOptionalDate(input.date, "date");
  const location =
    input.location === undefined || input.location === null
      ? null
      : String(input.location).trim() || null;
  const placement = parseOptionalPositiveInt(input.placement, "placement");
  const participantCount = parseOptionalPositiveInt(
    input.participantCount,
    "participantCount",
  );

  const created = await prisma.tournament.create({
    data: {
      userId,
      name,
      date,
      location,
      formatId,
      placement: placement === undefined ? null : placement,
      participantCount:
        participantCount === undefined ? null : participantCount,
    },
    include: tournamentDetailInclude,
  });

  return toDetail(created);
}

export async function updateTournament(
  userId: string,
  tournamentId: string,
  input: UpdateTournamentInput,
): Promise<TournamentDetailDto> {
  await getOwnedTournament(userId, tournamentId);

  const data: Prisma.TournamentUpdateInput = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) {
      throw new TournamentServiceError(
        "Nome é obrigatório.",
        400,
        "NAME_REQUIRED",
      );
    }
    data.name = name;
  }

  if (input.date !== undefined) {
    data.date = parseOptionalDate(input.date, "date");
  }

  if (input.location !== undefined) {
    data.location =
      input.location === null ? null : String(input.location).trim() || null;
  }

  if (input.formatId !== undefined) {
    const formatId = await assertFormat(input.formatId);
    data.format = formatId
      ? { connect: { id: formatId } }
      : { disconnect: true };
  }

  if (input.placement !== undefined) {
    data.placement = parseOptionalPositiveInt(input.placement, "placement");
  }

  if (input.participantCount !== undefined) {
    data.participantCount = parseOptionalPositiveInt(
      input.participantCount,
      "participantCount",
    );
  }

  const updated = await prisma.tournament.update({
    where: { id: tournamentId },
    data,
    include: tournamentDetailInclude,
  });

  return toDetail(updated);
}

export async function deleteTournament(
  userId: string,
  tournamentId: string,
): Promise<void> {
  await getOwnedTournament(userId, tournamentId);
  await prisma.tournament.delete({ where: { id: tournamentId } });
}

export async function listAttachableMatches(
  userId: string,
): Promise<AttachableMatchDto[]> {
  const rows = await prisma.match.findMany({
    where: {
      userId,
      tournamentMatch: null,
    },
    select: {
      id: true,
      result: true,
      turnOrder: true,
      playedAt: true,
      notes: true,
      deck: { select: { id: true, name: true } },
      opponentArchetype: { select: { id: true, name: true } },
    },
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    result: row.result,
    turnOrder: row.turnOrder,
    playedAt: row.playedAt ? row.playedAt.toISOString() : null,
    notes: row.notes,
    deck: row.deck,
    opponentArchetype: row.opponentArchetype,
  }));
}

export async function attachMatch(
  userId: string,
  tournamentId: string,
  input: { matchId: string; round?: number | null },
): Promise<TournamentMatchSummaryDto> {
  await getOwnedTournament(userId, tournamentId);

  const matchId = input.matchId?.trim();
  if (!matchId) {
    throw new TournamentServiceError(
      "matchId é obrigatório.",
      400,
      "MATCH_ID_REQUIRED",
    );
  }

  const round = parseOptionalNonNegativeInt(input.round, "round");

  const match = await prisma.match.findFirst({
    where: { id: matchId, userId },
    select: {
      id: true,
      tournamentMatch: { select: { id: true, tournamentId: true } },
    },
  });

  if (!match) {
    throw new TournamentServiceError(
      "Partida não encontrada.",
      404,
      "MATCH_NOT_FOUND",
    );
  }

  if (match.tournamentMatch) {
    throw new TournamentServiceError(
      "Partida já vinculada a um torneio.",
      409,
      "MATCH_ALREADY_LINKED",
    );
  }

  try {
    const created = await prisma.tournamentMatch.create({
      data: {
        tournamentId,
        matchId,
        round: round === undefined ? null : round,
      },
      include: {
        match: {
          select: {
            id: true,
            result: true,
            turnOrder: true,
            playedAt: true,
            notes: true,
            deck: { select: { id: true, name: true } },
            opponentArchetype: { select: { id: true, name: true } },
          },
        },
      },
    });

    return toMatchSummary(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new TournamentServiceError(
        "Partida já vinculada a um torneio.",
        409,
        "MATCH_ALREADY_LINKED",
      );
    }
    throw error;
  }
}

export async function updateTournamentMatch(
  userId: string,
  tournamentId: string,
  matchId: string,
  input: { round?: number | null },
): Promise<TournamentMatchSummaryDto> {
  await getOwnedTournament(userId, tournamentId);

  const existing = await prisma.tournamentMatch.findFirst({
    where: { tournamentId, matchId },
    select: { id: true },
  });
  if (!existing) {
    throw new TournamentServiceError(
      "Vínculo torneio/partida não encontrado.",
      404,
      "TOURNAMENT_MATCH_NOT_FOUND",
    );
  }

  if (input.round === undefined) {
    throw new TournamentServiceError(
      "Nada para atualizar.",
      400,
      "EMPTY_UPDATE",
    );
  }

  const round = parseOptionalNonNegativeInt(input.round, "round");

  const updated = await prisma.tournamentMatch.update({
    where: { id: existing.id },
    data: { round: round === undefined ? null : round },
    include: {
      match: {
        select: {
          id: true,
          result: true,
          turnOrder: true,
          playedAt: true,
          notes: true,
          deck: { select: { id: true, name: true } },
          opponentArchetype: { select: { id: true, name: true } },
        },
      },
    },
  });

  return toMatchSummary(updated);
}

export async function detachMatch(
  userId: string,
  tournamentId: string,
  matchId: string,
): Promise<void> {
  await getOwnedTournament(userId, tournamentId);

  const existing = await prisma.tournamentMatch.findFirst({
    where: { tournamentId, matchId },
    select: { id: true },
  });
  if (!existing) {
    throw new TournamentServiceError(
      "Vínculo torneio/partida não encontrado.",
      404,
      "TOURNAMENT_MATCH_NOT_FOUND",
    );
  }

  await prisma.tournamentMatch.delete({ where: { id: existing.id } });
}
