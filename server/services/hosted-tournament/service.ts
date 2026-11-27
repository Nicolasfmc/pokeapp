/**
 * Hosted (organized) tournaments: registration, Swiss rounds, result
 * reporting, judge overrides and the round timer.
 *
 * Every mutation runs in a transaction that locks the tournament row
 * (SELECT … FOR UPDATE), so two simultaneous clicks can't create two rounds
 * or race a report against a judge decision. All queries go through Prisma
 * (parameterized).
 */
import { randomInt } from "node:crypto";
import {
  HostedDeckPolicy,
  HostedEntryStatus,
  HostedLocationType,
  HostedPairingResult,
  HostedPairingStatus,
  HostedResultSource,
  HostedRoundStatus,
  HostedTournamentStatus,
  Prisma,
  type HostedTournament,
} from "@prisma/client";
import { prisma } from "@/server/database";
import { getDeck } from "@/modules/decks";
import { consumeRateLimit, type DbRateLimit } from "@/server/auth/rate-limit-db";
import {
  computeStandings,
  isValidGameScore,
  outcomeFromGames,
  pairFirstRound,
  pairKey,
  pairNextRound,
  suggestedRounds,
  type Rng,
  type SwissResult,
} from "./swiss";
import type {
  HostedPairingDto,
  HostedPlayerRef,
  HostedRecord,
  HostedRoundDto,
  HostedTimerDto,
  HostedTournamentSettingsInput,
  HostedTournamentSummaryDto,
  HostedTournamentViewDto,
} from "@/modules/hosted-tournaments/types";

export class HostedTournamentError extends Error {
  status: number;
  code: string;
  retryAfterSec?: number;

  constructor(message: string, status: number, code: string, retryAfterSec?: number) {
    super(message);
    this.name = "HostedTournamentError";
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

const NOT_FOUND = () => new HostedTournamentError("Torneio não encontrado.", 404, "NOT_FOUND");
const FORBIDDEN = () =>
  new HostedTournamentError("Apenas o organizador pode fazer isso.", 403, "FORBIDDEN");

// ---------------------------------------------------------------------------
// Limits and validation
// ---------------------------------------------------------------------------

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const CODE_LENGTH = 10;
const CODE_PATTERN = /^[A-Za-z0-9]{10}$/;

export const HOSTED_LIMITS = {
  nameMin: 3,
  nameMax: 80,
  locationMax: 120,
  roundsMax: 20,
  minutesMin: 5,
  minutesMax: 180,
  playersMin: 2,
  playersMax: 512,
  pointsMax: 10,
  addMinutesMax: 60,
} as const;

const CREATE_LIMIT: DbRateLimit = { limit: 20, windowSeconds: 60 * 60 };
const JOIN_LIMIT: DbRateLimit = { limit: 40, windowSeconds: 10 * 60 };
const REPORT_LIMIT: DbRateLimit = { limit: 120, windowSeconds: 10 * 60 };

async function enforceRateLimit(key: string, options: DbRateLimit) {
  const result = await consumeRateLimit(key, options);
  if (!result.ok) {
    throw new HostedTournamentError(
      "Muitas requisições. Tente novamente em breve.",
      429,
      "RATE_LIMITED",
      result.retryAfterSec,
    );
  }
}

export function isValidTournamentCode(code: unknown): code is string {
  return typeof code === "string" && CODE_PATTERN.test(code);
}

function generateCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

const cryptoRng: Rng = (max) => randomInt(max);

function invalid(message: string, code = "INVALID_INPUT") {
  return new HostedTournamentError(message, 400, code);
}

function intInRange(value: unknown, min: number, max: number, message: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw invalid(message);
  }
  return value;
}

function optionalInt(value: unknown, min: number, max: number, message: string): number | null {
  if (value === null || value === "") return null;
  return intInRange(value, min, max, message);
}

function parseName(value: unknown) {
  if (typeof value !== "string") throw invalid("Nome do torneio é obrigatório.");
  const name = value.trim();
  if (name.length < HOSTED_LIMITS.nameMin || name.length > HOSTED_LIMITS.nameMax) {
    throw invalid("O nome do torneio deve ter entre 3 e 80 caracteres.");
  }
  return name;
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 40) throw invalid("Data inválida.");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw invalid("Data inválida.");
  const year = date.getUTCFullYear();
  if (year < 2000 || year > 2100) throw invalid("Data inválida.");
  return date;
}

function parseLocationType(value: unknown): HostedLocationType {
  if (value === HostedLocationType.IN_PERSON || value === HostedLocationType.ONLINE) return value;
  throw invalid("Tipo de local inválido.");
}

function parseLocation(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw invalid("Local inválido.");
  const location = value.trim();
  if (location.length > HOSTED_LIMITS.locationMax) throw invalid("Local muito longo.");
  return location || null;
}

function parseBestOf(value: unknown): number {
  if (value === 1 || value === 3) return value;
  throw invalid("Use MD1 ou MD3.");
}

function parseDeckPolicy(value: unknown): HostedDeckPolicy {
  if (value === HostedDeckPolicy.REQUIRED || value === HostedDeckPolicy.OPTIONAL) return value;
  throw invalid("Política de deck inválida.");
}

function checkPoints(win: number, draw: number, loss: number) {
  if (!(win > loss && draw >= loss && draw <= win)) {
    throw invalid("Pontos inválidos: vitória > derrota e empate entre os dois.");
  }
}

async function assertFormat(formatId: unknown) {
  if (typeof formatId !== "string" || formatId.length > 64) throw invalid("Formato inválido.");
  const format = await prisma.format.findFirst({
    where: { id: formatId, isActive: true },
    select: { id: true },
  });
  if (!format) throw invalid("Formato inválido.");
  return format.id;
}

// ---------------------------------------------------------------------------
// Locking helpers
// ---------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;
type TournamentRow = HostedTournament;

const TX_OPTIONS = { maxWait: 10_000, timeout: 60_000 } as const;

async function lockTournament(tx: Tx, code: string): Promise<TournamentRow> {
  if (!isValidTournamentCode(code)) throw NOT_FOUND();
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM hosted_tournaments WHERE code = ${code} FOR UPDATE
  `;
  const id = rows[0]?.id;
  if (!id) throw NOT_FOUND();
  return tx.hostedTournament.findUniqueOrThrow({ where: { id } });
}

function assertOrganizer(tournament: TournamentRow, userId: string) {
  if (tournament.organizerId !== userId) throw FORBIDDEN();
}

function assertStatus(tournament: TournamentRow, ...allowed: HostedTournamentStatus[]) {
  if (!allowed.includes(tournament.status)) {
    const message =
      tournament.status === HostedTournamentStatus.FINISHED
        ? "O torneio já foi encerrado."
        : tournament.status === HostedTournamentStatus.IN_PROGRESS
          ? "O torneio já começou."
          : "O torneio ainda não começou.";
    throw new HostedTournamentError(message, 409, "INVALID_STATE");
  }
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

type RoundTimerFields = {
  durationSeconds: number;
  startedAt: Date;
  pausedAt: Date | null;
  pausedSeconds: number;
};

function roundEndMs(round: RoundTimerFields) {
  return round.startedAt.getTime() + (round.durationSeconds + round.pausedSeconds) * 1000;
}

export function timerState(round: RoundTimerFields & { status: HostedRoundStatus }, now: Date): HostedTimerDto {
  const end = roundEndMs(round);
  const reference = round.pausedAt ? round.pausedAt.getTime() : now.getTime();
  const remainingSeconds = Math.max(0, Math.ceil((end - reference) / 1000));
  return {
    durationSeconds: round.durationSeconds,
    remainingSeconds,
    endsAt: round.pausedAt ? null : new Date(end).toISOString(),
    paused: Boolean(round.pausedAt),
    expired: remainingSeconds === 0,
  };
}

/**
 * When the round timer reaches zero: pairings nobody reported become draws,
 * and pairings waiting for a confirmation go to the judge as disputes.
 * Idempotent; runs inside the tournament lock.
 */
async function applyTimeout(tx: Tx, tournament: TournamentRow, now: Date) {
  if (tournament.status !== HostedTournamentStatus.IN_PROGRESS) return false;
  const round = await tx.hostedTournamentRound.findUnique({
    where: { tournamentId_number: { tournamentId: tournament.id, number: tournament.currentRound } },
  });
  if (!round || round.status !== HostedRoundStatus.IN_PROGRESS) return false;
  if (round.timeoutAppliedAt || round.pausedAt) return false;
  if (roundEndMs(round) > now.getTime()) return false;

  await tx.hostedPairing.updateMany({
    where: { roundId: round.id, status: HostedPairingStatus.PENDING },
    data: {
      status: HostedPairingStatus.CONFIRMED,
      result: HostedPairingResult.DRAW,
      player1Games: 0,
      player2Games: 0,
      drawGames: 0,
      source: HostedResultSource.TIMER,
      confirmedAt: now,
    },
  });
  await tx.hostedPairing.updateMany({
    where: { roundId: round.id, status: HostedPairingStatus.AWAITING_CONFIRMATION },
    data: { status: HostedPairingStatus.DISPUTED },
  });
  await tx.hostedTournamentRound.update({
    where: { id: round.id },
    data: { timeoutAppliedAt: now },
  });
  return true;
}

/** Cheap check used by reads: applies the timeout only when it is due. */
async function applyTimeoutIfDue(tournamentId: string, code: string) {
  const now = new Date();
  const due = await prisma.hostedTournamentRound.findFirst({
    where: {
      tournamentId,
      status: HostedRoundStatus.IN_PROGRESS,
      timeoutAppliedAt: null,
      pausedAt: null,
      tournament: { status: HostedTournamentStatus.IN_PROGRESS },
    },
    select: { durationSeconds: true, startedAt: true, pausedAt: true, pausedSeconds: true },
  });
  if (!due || roundEndMs(due) > now.getTime()) return;
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    await applyTimeout(tx, tournament, new Date());
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

export async function createHostedTournament(userId: string, input: HostedTournamentSettingsInput) {
  await enforceRateLimit(`hosted:create:${userId}`, CREATE_LIMIT);

  const name = parseName(input.name);
  const date = parseDate(input.date ?? null);
  const locationType = parseLocationType(input.locationType);
  const location = locationType === HostedLocationType.ONLINE ? null : parseLocation(input.location);
  if (locationType === HostedLocationType.IN_PERSON && !location) {
    throw invalid("Informe o local do torneio.");
  }
  const formatId = await assertFormat(input.formatId);
  const bestOf = parseBestOf(input.bestOf);
  const pointsWin = intInRange(input.pointsWin ?? 3, 0, HOSTED_LIMITS.pointsMax, "Pontos inválidos.");
  const pointsDraw = intInRange(input.pointsDraw ?? 1, 0, HOSTED_LIMITS.pointsMax, "Pontos inválidos.");
  const pointsLoss = intInRange(input.pointsLoss ?? 0, 0, HOSTED_LIMITS.pointsMax, "Pontos inválidos.");
  checkPoints(pointsWin, pointsDraw, pointsLoss);
  const deckPolicy = parseDeckPolicy(input.deckPolicy);
  const plannedRounds = optionalInt(input.plannedRounds ?? null, 1, HOSTED_LIMITS.roundsMax, "Número de rodadas inválido.");
  const roundMinutes = intInRange(
    input.roundMinutes ?? (bestOf === 3 ? 50 : 30),
    HOSTED_LIMITS.minutesMin,
    HOSTED_LIMITS.minutesMax,
    "Tempo de rodada inválido.",
  );
  const maxPlayers = optionalInt(
    input.maxPlayers ?? null,
    HOSTED_LIMITS.playersMin,
    HOSTED_LIMITS.playersMax,
    "Limite de jogadores inválido.",
  );

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await prisma.hostedTournament.create({
        data: {
          code: generateCode(),
          organizerId: userId,
          name,
          date,
          locationType,
          location,
          formatId,
          bestOf,
          pointsWin,
          pointsDraw,
          pointsLoss,
          deckPolicy,
          plannedRounds,
          roundMinutes,
          maxPlayers,
        },
        select: { code: true },
      });
      return created;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new HostedTournamentError("Erro interno.", 500, "INTERNAL");
}

export async function updateHostedTournament(
  userId: string,
  code: string,
  input: HostedTournamentSettingsInput,
) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    assertStatus(tournament, HostedTournamentStatus.REGISTRATION, HostedTournamentStatus.IN_PROGRESS);
    const registration = tournament.status === HostedTournamentStatus.REGISTRATION;

    const data: Prisma.HostedTournamentUpdateInput = {};
    if (input.name !== undefined) data.name = parseName(input.name);
    if (input.date !== undefined) data.date = parseDate(input.date);
    if (input.locationType !== undefined || input.location !== undefined) {
      const locationType =
        input.locationType !== undefined ? parseLocationType(input.locationType) : tournament.locationType;
      const location =
        locationType === HostedLocationType.ONLINE
          ? null
          : input.location !== undefined
            ? parseLocation(input.location)
            : tournament.location;
      if (locationType === HostedLocationType.IN_PERSON && !location) {
        throw invalid("Informe o local do torneio.");
      }
      data.locationType = locationType;
      data.location = location;
    }
    if (input.roundMinutes !== undefined) {
      data.roundMinutes = intInRange(
        input.roundMinutes,
        HOSTED_LIMITS.minutesMin,
        HOSTED_LIMITS.minutesMax,
        "Tempo de rodada inválido.",
      );
    }
    if (input.plannedRounds !== undefined) {
      const rounds = optionalInt(input.plannedRounds, 1, HOSTED_LIMITS.roundsMax, "Número de rodadas inválido.");
      if (!registration && (rounds === null || rounds < tournament.currentRound)) {
        throw invalid("O número de rodadas não pode ser menor que a rodada atual.");
      }
      data.plannedRounds = rounds;
    }

    const lockedFields = [
      "formatId",
      "bestOf",
      "pointsWin",
      "pointsDraw",
      "pointsLoss",
      "deckPolicy",
      "maxPlayers",
    ] as const;
    const touchesLocked = lockedFields.some((field) => input[field] !== undefined);
    if (touchesLocked && !registration) {
      throw new HostedTournamentError(
        "Essas configurações só podem mudar antes do início.",
        409,
        "INVALID_STATE",
      );
    }
    if (touchesLocked) {
      if (input.formatId !== undefined) {
        const formatId = await assertFormat(input.formatId);
        data.format = { connect: { id: formatId } };
      }
      if (input.bestOf !== undefined) data.bestOf = parseBestOf(input.bestOf);
      const win =
        input.pointsWin !== undefined
          ? intInRange(input.pointsWin, 0, HOSTED_LIMITS.pointsMax, "Pontos inválidos.")
          : tournament.pointsWin;
      const draw =
        input.pointsDraw !== undefined
          ? intInRange(input.pointsDraw, 0, HOSTED_LIMITS.pointsMax, "Pontos inválidos.")
          : tournament.pointsDraw;
      const loss =
        input.pointsLoss !== undefined
          ? intInRange(input.pointsLoss, 0, HOSTED_LIMITS.pointsMax, "Pontos inválidos.")
          : tournament.pointsLoss;
      checkPoints(win, draw, loss);
      data.pointsWin = win;
      data.pointsDraw = draw;
      data.pointsLoss = loss;
      if (input.deckPolicy !== undefined) data.deckPolicy = parseDeckPolicy(input.deckPolicy);
      if (input.maxPlayers !== undefined) {
        const max = optionalInt(
          input.maxPlayers,
          HOSTED_LIMITS.playersMin,
          HOSTED_LIMITS.playersMax,
          "Limite de jogadores inválido.",
        );
        if (max !== null) {
          const count = await tx.hostedTournamentEntry.count({ where: { tournamentId: tournament.id } });
          if (count > max) throw invalid("Já há mais inscritos que esse limite.");
        }
        data.maxPlayers = max;
      }
    }

    await tx.hostedTournament.update({ where: { id: tournament.id }, data });
  }, TX_OPTIONS);
}

export async function deleteHostedTournament(userId: string, code: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    assertStatus(tournament, HostedTournamentStatus.REGISTRATION);
    await tx.hostedTournament.delete({ where: { id: tournament.id } });
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

async function assertEligibleDeck(
  tx: Tx,
  userId: string,
  tournament: TournamentRow,
  deckId: unknown,
): Promise<string | null> {
  if (deckId === null || deckId === undefined || deckId === "") {
    if (tournament.deckPolicy === HostedDeckPolicy.REQUIRED) {
      throw invalid("Este torneio exige uma lista de deck.", "DECK_REQUIRED");
    }
    return null;
  }
  if (typeof deckId !== "string" || deckId.length > 64) throw invalid("Deck inválido.");
  const deck = await tx.deck.findFirst({
    where: { id: deckId, userId },
    select: { id: true, formatId: true, _count: { select: { cards: true } } },
  });
  if (!deck) throw new HostedTournamentError("Deck não encontrado.", 404, "DECK_NOT_FOUND");
  if (deck.formatId !== tournament.formatId) {
    throw invalid("O deck precisa ser do formato do torneio.", "DECK_FORMAT");
  }
  if (deck._count.cards === 0) throw invalid("Deck sem cartas", "DECK_EMPTY");
  return deck.id;
}

export async function joinHostedTournament(userId: string, code: string, deckId: unknown) {
  await enforceRateLimit(`hosted:join:${userId}`, JOIN_LIMIT);
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertStatus(tournament, HostedTournamentStatus.REGISTRATION);
    const existing = await tx.hostedTournamentEntry.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
      select: { id: true },
    });
    if (existing) throw new HostedTournamentError("Você já está inscrito.", 409, "ALREADY_JOINED");
    if (tournament.maxPlayers !== null) {
      const count = await tx.hostedTournamentEntry.count({ where: { tournamentId: tournament.id } });
      if (count >= tournament.maxPlayers) {
        throw new HostedTournamentError("O torneio está lotado.", 409, "FULL");
      }
    }
    const validDeckId = await assertEligibleDeck(tx, userId, tournament, deckId);
    await tx.hostedTournamentEntry.create({
      data: { tournamentId: tournament.id, userId, deckId: validDeckId },
    });
  }, TX_OPTIONS);
}

export async function changeEntryDeck(userId: string, code: string, deckId: unknown) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertStatus(tournament, HostedTournamentStatus.REGISTRATION);
    const entry = await tx.hostedTournamentEntry.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
      select: { id: true },
    });
    if (!entry) throw new HostedTournamentError("Você não está inscrito.", 404, "NOT_JOINED");
    const validDeckId = await assertEligibleDeck(tx, userId, tournament, deckId);
    await tx.hostedTournamentEntry.update({ where: { id: entry.id }, data: { deckId: validDeckId } });
  }, TX_OPTIONS);
}

/** Before the start: leaves the tournament. During it: drops (results stay). */
export async function leaveHostedTournament(userId: string, code: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertStatus(tournament, HostedTournamentStatus.REGISTRATION, HostedTournamentStatus.IN_PROGRESS);
    const entry = await tx.hostedTournamentEntry.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
    });
    if (!entry) throw new HostedTournamentError("Você não está inscrito.", 404, "NOT_JOINED");
    if (tournament.status === HostedTournamentStatus.REGISTRATION) {
      await tx.hostedTournamentEntry.delete({ where: { id: entry.id } });
      return;
    }
    if (entry.status === HostedEntryStatus.DROPPED) return;
    await tx.hostedTournamentEntry.update({
      where: { id: entry.id },
      data: { status: HostedEntryStatus.DROPPED, droppedAfterRound: tournament.currentRound },
    });
  }, TX_OPTIONS);
}

/** Organizer: remove (before start), drop or reinstate (during) a player. */
export async function manageEntry(
  userId: string,
  code: string,
  entryId: string,
  action: unknown,
) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    const entry = await tx.hostedTournamentEntry.findFirst({
      where: { id: entryId, tournamentId: tournament.id },
    });
    if (!entry) throw new HostedTournamentError("Jogador não encontrado.", 404, "ENTRY_NOT_FOUND");

    if (action === "remove") {
      assertStatus(tournament, HostedTournamentStatus.REGISTRATION);
      await tx.hostedTournamentEntry.delete({ where: { id: entry.id } });
      return;
    }
    assertStatus(tournament, HostedTournamentStatus.IN_PROGRESS);
    if (action === "drop") {
      if (entry.status === HostedEntryStatus.DROPPED) return;
      await tx.hostedTournamentEntry.update({
        where: { id: entry.id },
        data: { status: HostedEntryStatus.DROPPED, droppedAfterRound: tournament.currentRound },
      });
      return;
    }
    if (action === "reinstate") {
      await tx.hostedTournamentEntry.update({
        where: { id: entry.id },
        data: { status: HostedEntryStatus.ACTIVE, droppedAfterRound: null },
      });
      return;
    }
    throw invalid("Ação inválida.");
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

type PlanInput = { pairs: Array<[string, string]>; bye: string | null };

async function createRound(tx: Tx, tournament: TournamentRow, number: number, plan: PlanInput, now: Date) {
  const round = await tx.hostedTournamentRound.create({
    data: {
      tournamentId: tournament.id,
      number,
      durationSeconds: tournament.roundMinutes * 60,
      startedAt: now,
    },
    select: { id: true },
  });
  const rows: Prisma.HostedPairingCreateManyInput[] = plan.pairs.map(([a, b], index) => ({
    roundId: round.id,
    tableNumber: index + 1,
    player1Id: a,
    player2Id: b,
  }));
  if (plan.bye) {
    rows.push({
      roundId: round.id,
      tableNumber: null,
      player1Id: plan.bye,
      player2Id: null,
      status: HostedPairingStatus.BYE,
      result: HostedPairingResult.PLAYER1_WIN,
      source: HostedResultSource.BYE,
      confirmedAt: now,
    });
  }
  await tx.hostedPairing.createMany({ data: rows });
}

async function snapshotDecks(tx: Tx, tournament: TournamentRow) {
  const entries = await tx.hostedTournamentEntry.findMany({
    where: { tournamentId: tournament.id, deckId: { not: null } },
    select: { id: true, userId: true, deckId: true },
  });
  if (entries.length === 0) return;

  const archetypeIds = new Set<string>();
  const decks = [];
  for (const entry of entries) {
    const deck = await getDeck(entry.userId, entry.deckId!);
    if (deck.archetypeId) archetypeIds.add(deck.archetypeId);
    decks.push({ entry, deck });
  }
  const archetypes = await tx.archetype.findMany({
    where: { id: { in: [...archetypeIds] } },
    select: { id: true, name: true, displayPokemon: true },
  });
  const byId = new Map(archetypes.map((a) => [a.id, a]));

  await tx.hostedDeckSnapshot.createMany({
    data: decks.map(({ entry, deck }) => {
      const archetype = deck.archetypeId ? byId.get(deck.archetypeId) : undefined;
      return {
        entryId: entry.id,
        deckName: deck.name,
        archetypeId: archetype?.id ?? null,
        archetypeName: archetype?.name ?? null,
        displayPokemon: (archetype?.displayPokemon ?? undefined) as Prisma.InputJsonValue | undefined,
        coverImageUrl: deck.coverImageUrl,
        cards: deck.cards.map((card) => ({
          logicalCardId: card.logicalCardId,
          name: card.canonicalName,
          category: card.category,
          quantity: card.quantity,
          imageUrl: card.imageUrl,
        })),
        cardCount: deck.cardCount,
      };
    }),
  });
}

export async function startHostedTournament(userId: string, code: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    assertStatus(tournament, HostedTournamentStatus.REGISTRATION);

    const entries = await tx.hostedTournamentEntry.findMany({
      where: { tournamentId: tournament.id, status: HostedEntryStatus.ACTIVE },
      select: {
        id: true,
        deckId: true,
        deck: { select: { formatId: true, _count: { select: { cards: true } } } },
      },
    });
    if (entries.length < HOSTED_LIMITS.playersMin) {
      throw new HostedTournamentError("São necessários pelo menos 2 jogadores.", 409, "NOT_ENOUGH_PLAYERS");
    }
    if (tournament.deckPolicy === HostedDeckPolicy.REQUIRED) {
      const missing = entries.filter(
        (e) => !e.deck || e.deck.formatId !== tournament.formatId || e.deck._count.cards === 0,
      );
      if (missing.length > 0) {
        throw new HostedTournamentError(
          "Há jogadores sem uma lista válida para o formato.",
          409,
          "DECKS_MISSING",
        );
      }
    }

    await snapshotDecks(tx, tournament);

    const now = new Date();
    const plan = pairFirstRound(
      entries.map((e) => e.id),
      cryptoRng,
    );
    await tx.hostedTournament.update({
      where: { id: tournament.id },
      data: {
        status: HostedTournamentStatus.IN_PROGRESS,
        currentRound: 1,
        startedAt: now,
        plannedRounds: tournament.plannedRounds ?? suggestedRounds(entries.length),
      },
    });
    await createRound(tx, tournament, 1, plan, now);
  }, TX_OPTIONS);
}

type ClosedPairing = {
  player1Id: string;
  player2Id: string | null;
  result: HostedPairingResult | null;
  status: HostedPairingStatus;
};

function closedResults(pairings: ClosedPairing[]): SwissResult[] {
  return pairings
    .filter(
      (p) =>
        (p.status === HostedPairingStatus.CONFIRMED || p.status === HostedPairingStatus.BYE) &&
        p.result !== null,
    )
    .map((p) => ({ player1Id: p.player1Id, player2Id: p.player2Id, outcome: p.result! }));
}

async function assertRoundClosed(tx: Tx, tournament: TournamentRow) {
  const open = await tx.hostedPairing.count({
    where: {
      round: { tournamentId: tournament.id, number: tournament.currentRound },
      status: {
        in: [
          HostedPairingStatus.PENDING,
          HostedPairingStatus.AWAITING_CONFIRMATION,
          HostedPairingStatus.DISPUTED,
        ],
      },
    },
  });
  if (open > 0) {
    throw new HostedTournamentError(
      "Ainda há partidas sem resultado confirmado nesta rodada.",
      409,
      "ROUND_OPEN",
    );
  }
}

export async function startNextRound(userId: string, code: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    assertStatus(tournament, HostedTournamentStatus.IN_PROGRESS);
    const now = new Date();
    await applyTimeout(tx, tournament, now);
    await assertRoundClosed(tx, tournament);
    if (tournament.plannedRounds !== null && tournament.currentRound >= tournament.plannedRounds) {
      throw new HostedTournamentError(
        "Todas as rodadas já foram jogadas. Encerre o torneio ou aumente o número de rodadas.",
        409,
        "LAST_ROUND",
      );
    }

    const entries = await tx.hostedTournamentEntry.findMany({
      where: { tournamentId: tournament.id },
      select: {
        id: true,
        status: true,
        user: { select: { username: true } },
      },
    });
    const active = entries.filter((e) => e.status === HostedEntryStatus.ACTIVE);
    if (active.length < HOSTED_LIMITS.playersMin) {
      throw new HostedTournamentError(
        "Não há jogadores ativos suficientes para outra rodada.",
        409,
        "NOT_ENOUGH_PLAYERS",
      );
    }

    const pairings = await tx.hostedPairing.findMany({
      where: { round: { tournamentId: tournament.id } },
      select: { player1Id: true, player2Id: true, result: true, status: true },
    });
    const standings = computeStandings(
      entries.map((e) => ({ id: e.id, name: e.user.username, active: e.status === HostedEntryStatus.ACTIVE })),
      closedResults(pairings),
      { win: tournament.pointsWin, draw: tournament.pointsDraw, loss: tournament.pointsLoss },
    );
    const activeIds = new Set(active.map((e) => e.id));
    const played = new Set<string>();
    const hadBye = new Set<string>();
    for (const p of pairings) {
      if (p.player2Id) played.add(pairKey(p.player1Id, p.player2Id));
      else hadBye.add(p.player1Id);
    }
    const plan = pairNextRound(
      standings.filter((row) => activeIds.has(row.playerId)),
      played,
      hadBye,
      cryptoRng,
    );

    await tx.hostedTournamentRound.update({
      where: { tournamentId_number: { tournamentId: tournament.id, number: tournament.currentRound } },
      data: { status: HostedRoundStatus.FINISHED, finishedAt: now, pausedAt: null },
    });
    const next = tournament.currentRound + 1;
    await tx.hostedTournament.update({ where: { id: tournament.id }, data: { currentRound: next } });
    await createRound(tx, tournament, next, plan, now);
  }, TX_OPTIONS);
}

export async function finishHostedTournament(userId: string, code: string) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    assertStatus(tournament, HostedTournamentStatus.IN_PROGRESS);
    const now = new Date();
    await applyTimeout(tx, tournament, now);
    await assertRoundClosed(tx, tournament);
    await tx.hostedTournamentRound.updateMany({
      where: { tournamentId: tournament.id, status: HostedRoundStatus.IN_PROGRESS },
      data: { status: HostedRoundStatus.FINISHED, finishedAt: now, pausedAt: null },
    });
    await tx.hostedTournament.update({
      where: { id: tournament.id },
      data: {
        status: HostedTournamentStatus.FINISHED,
        finishedAt: now,
        plannedRounds: tournament.currentRound,
      },
    });
  }, TX_OPTIONS);
}

export async function controlTimer(userId: string, code: string, action: unknown, minutes: unknown) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    assertStatus(tournament, HostedTournamentStatus.IN_PROGRESS);
    const now = new Date();
    await applyTimeout(tx, tournament, now);
    const round = await tx.hostedTournamentRound.findUniqueOrThrow({
      where: { tournamentId_number: { tournamentId: tournament.id, number: tournament.currentRound } },
    });

    if (action === "pause") {
      if (round.pausedAt) return;
      await tx.hostedTournamentRound.update({ where: { id: round.id }, data: { pausedAt: now } });
      return;
    }
    if (action === "resume") {
      if (!round.pausedAt) return;
      const paused = Math.round((now.getTime() - round.pausedAt.getTime()) / 1000);
      await tx.hostedTournamentRound.update({
        where: { id: round.id },
        data: { pausedAt: null, pausedSeconds: round.pausedSeconds + paused },
      });
      return;
    }
    if (action === "add") {
      const delta = intInRange(
        minutes,
        -HOSTED_LIMITS.addMinutesMax,
        HOSTED_LIMITS.addMinutesMax,
        "Minutos inválidos.",
      );
      if (delta === 0) return;
      const durationSeconds = Math.max(60, round.durationSeconds + delta * 60);
      const updated = { ...round, durationSeconds };
      const reference = round.pausedAt ? round.pausedAt.getTime() : now.getTime();
      const stillRunning = roundEndMs(updated) > reference;
      await tx.hostedTournamentRound.update({
        where: { id: round.id },
        data: {
          durationSeconds,
          ...(stillRunning ? { timeoutAppliedAt: null } : {}),
        },
      });
      if (stillRunning && round.timeoutAppliedAt) {
        // Time was added after it ran out: undo the automatic draws.
        await tx.hostedPairing.updateMany({
          where: { roundId: round.id, source: HostedResultSource.TIMER },
          data: {
            status: HostedPairingStatus.PENDING,
            result: null,
            source: null,
            confirmedAt: null,
          },
        });
      }
      return;
    }
    throw invalid("Ação inválida.");
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

type GameScoreInput = { myGames?: unknown; opponentGames?: unknown; drawGames?: unknown };

function parseScore(bestOf: number, a: unknown, b: unknown, draws: unknown) {
  const values = [a, b, draws ?? 0];
  if (!values.every((v) => typeof v === "number" && Number.isInteger(v))) {
    throw invalid("Placar inválido.", "INVALID_SCORE");
  }
  const [x, y, z] = values as number[];
  if (!isValidGameScore(bestOf, x, y, z)) throw invalid("Placar inválido.", "INVALID_SCORE");
  return [x, y, z] as const;
}

async function loadPairing(tx: Tx, tournament: TournamentRow, pairingId: string) {
  if (typeof pairingId !== "string" || pairingId.length > 64) {
    throw new HostedTournamentError("Partida não encontrada.", 404, "PAIRING_NOT_FOUND");
  }
  const pairing = await tx.hostedPairing.findFirst({
    where: { id: pairingId, round: { tournamentId: tournament.id } },
    include: { round: { select: { number: true } } },
  });
  if (!pairing) throw new HostedTournamentError("Partida não encontrada.", 404, "PAIRING_NOT_FOUND");
  return pairing;
}

async function viewerEntryId(tx: Tx, tournament: TournamentRow, userId: string) {
  const entry = await tx.hostedTournamentEntry.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId } },
    select: { id: true },
  });
  return entry?.id ?? null;
}

const REPORTABLE: HostedPairingStatus[] = [
  HostedPairingStatus.PENDING,
  HostedPairingStatus.AWAITING_CONFIRMATION,
  HostedPairingStatus.DISPUTED,
];

export async function reportResult(userId: string, code: string, pairingId: string, input: GameScoreInput) {
  await enforceRateLimit(`hosted:report:${userId}`, REPORT_LIMIT);
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertStatus(tournament, HostedTournamentStatus.IN_PROGRESS);
    const now = new Date();
    await applyTimeout(tx, tournament, now);
    const pairing = await loadPairing(tx, tournament, pairingId);
    const entryId = await viewerEntryId(tx, tournament, userId);
    if (!entryId || (pairing.player1Id !== entryId && pairing.player2Id !== entryId) || !pairing.player2Id) {
      throw new HostedTournamentError("Você não joga esta partida.", 403, "NOT_YOUR_MATCH");
    }
    if (pairing.round.number !== tournament.currentRound) {
      throw new HostedTournamentError("Esta rodada já foi fechada.", 409, "ROUND_CLOSED");
    }
    const timerDraw =
      pairing.status === HostedPairingStatus.CONFIRMED && pairing.source === HostedResultSource.TIMER;
    if (!REPORTABLE.includes(pairing.status) && !timerDraw) {
      throw new HostedTournamentError("O resultado desta partida já foi confirmado.", 409, "ALREADY_CONFIRMED");
    }

    const [mine, theirs, draws] = parseScore(tournament.bestOf, input.myGames, input.opponentGames, input.drawGames);
    const isPlayer1 = pairing.player1Id === entryId;
    const player1Games = isPlayer1 ? mine : theirs;
    const player2Games = isPlayer1 ? theirs : mine;
    const result = outcomeFromGames(player1Games, player2Games);

    // The opponent already reported: same score confirms, a different one disputes.
    if (
      pairing.status === HostedPairingStatus.AWAITING_CONFIRMATION &&
      pairing.reportedByEntryId &&
      pairing.reportedByEntryId !== entryId
    ) {
      const same =
        pairing.player1Games === player1Games &&
        pairing.player2Games === player2Games &&
        pairing.drawGames === draws;
      await tx.hostedPairing.update({
        where: { id: pairing.id },
        data: same
          ? { status: HostedPairingStatus.CONFIRMED, confirmedAt: now, source: HostedResultSource.PLAYERS }
          : { status: HostedPairingStatus.DISPUTED },
      });
      return;
    }

    await tx.hostedPairing.update({
      where: { id: pairing.id },
      data: {
        status: HostedPairingStatus.AWAITING_CONFIRMATION,
        result,
        player1Games,
        player2Games,
        drawGames: draws,
        source: HostedResultSource.PLAYERS,
        reportedByEntryId: entryId,
        reportedAt: now,
        confirmedAt: null,
      },
    });
  }, TX_OPTIONS);
}

export async function respondToReport(userId: string, code: string, pairingId: string, accept: boolean) {
  await enforceRateLimit(`hosted:report:${userId}`, REPORT_LIMIT);
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertStatus(tournament, HostedTournamentStatus.IN_PROGRESS);
    const now = new Date();
    await applyTimeout(tx, tournament, now);
    const pairing = await loadPairing(tx, tournament, pairingId);
    const entryId = await viewerEntryId(tx, tournament, userId);
    const isPlayer = entryId && (pairing.player1Id === entryId || pairing.player2Id === entryId);
    if (!isPlayer) throw new HostedTournamentError("Você não joga esta partida.", 403, "NOT_YOUR_MATCH");
    if (pairing.status !== HostedPairingStatus.AWAITING_CONFIRMATION || pairing.reportedByEntryId === entryId) {
      throw new HostedTournamentError("Não há resultado para confirmar.", 409, "NOTHING_TO_CONFIRM");
    }
    await tx.hostedPairing.update({
      where: { id: pairing.id },
      data: accept
        ? { status: HostedPairingStatus.CONFIRMED, confirmedAt: now }
        : { status: HostedPairingStatus.DISPUTED },
    });
  }, TX_OPTIONS);
}

/** Judge (organizer): sets the final result of any pairing, or reopens one of the current round. */
export async function judgeResult(
  userId: string,
  code: string,
  pairingId: string,
  input: { player1Games?: unknown; player2Games?: unknown; drawGames?: unknown; reset?: unknown },
) {
  await prisma.$transaction(async (tx) => {
    const tournament = await lockTournament(tx, code);
    assertOrganizer(tournament, userId);
    assertStatus(tournament, HostedTournamentStatus.IN_PROGRESS);
    const now = new Date();
    await applyTimeout(tx, tournament, now);
    const pairing = await loadPairing(tx, tournament, pairingId);
    if (!pairing.player2Id) throw invalid("Um bye não tem resultado para alterar.");

    if (input.reset === true) {
      if (pairing.round.number !== tournament.currentRound) {
        throw invalid("Só é possível reabrir partidas da rodada atual.");
      }
      await tx.hostedPairing.update({
        where: { id: pairing.id },
        data: {
          status: HostedPairingStatus.PENDING,
          result: null,
          player1Games: 0,
          player2Games: 0,
          drawGames: 0,
          source: null,
          reportedByEntryId: null,
          reportedAt: null,
          confirmedAt: null,
        },
      });
      return;
    }

    const [p1, p2, draws] = parseScore(tournament.bestOf, input.player1Games, input.player2Games, input.drawGames);
    await tx.hostedPairing.update({
      where: { id: pairing.id },
      data: {
        status: HostedPairingStatus.CONFIRMED,
        result: outcomeFromGames(p1, p2),
        player1Games: p1,
        player2Games: p2,
        drawGames: draws,
        source: HostedResultSource.JUDGE,
        confirmedAt: now,
      },
    });
  }, TX_OPTIONS);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function displayNameOf(user: { username: string; profile: { displayName: string } | null }) {
  return user.profile?.displayName?.trim() || user.username;
}

const userSelect = { username: true, profile: { select: { displayName: true } } } as const;

export async function getHostedTournamentView(
  code: string,
  viewerUserId: string | null,
): Promise<HostedTournamentViewDto> {
  if (!isValidTournamentCode(code)) throw NOT_FOUND();
  const head = await prisma.hostedTournament.findUnique({ where: { code }, select: { id: true } });
  if (!head) throw NOT_FOUND();
  await applyTimeoutIfDue(head.id, code);

  const tournament = await prisma.hostedTournament.findUniqueOrThrow({
    where: { id: head.id },
    include: {
      format: { select: { id: true, name: true, code: true } },
      organizer: { select: userSelect },
      entries: {
        orderBy: { joinedAt: "asc" },
        select: {
          id: true,
          userId: true,
          deckId: true,
          status: true,
          deck: { select: { id: true, name: true } },
          user: { select: userSelect },
        },
      },
      rounds: {
        orderBy: { number: "asc" },
        include: { pairings: { orderBy: [{ tableNumber: { sort: "asc", nulls: "last" } }, { id: "asc" }] } },
      },
    },
  });

  const now = new Date();
  const organizerId = tournament.organizerId;
  const refs = new Map<string, HostedPlayerRef>();
  for (const entry of tournament.entries) {
    refs.set(entry.id, {
      entryId: entry.id,
      username: entry.user.username,
      displayName: displayNameOf(entry.user),
      isJudge: entry.userId === organizerId,
      dropped: entry.status === HostedEntryStatus.DROPPED,
    });
  }

  const viewerEntry = viewerUserId
    ? (tournament.entries.find((e) => e.userId === viewerUserId) ?? null)
    : null;
  const isOrganizer = viewerUserId !== null && viewerUserId === organizerId;
  const inProgress = tournament.status === HostedTournamentStatus.IN_PROGRESS;
  const registration = tournament.status === HostedTournamentStatus.REGISTRATION;

  // Record of each player entering each round ("3/2/1" next to the name).
  const running = new Map<string, HostedRecord>();
  for (const entry of tournament.entries) running.set(entry.id, { wins: 0, losses: 0, draws: 0 });
  const recordOf = (id: string) => ({ ...(running.get(id) ?? { wins: 0, losses: 0, draws: 0 }) });

  const rounds: HostedRoundDto[] = [];
  const allPairings: ClosedPairing[] = [];
  for (const round of tournament.rounds) {
    const isCurrent = inProgress && round.number === tournament.currentRound;
    const pairings: HostedPairingDto[] = round.pairings.map((p) => {
      const p1 = refs.get(p.player1Id)!;
      const p2 = p.player2Id ? refs.get(p.player2Id)! : null;
      const viewerPlays =
        viewerEntry !== null && (p.player1Id === viewerEntry.id || p.player2Id === viewerEntry.id);
      const timerDraw = p.status === HostedPairingStatus.CONFIRMED && p.source === HostedResultSource.TIMER;
      return {
        id: p.id,
        tableNumber: p.tableNumber,
        player1: { ...p1, record: recordOf(p.player1Id) },
        player2: p2 && p.player2Id ? { ...p2, record: recordOf(p.player2Id) } : null,
        status: p.status,
        result: p.result,
        player1Games: p.player1Games,
        player2Games: p.player2Games,
        drawGames: p.drawGames,
        source: p.source,
        reportedByEntryId: p.reportedByEntryId,
        canReport:
          isCurrent && viewerPlays && p.player2Id !== null && (REPORTABLE.includes(p.status) || timerDraw),
        canConfirm:
          isCurrent &&
          viewerPlays &&
          p.status === HostedPairingStatus.AWAITING_CONFIRMATION &&
          p.reportedByEntryId !== viewerEntry?.id,
        canJudge: isOrganizer && inProgress && p.player2Id !== null,
      };
    });

    for (const p of round.pairings) {
      allPairings.push(p);
      if (!(p.status === HostedPairingStatus.CONFIRMED || p.status === HostedPairingStatus.BYE) || !p.result) {
        continue;
      }
      const a = running.get(p.player1Id);
      const b = p.player2Id ? running.get(p.player2Id) : undefined;
      if (!a) continue;
      if (!b) {
        a.wins += 1;
      } else if (p.result === HostedPairingResult.DRAW) {
        a.draws += 1;
        b.draws += 1;
      } else if (p.result === HostedPairingResult.PLAYER1_WIN) {
        a.wins += 1;
        b.losses += 1;
      } else {
        b.wins += 1;
        a.losses += 1;
      }
    }

    rounds.push({
      number: round.number,
      status: round.status,
      timer: timerState(round, now),
      pairings,
    });
  }

  const standingsRows = computeStandings(
    tournament.entries.map((e) => ({
      id: e.id,
      name: refs.get(e.id)!.displayName.toLowerCase(),
      active: e.status === HostedEntryStatus.ACTIVE,
    })),
    closedResults(allPairings),
    { win: tournament.pointsWin, draw: tournament.pointsDraw, loss: tournament.pointsLoss },
  );

  let eligibleDecks: HostedTournamentViewDto["viewer"]["eligibleDecks"] = [];
  if (viewerUserId && registration) {
    const decks = await prisma.deck.findMany({
      where: { userId: viewerUserId, formatId: tournament.formatId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, cards: { select: { quantity: true } } },
    });
    eligibleDecks = decks
      .map((d) => ({ id: d.id, name: d.name, cardCount: d.cards.reduce((s, c) => s + c.quantity, 0) }))
      .filter((d) => d.cardCount > 0);
  }

  const full = tournament.maxPlayers !== null && tournament.entries.length >= tournament.maxPlayers;

  return {
    serverNow: now.toISOString(),
    tournament: {
      code: tournament.code,
      name: tournament.name,
      date: tournament.date?.toISOString() ?? null,
      locationType: tournament.locationType,
      location: tournament.location,
      format: tournament.format,
      bestOf: tournament.bestOf,
      pointsWin: tournament.pointsWin,
      pointsDraw: tournament.pointsDraw,
      pointsLoss: tournament.pointsLoss,
      deckPolicy: tournament.deckPolicy,
      plannedRounds: tournament.plannedRounds,
      suggestedRounds: suggestedRounds(Math.max(2, tournament.entries.length)),
      roundMinutes: tournament.roundMinutes,
      maxPlayers: tournament.maxPlayers,
      status: tournament.status,
      currentRound: tournament.currentRound,
      startedAt: tournament.startedAt?.toISOString() ?? null,
      finishedAt: tournament.finishedAt?.toISOString() ?? null,
      organizer: {
        username: tournament.organizer.username,
        displayName: displayNameOf(tournament.organizer),
      },
      playerCount: tournament.entries.length,
    },
    viewer: {
      signedIn: viewerUserId !== null,
      isOrganizer,
      entryId: viewerEntry?.id ?? null,
      entryStatus: viewerEntry?.status ?? null,
      deck: registration && viewerEntry?.deck ? viewerEntry.deck : null,
      eligibleDecks,
      canJoin: viewerUserId !== null && registration && !viewerEntry && !full,
    },
    players: tournament.entries.map((e) => ({
      ...refs.get(e.id)!,
      // Only whether a list is registered; never which one.
      hasDeck: e.deckId !== null,
    })),
    rounds,
    standings: standingsRows.map((row) => ({
      ...refs.get(row.playerId)!,
      rank: row.rank,
      points: row.points,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      omw: row.omw,
      oomw: row.oomw,
    })),
  };
}

export async function listMyHostedTournaments(userId: string): Promise<HostedTournamentSummaryDto[]> {
  const rows = await prisma.hostedTournament.findMany({
    where: { OR: [{ organizerId: userId }, { entries: { some: { userId } } }] },
    orderBy: [{ createdAt: "desc" }],
    take: 100,
    include: {
      format: { select: { id: true, name: true, code: true } },
      organizer: { select: userSelect },
      entries: { where: { userId }, select: { id: true } },
      _count: { select: { entries: true } },
    },
  });
  return rows.map((t) => {
    const organizer = t.organizerId === userId;
    const player = t.entries.length > 0;
    return {
      code: t.code,
      name: t.name,
      date: t.date?.toISOString() ?? null,
      locationType: t.locationType,
      location: t.location,
      format: t.format,
      status: t.status,
      currentRound: t.currentRound,
      plannedRounds: t.plannedRounds,
      playerCount: t._count.entries,
      role: organizer && player ? "BOTH" : organizer ? "ORGANIZER" : "PLAYER",
      organizer: { username: t.organizer.username, displayName: displayNameOf(t.organizer) },
    };
  });
}

/** Light lookup for page metadata. */
export async function getHostedTournamentName(code: string): Promise<string | null> {
  if (!isValidTournamentCode(code)) return null;
  const row = await prisma.hostedTournament.findUnique({ where: { code }, select: { name: true } });
  return row?.name ?? null;
}
