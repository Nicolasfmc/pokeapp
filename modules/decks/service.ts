import {
  DeckImportStatus,
  DeckTagName,
  PhysicalStatus,
  Prisma,
  type CardCategory,
} from "@prisma/client";
import { prisma } from "@/server/database";
import { flattenCandidate, representativeSelect } from "@/modules/cards/service";
import { pickRepresentative } from "@/modules/cards/representative";
import { parseLimitlessDecklist } from "@/server/parsers";
import {
  aggregateByLogicalCard,
  resolveCardBySetAndCollector,
} from "@/server/services/card-resolver";
import {
  validateDecklist,
  type DeckValidationResult,
} from "@/server/services/deck-validator";
import {
  resyncSleevedAllocationsInTx,
  clearDeckAllocations,
  lockDeckRow,
} from "@/server/services/allocation";
import {
  getDeckInventoryCheck,
  type InventoryCheckResult,
} from "@/server/services/inventory-check";

import type { DeckCardDto, DeckDto, UnresolvedImportLine } from "./types";

export type { DeckCardDto, DeckDto, UnresolvedImportLine } from "./types";

export class DeckServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "DeckServiceError";
    this.status = status;
    this.code = code;
  }
}

const TAG_VALUES = new Set<string>(Object.values(DeckTagName));

export type ImportDeckResult = {
  deck: DeckDto;
  validation: DeckValidationResult;
  inventoryCheck: InventoryCheckResult;
  resolvedCount: number;
  unresolvedCount: number;
  unresolved: UnresolvedImportLine[];
  parseErrors: Array<{ code: string; message: string; lineNumber?: number }>;
  nameMismatches: Array<{
    expected: string;
    resolved: string;
    setCode: string;
    collectorNumber: string;
  }>;
};

const deckInclude = {
  format: { select: { id: true, code: true, name: true } },
  archetype: { select: { id: true, name: true } },
  tags: { select: { tag: true } },
  coverPrinting: { select: { id: true, imageUrl: true } },
  cards: {
    include: {
      logicalCard: {
        select: {
          id: true,
          canonicalName: true,
          category: true,
          printings: {
            where: { isActive: true, imageUrl: { not: null } },
            select: representativeSelect,
          },
        },
      },
    },
    orderBy: [
      { logicalCard: { category: "asc" as const } },
      { logicalCard: { canonicalName: "asc" as const } },
    ],
  },
} satisfies Prisma.DeckInclude;

type DeckWithRelations = Prisma.DeckGetPayload<{ include: typeof deckInclude }>;

function deckFormatKey(code: string): "standard" | "expanded" | null {
  const normalized = code.toLowerCase();
  return normalized === "standard" || normalized === "expanded"
    ? normalized
    : null;
}

function defaultCover(cards: DeckCardDto[]): string | null {
  const withImage = cards.filter((c) => c.imageUrl);
  const pokemon = withImage
    .filter((c) => c.category === "POKEMON")
    .sort((a, b) => b.quantity - a.quantity);
  return (pokemon[0] ?? withImage[0])?.imageUrl ?? null;
}

function toDeckDto(deck: DeckWithRelations): DeckDto {
  const format = deckFormatKey(deck.format.code);
  const cards: DeckCardDto[] = deck.cards.map((card) => {
    const rep = pickRepresentative(
      card.logicalCard.printings.map(flattenCandidate),
      format,
    );
    return {
      id: card.id,
      logicalCardId: card.logicalCardId,
      quantity: card.quantity,
      canonicalName: card.logicalCard.canonicalName,
      category: card.logicalCard.category,
      printingId: rep?.id ?? null,
      imageUrl: rep?.imageUrl ?? null,
    };
  });

  return {
    id: deck.id,
    name: deck.name,
    description: deck.description,
    formatId: deck.formatId,
    format: deck.format,
    archetypeId: deck.archetypeId,
    archetype: deck.archetype,
    physicalStatus: deck.physicalStatus,
    importStatus: deck.importStatus,
    tags: deck.tags.map((t) => t.tag),
    cards,
    cardCount: cards.reduce((sum, c) => sum + c.quantity, 0),
    coverPrintingId: deck.coverPrintingId,
    coverImageUrl: deck.coverPrinting?.imageUrl ?? defaultCover(cards),
    createdAt: deck.createdAt.toISOString(),
    updatedAt: deck.updatedAt.toISOString(),
  };
}

function parseTags(tags: unknown): DeckTagName[] {
  if (tags === undefined || tags === null) return [];
  if (!Array.isArray(tags)) {
    throw new DeckServiceError("tags deve ser um array", 400, "INVALID_TAGS");
  }
  const unique = new Set<DeckTagName>();
  for (const tag of tags) {
    if (typeof tag !== "string" || !TAG_VALUES.has(tag)) {
      throw new DeckServiceError(
        `Tag inválida: ${String(tag)}`,
        400,
        "INVALID_TAGS",
      );
    }
    unique.add(tag as DeckTagName);
  }
  return [...unique];
}

async function assertFormat(formatId: string) {
  const format = await prisma.format.findFirst({
    where: { id: formatId, isActive: true },
  });
  if (!format) {
    throw new DeckServiceError("Formato inválido", 400, "INVALID_FORMAT");
  }
  return format;
}

async function assertArchetype(archetypeId: string | null | undefined) {
  if (!archetypeId) return null;
  const archetype = await prisma.archetype.findUnique({
    where: { id: archetypeId },
  });
  if (!archetype) {
    throw new DeckServiceError("Arquétipo inválido", 400, "INVALID_ARCHETYPE");
  }
  return archetype;
}

async function getOwnedDeck(userId: string, deckId: string) {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: deckInclude,
  });
  if (!deck) {
    throw new DeckServiceError("Deck não encontrado", 404, "NOT_FOUND");
  }
  return deck;
}

function normalizeCardInputs(
  cards: unknown,
): Array<{ logicalCardId: string; quantity: number }> {
  if (!Array.isArray(cards)) {
    throw new DeckServiceError("cards deve ser um array", 400, "INVALID_CARDS");
  }

  const map = new Map<string, number>();
  for (const item of cards) {
    if (!item || typeof item !== "object") {
      throw new DeckServiceError("Carta inválida", 400, "INVALID_CARDS");
    }
    const row = item as Record<string, unknown>;
    const logicalCardId = row.logicalCardId;
    const quantity = row.quantity;
    if (typeof logicalCardId !== "string" || !logicalCardId) {
      throw new DeckServiceError(
        "logicalCardId obrigatório",
        400,
        "INVALID_CARDS",
      );
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1) {
      throw new DeckServiceError(
        "quantity deve ser inteiro >= 1",
        400,
        "INVALID_CARDS",
      );
    }
    map.set(logicalCardId, (map.get(logicalCardId) ?? 0) + quantity);
  }

  return [...map.entries()].map(([logicalCardId, quantity]) => ({
    logicalCardId,
    quantity,
  }));
}

async function assertLogicalCardsExist(ids: string[]) {
  if (ids.length === 0) return;
  const found = await prisma.cardLogical.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new DeckServiceError(
      "Uma ou mais cartas lógicas não existem",
      400,
      "UNKNOWN_LOGICAL_CARD",
    );
  }
}

async function replaceDeckCards(
  tx: Prisma.TransactionClient,
  deckId: string,
  cards: Array<{ logicalCardId: string; quantity: number }>,
) {
  await tx.deckCard.deleteMany({ where: { deckId } });
  if (cards.length === 0) return;
  await tx.deckCard.createMany({
    data: cards.map((card) => ({
      deckId,
      logicalCardId: card.logicalCardId,
      quantity: card.quantity,
    })),
  });
}

async function replaceDeckTags(
  tx: Prisma.TransactionClient,
  deckId: string,
  tags: DeckTagName[],
) {
  await tx.deckTag.deleteMany({ where: { deckId } });
  if (tags.length === 0) return;
  await tx.deckTag.createMany({
    data: tags.map((tag) => ({ deckId, tag })),
  });
}

function computeImportStatus(options: {
  parseFatal: boolean;
  totalLines: number;
  resolvedCount: number;
  unresolvedCount: number;
  validationValid: boolean;
}): DeckImportStatus {
  if (options.parseFatal || (options.totalLines > 0 && options.resolvedCount === 0)) {
    return DeckImportStatus.INVALID;
  }
  if (options.unresolvedCount > 0) {
    return DeckImportStatus.PARTIALLY_RESOLVED;
  }
  if (options.resolvedCount > 0 && options.validationValid) {
    return DeckImportStatus.READY;
  }
  if (options.resolvedCount > 0) {
    return DeckImportStatus.IMPORTED;
  }
  return DeckImportStatus.INVALID;
}

export async function listFormats() {
  return prisma.format.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      description: true,
      rules: {
        select: { key: true, value: true },
      },
    },
  });
}

export async function listDecks(userId: string): Promise<DeckDto[]> {
  const decks = await prisma.deck.findMany({
    where: { userId },
    include: deckInclude,
    orderBy: { updatedAt: "desc" },
  });
  return decks.map(toDeckDto);
}

export async function getDeck(userId: string, deckId: string): Promise<DeckDto> {
  const deck = await getOwnedDeck(userId, deckId);
  return toDeckDto(deck);
}

export async function createDeck(
  userId: string,
  input: {
    name?: unknown;
    formatId?: unknown;
    description?: unknown;
    tags?: unknown;
    archetypeId?: unknown;
    cards?: unknown;
  },
): Promise<DeckDto> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new DeckServiceError("Nome é obrigatório", 400, "INVALID_NAME");
  }
  if (typeof input.formatId !== "string" || !input.formatId) {
    throw new DeckServiceError("formatId é obrigatório", 400, "INVALID_FORMAT");
  }

  await assertFormat(input.formatId);
  const archetypeId =
    input.archetypeId === null || input.archetypeId === undefined
      ? null
      : typeof input.archetypeId === "string"
        ? input.archetypeId
        : null;
  if (input.archetypeId !== undefined && input.archetypeId !== null) {
    await assertArchetype(archetypeId);
  }

  const tags = parseTags(input.tags);
  const cards =
    input.cards === undefined ? [] : normalizeCardInputs(input.cards);
  await assertLogicalCardsExist(cards.map((c) => c.logicalCardId));

  const description =
    typeof input.description === "string" ? input.description.trim() || null : null;

  const deck = await prisma.$transaction(async (tx) => {
    const created = await tx.deck.create({
      data: {
        userId,
        name,
        formatId: input.formatId as string,
        description,
        archetypeId,
        physicalStatus: PhysicalStatus.NOT_SLEEVED,
        importStatus: null,
      },
    });
    await replaceDeckTags(tx, created.id, tags);
    await replaceDeckCards(tx, created.id, cards);
    return tx.deck.findUniqueOrThrow({
      where: { id: created.id },
      include: deckInclude,
    });
  });

  return toDeckDto(deck);
}

export async function updateDeck(
  userId: string,
  deckId: string,
  input: {
    name?: unknown;
    formatId?: unknown;
    description?: unknown;
    tags?: unknown;
    archetypeId?: unknown;
    coverPrintingId?: unknown;
  },
): Promise<DeckDto> {
  await getOwnedDeck(userId, deckId);

  const data: Prisma.DeckUpdateInput = {};

  if (input.coverPrintingId !== undefined) {
    if (input.coverPrintingId === null) {
      data.coverPrinting = { disconnect: true };
    } else if (typeof input.coverPrintingId === "string") {
      // A capa tem que ser uma carta que está no deck.
      const printing = await prisma.cardPrinting.findUnique({
        where: { id: input.coverPrintingId },
        select: { logicalCardId: true },
      });
      const inDeck = printing
        ? await prisma.deckCard.findUnique({
            where: {
              deckId_logicalCardId: {
                deckId,
                logicalCardId: printing.logicalCardId,
              },
            },
            select: { id: true },
          })
        : null;
      if (!inDeck) {
        throw new DeckServiceError(
          "A capa precisa ser uma carta do deck.",
          400,
          "INVALID_COVER",
        );
      }
      data.coverPrinting = { connect: { id: input.coverPrintingId } };
    } else {
      throw new DeckServiceError("coverPrintingId inválido", 400, "INVALID_COVER");
    }
  }

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) {
      throw new DeckServiceError("Nome inválido", 400, "INVALID_NAME");
    }
    data.name = input.name.trim();
  }

  if (input.formatId !== undefined) {
    if (typeof input.formatId !== "string") {
      throw new DeckServiceError("formatId inválido", 400, "INVALID_FORMAT");
    }
    await assertFormat(input.formatId);
    data.format = { connect: { id: input.formatId } };
  }

  if (input.description !== undefined) {
    if (input.description !== null && typeof input.description !== "string") {
      throw new DeckServiceError(
        "description inválida",
        400,
        "INVALID_DESCRIPTION",
      );
    }
    data.description =
      typeof input.description === "string"
        ? input.description.trim() || null
        : null;
  }

  if (input.archetypeId !== undefined) {
    if (input.archetypeId === null) {
      data.archetype = { disconnect: true };
    } else if (typeof input.archetypeId === "string") {
      await assertArchetype(input.archetypeId);
      data.archetype = { connect: { id: input.archetypeId } };
    } else {
      throw new DeckServiceError(
        "archetypeId inválido",
        400,
        "INVALID_ARCHETYPE",
      );
    }
  }

  const tags =
    input.tags !== undefined ? parseTags(input.tags) : undefined;
  const archiving = Boolean(tags?.includes(DeckTagName.ARCHIVED));

  const deck = await prisma.$transaction(async (tx) => {
    if (archiving) {
      // §44: arquivar um deck Sleevado libera as alocações; Inventory intacto.
      await lockDeckRow(tx, userId, deckId);
      await clearDeckAllocations(tx, deckId);
      data.physicalStatus = PhysicalStatus.NOT_SLEEVED;
    }
    await tx.deck.update({
      where: { id: deckId },
      data,
    });
    if (tags) {
      await replaceDeckTags(tx, deckId, tags);
    }
    return tx.deck.findUniqueOrThrow({
      where: { id: deckId },
      include: deckInclude,
    });
  });

  return toDeckDto(deck);
}

/**
 * §44 / §114: libera alocações e remove o deck. Se o deck já tem partidas
 * registradas, ele é arquivado (tag ARCHIVED) para preservar o histórico.
 */
export async function deleteDeck(
  userId: string,
  deckId: string,
): Promise<{ archived: boolean }> {
  await getOwnedDeck(userId, deckId);
  return prisma.$transaction(async (tx) => {
    await lockDeckRow(tx, userId, deckId);
    await clearDeckAllocations(tx, deckId);
    const matchCount = await tx.match.count({ where: { deckId } });
    if (matchCount > 0) {
      await tx.deck.update({
        where: { id: deckId },
        data: { physicalStatus: PhysicalStatus.NOT_SLEEVED },
      });
      await tx.deckTag.upsert({
        where: { deckId_tag: { deckId, tag: DeckTagName.ARCHIVED } },
        create: { deckId, tag: DeckTagName.ARCHIVED },
        update: {},
      });
      return { archived: true };
    }
    await tx.deck.delete({ where: { id: deckId } });
    return { archived: false };
  });
}

export async function replaceCards(
  userId: string,
  deckId: string,
  cardsInput: unknown,
): Promise<{ deck: DeckDto; validation: DeckValidationResult }> {
  const existing = await getOwnedDeck(userId, deckId);
  const cards = normalizeCardInputs(cardsInput);
  await assertLogicalCardsExist(cards.map((c) => c.logicalCardId));

  const validation = await validateDecklist({
    formatId: existing.formatId,
    cards,
  });

  const importStatus =
    cards.length === 0
      ? null
      : validation.valid
        ? DeckImportStatus.READY
        : DeckImportStatus.IMPORTED;

  const wasSleeved = existing.physicalStatus === PhysicalStatus.SLEEVED;

  const deck = await prisma.$transaction(async (tx) => {
    await replaceDeckCards(tx, deckId, cards);
    await tx.deck.update({
      where: { id: deckId },
      data: { importStatus },
    });
    if (wasSleeved) {
      await resyncSleevedAllocationsInTx(tx, userId, deckId);
    }
    return tx.deck.findUniqueOrThrow({
      where: { id: deckId },
      include: deckInclude,
    });
  });

  return { deck: toDeckDto(deck), validation };
}

export async function validateDeck(
  userId: string,
  deckId: string,
): Promise<{ deck: DeckDto; validation: DeckValidationResult }> {
  const deck = await getOwnedDeck(userId, deckId);
  const validation = await validateDecklist({
    formatId: deck.formatId,
    cards: deck.cards.map((c) => ({
      logicalCardId: c.logicalCardId,
      quantity: c.quantity,
    })),
  });

  let importStatus = deck.importStatus;
  if (deck.cards.length > 0) {
    importStatus = validation.valid
      ? DeckImportStatus.READY
      : deck.importStatus === DeckImportStatus.PARTIALLY_RESOLVED
        ? DeckImportStatus.PARTIALLY_RESOLVED
        : DeckImportStatus.IMPORTED;

    if (importStatus !== deck.importStatus) {
      await prisma.deck.update({
        where: { id: deckId },
        data: { importStatus },
      });
    }
  }

  const refreshed = await getOwnedDeck(userId, deckId);
  return { deck: toDeckDto(refreshed), validation };
}

export async function importLimitlessDeck(
  userId: string,
  input: {
    name?: unknown;
    formatId?: unknown;
    description?: unknown;
    tags?: unknown;
    archetypeId?: unknown;
    decklist?: unknown;
  },
): Promise<ImportDeckResult> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) {
    throw new DeckServiceError("Nome é obrigatório", 400, "INVALID_NAME");
  }
  if (typeof input.formatId !== "string" || !input.formatId) {
    throw new DeckServiceError("formatId é obrigatório", 400, "INVALID_FORMAT");
  }
  if (typeof input.decklist !== "string") {
    throw new DeckServiceError(
      "decklist é obrigatória",
      400,
      "INVALID_DECKLIST",
    );
  }

  await assertFormat(input.formatId);
  const archetypeId =
    input.archetypeId === null || input.archetypeId === undefined
      ? null
      : typeof input.archetypeId === "string"
        ? input.archetypeId
        : null;
  if (input.archetypeId !== undefined && input.archetypeId !== null) {
    await assertArchetype(archetypeId);
  }

  const tags = parseTags(input.tags);
  const description =
    typeof input.description === "string" ? input.description.trim() || null : null;

  const parsed = parseLimitlessDecklist(input.decklist);
  const parseErrors = parsed.errors.map((error) => ({
    code: error.code,
    message: error.message,
    lineNumber: error.lineNumber,
  }));

  const unresolved: UnresolvedImportLine[] = [];
  const nameMismatches: ImportDeckResult["nameMismatches"] = [];
  const resolvedRaw: Array<{
    logicalCardId: string;
    quantity: number;
    canonicalName: string;
    category: CardCategory;
  }> = [];

  for (const line of parsed.cards) {
    const result = await resolveCardBySetAndCollector({
      setCode: line.setCode,
      collectorNumber: line.collectorNumber,
      name: line.name,
    });

    if (!result.ok) {
      unresolved.push({
        quantity: line.quantity,
        name: line.name,
        setCode: line.setCode,
        collectorNumber: line.collectorNumber,
        reason: result.message,
      });
      continue;
    }

    if (!result.value.nameMatched) {
      nameMismatches.push({
        expected: line.name,
        resolved: result.value.canonicalName,
        setCode: line.setCode,
        collectorNumber: line.collectorNumber,
      });
    }

    resolvedRaw.push({
      logicalCardId: result.value.logicalCardId,
      quantity: line.quantity,
      canonicalName: result.value.canonicalName,
      category: result.value.category,
    });
  }

  const aggregated = aggregateByLogicalCard(resolvedRaw);
  const totalLines = parsed.cards.length;
  const resolvedCount = aggregated.reduce((sum, c) => sum + c.quantity, 0);
  const unresolvedCount = unresolved.reduce((sum, c) => sum + c.quantity, 0);
  const parseFatal =
    parsed.cards.length === 0 &&
    (parsed.errors.some((e) => e.code === "EMPTY_INPUT") ||
      parsed.errors.length > 0);

  const validation = await validateDecklist({
    formatId: input.formatId,
    cards: aggregated.map((c) => ({
      logicalCardId: c.logicalCardId,
      quantity: c.quantity,
    })),
  });

  const importStatus = computeImportStatus({
    parseFatal,
    totalLines,
    resolvedCount: aggregated.length > 0 ? resolvedCount : 0,
    unresolvedCount,
    validationValid: validation.valid && unresolvedCount === 0,
  });

  if (importStatus === DeckImportStatus.INVALID && aggregated.length === 0) {
    throw new DeckServiceError(
      "Importação inválida: nenhuma carta resolvida",
      400,
      "IMPORT_INVALID",
    );
  }

  const deck = await prisma.$transaction(async (tx) => {
    const created = await tx.deck.create({
      data: {
        userId,
        name,
        formatId: input.formatId as string,
        description,
        archetypeId,
        physicalStatus: PhysicalStatus.NOT_SLEEVED,
        importStatus,
      },
    });
    await replaceDeckTags(tx, created.id, tags);
    await replaceDeckCards(
      tx,
      created.id,
      aggregated.map((c) => ({
        logicalCardId: c.logicalCardId,
        quantity: c.quantity,
      })),
    );
    return tx.deck.findUniqueOrThrow({
      where: { id: created.id },
      include: deckInclude,
    });
  });

  // §55: Parser → Resolver → Format Validator → Inventory Check
  const inventoryCheck = await getDeckInventoryCheck(userId, deck.id);

  return {
    deck: toDeckDto(deck),
    validation,
    inventoryCheck,
    resolvedCount,
    unresolvedCount,
    unresolved,
    parseErrors,
    nameMismatches,
  };
}

export async function resolvePrintingLine(input: {
  setCode?: unknown;
  collectorNumber?: unknown;
  name?: unknown;
  quantity?: unknown;
}) {
  if (typeof input.setCode !== "string" || !input.setCode.trim()) {
    throw new DeckServiceError("setCode é obrigatório", 400, "INVALID_QUERY");
  }
  if (typeof input.collectorNumber !== "string" || !input.collectorNumber.trim()) {
    throw new DeckServiceError(
      "collectorNumber é obrigatório",
      400,
      "INVALID_QUERY",
    );
  }

  const quantity =
    input.quantity === undefined
      ? 1
      : typeof input.quantity === "number" &&
          Number.isInteger(input.quantity) &&
          input.quantity >= 1
        ? input.quantity
        : null;

  if (quantity === null) {
    throw new DeckServiceError("quantity inválida", 400, "INVALID_QUANTITY");
  }

  const result = await resolveCardBySetAndCollector({
    setCode: input.setCode,
    collectorNumber: input.collectorNumber,
    name: typeof input.name === "string" ? input.name : undefined,
  });

  if (!result.ok) {
    throw new DeckServiceError(result.message, 404, result.code);
  }

  return {
    quantity,
    logicalCardId: result.value.logicalCardId,
    canonicalName: result.value.canonicalName,
    category: result.value.category,
    setCode: result.value.setCode,
    localId: result.value.localId,
    printingId: result.value.printingId,
    imageUrl: result.value.imageUrl,
    nameMatched: result.value.nameMatched,
  };
}
