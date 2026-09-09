import {
  CollectionStatus,
  Condition,
  InventoryTransactionReason,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/server/database";
import {
  computeAvailability,
  getLogicalAvailabilityMap,
  type AvailabilityMetrics,
} from "./availability";

export class InventoryServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "InventoryServiceError";
    this.status = status;
    this.code = code;
  }
}

const CONDITIONS = new Set<string>(Object.values(Condition));
const COLLECTION_STATUSES = new Set<string>(Object.values(CollectionStatus));
const REASONS = new Set<string>(Object.values(InventoryTransactionReason));

export type InventoryItemView = {
  id: string;
  userId: string;
  cardPrintingId: string;
  quantity: number;
  condition: Condition;
  language: string;
  collectionStatus: CollectionStatus;
  sleevedAllocatedQuantity: number;
  createdAt: string;
  updatedAt: string;
  cardPrinting: {
    id: string;
    tcgdexId: string;
    name: string;
    localId: string;
    imageUrl: string | null;
    logicalCardId: string;
    set: {
      id: string;
      name: string;
      code: string | null;
    };
  };
  logicalAvailability: AvailabilityMetrics;
};

export type InventoryTransactionView = {
  id: string;
  userId: string;
  inventoryItemId: string;
  quantityDelta: number;
  reason: InventoryTransactionReason;
  note: string | null;
  createdAt: string;
};

const itemInclude = {
  cardPrinting: {
    select: {
      id: true,
      tcgdexId: true,
      name: true,
      localId: true,
      imageUrl: true,
      logicalCardId: true,
      set: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  },
  allocations: {
    select: { quantity: true },
  },
} satisfies Prisma.InventoryItemInclude;

type ItemWithRelations = Prisma.InventoryItemGetPayload<{
  include: typeof itemInclude;
}>;

function parseCondition(value: unknown, fallback: Condition = Condition.NM) {
  if (value == null || value === "") {
    return fallback;
  }
  const normalized = String(value);
  if (!CONDITIONS.has(normalized)) {
    throw new InventoryServiceError(
      "Condição inválida.",
      400,
      "INVALID_CONDITION",
    );
  }
  return normalized as Condition;
}

function parseCollectionStatus(
  value: unknown,
  fallback: CollectionStatus = CollectionStatus.COMPETITIVE,
) {
  if (value == null || value === "") {
    return fallback;
  }
  const normalized = String(value);
  if (!COLLECTION_STATUSES.has(normalized)) {
    throw new InventoryServiceError(
      "Status de coleção inválido.",
      400,
      "INVALID_COLLECTION_STATUS",
    );
  }
  return normalized as CollectionStatus;
}

function parseReason(
  value: unknown,
  fallback: InventoryTransactionReason,
): InventoryTransactionReason {
  if (value == null || value === "") {
    return fallback;
  }
  const normalized = String(value);
  if (!REASONS.has(normalized)) {
    throw new InventoryServiceError("Motivo inválido.", 400, "INVALID_REASON");
  }
  return normalized as InventoryTransactionReason;
}

function parsePositiveInt(value: unknown, field: string) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new InventoryServiceError(
      `${field} deve ser um inteiro positivo.`,
      400,
      "INVALID_QUANTITY",
    );
  }
  return n;
}

function parseDelta(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n === 0) {
    throw new InventoryServiceError(
      "quantityDelta deve ser um inteiro diferente de zero.",
      400,
      "INVALID_QUANTITY_DELTA",
    );
  }
  return n;
}

function parseLanguage(value: unknown, fallback = "en") {
  if (value == null || value === "") {
    return fallback;
  }
  const language = String(value).trim().toLowerCase();
  if (!/^[a-z]{2}(-[a-z0-9]+)?$/i.test(language) || language.length > 16) {
    throw new InventoryServiceError("Idioma inválido.", 400, "INVALID_LANGUAGE");
  }
  return language;
}

function parseOptionalNote(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  const note = String(value).trim();
  if (note.length > 500) {
    throw new InventoryServiceError(
      "Nota muito longa (máx. 500).",
      400,
      "INVALID_NOTE",
    );
  }
  return note;
}

function sleevedForItem(item: { allocations: { quantity: number }[] }) {
  return item.allocations.reduce((sum, row) => sum + row.quantity, 0);
}

function toTransactionView(
  row: {
    id: string;
    userId: string;
    inventoryItemId: string;
    quantityDelta: number;
    reason: InventoryTransactionReason;
    note: string | null;
    createdAt: Date;
  },
): InventoryTransactionView {
  return {
    id: row.id,
    userId: row.userId,
    inventoryItemId: row.inventoryItemId,
    quantityDelta: row.quantityDelta,
    reason: row.reason,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
  };
}

async function toItemViews(
  userId: string,
  items: ItemWithRelations[],
): Promise<InventoryItemView[]> {
  const logicalIds = items.map((item) => item.cardPrinting.logicalCardId);
  const availabilityMap = await getLogicalAvailabilityMap(userId, logicalIds);

  return items.map((item) => {
    const sleevedAllocatedQuantity = sleevedForItem(item);
    const logicalAvailability =
      availabilityMap.get(item.cardPrinting.logicalCardId) ??
      computeAvailability(item.quantity, sleevedAllocatedQuantity);

    return {
      id: item.id,
      userId: item.userId,
      cardPrintingId: item.cardPrintingId,
      quantity: item.quantity,
      condition: item.condition,
      language: item.language,
      collectionStatus: item.collectionStatus,
      sleevedAllocatedQuantity,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      cardPrinting: {
        id: item.cardPrinting.id,
        tcgdexId: item.cardPrinting.tcgdexId,
        name: item.cardPrinting.name,
        localId: item.cardPrinting.localId,
        imageUrl: item.cardPrinting.imageUrl,
        logicalCardId: item.cardPrinting.logicalCardId,
        set: item.cardPrinting.set,
      },
      logicalAvailability,
    };
  });
}

async function resolveCardPrintingId(input: {
  cardPrintingId?: unknown;
  tcgdexId?: unknown;
}) {
  const cardPrintingId =
    input.cardPrintingId != null && String(input.cardPrintingId).trim() !== ""
      ? String(input.cardPrintingId).trim()
      : null;
  const tcgdexId =
    input.tcgdexId != null && String(input.tcgdexId).trim() !== ""
      ? String(input.tcgdexId).trim()
      : null;

  if (cardPrintingId) {
    const printing = await prisma.cardPrinting.findUnique({
      where: { id: cardPrintingId },
      select: { id: true },
    });
    if (!printing) {
      throw new InventoryServiceError(
        "Impressão não encontrada.",
        404,
        "PRINTING_NOT_FOUND",
      );
    }
    return printing.id;
  }

  if (tcgdexId) {
    const printing = await prisma.cardPrinting.findUnique({
      where: { tcgdexId },
      select: { id: true },
    });
    if (!printing) {
      throw new InventoryServiceError(
        "Impressão não encontrada para o tcgdexId informado.",
        404,
        "PRINTING_NOT_FOUND",
      );
    }
    return printing.id;
  }

  throw new InventoryServiceError(
    "Informe cardPrintingId ou tcgdexId.",
    400,
    "PRINTING_REQUIRED",
  );
}

export async function listInventoryItems(
  userId: string,
  filters?: {
    collectionStatus?: CollectionStatus;
    q?: string;
  },
): Promise<InventoryItemView[]> {
  const where: Prisma.InventoryItemWhereInput = { userId };

  if (filters?.collectionStatus) {
    where.collectionStatus = filters.collectionStatus;
  }

  if (filters?.q && filters.q.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { cardPrinting: { name: { contains: q, mode: "insensitive" } } },
      { cardPrinting: { tcgdexId: { contains: q, mode: "insensitive" } } },
      { cardPrinting: { localId: { contains: q, mode: "insensitive" } } },
      { cardPrinting: { set: { name: { contains: q, mode: "insensitive" } } } },
      { cardPrinting: { set: { code: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const items = await prisma.inventoryItem.findMany({
    where,
    include: itemInclude,
    orderBy: [
      { cardPrinting: { name: "asc" } },
      { condition: "asc" },
      { language: "asc" },
    ],
  });

  return toItemViews(userId, items);
}

export async function getInventoryItem(
  userId: string,
  itemId: string,
): Promise<InventoryItemView> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, userId },
    include: itemInclude,
  });

  if (!item) {
    throw new InventoryServiceError(
      "Item de inventário não encontrado.",
      404,
      "ITEM_NOT_FOUND",
    );
  }

  const [view] = await toItemViews(userId, [item]);
  return view;
}

export async function addInventoryStock(
  userId: string,
  input: {
    cardPrintingId?: unknown;
    tcgdexId?: unknown;
    quantity?: unknown;
    condition?: unknown;
    language?: unknown;
    collectionStatus?: unknown;
    reason?: unknown;
    note?: unknown;
  },
): Promise<InventoryItemView> {
  const quantity = parsePositiveInt(input.quantity, "quantity");
  const condition = parseCondition(input.condition);
  const language = parseLanguage(input.language);
  const collectionStatus = parseCollectionStatus(input.collectionStatus);
  const reason = parseReason(input.reason, InventoryTransactionReason.PURCHASE);
  const note = parseOptionalNote(input.note);
  const cardPrintingId = await resolveCardPrintingId(input);

  const itemId = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; quantity: number }>>`
      SELECT id, quantity
      FROM inventory_items
      WHERE "userId" = ${userId}
        AND "cardPrintingId" = ${cardPrintingId}
        AND condition = ${condition}::"Condition"
        AND language = ${language}
        AND "collectionStatus" = ${collectionStatus}::"CollectionStatus"
      FOR UPDATE
    `;

    if (locked[0]) {
      const row = locked[0];
      await tx.inventoryItem.update({
        where: { id: row.id },
        data: { quantity: row.quantity + quantity },
      });
      await tx.inventoryTransaction.create({
        data: {
          userId,
          inventoryItemId: row.id,
          quantityDelta: quantity,
          reason,
          note,
        },
      });
      return row.id;
    }

    try {
      const created = await tx.inventoryItem.create({
        data: {
          userId,
          cardPrintingId,
          quantity,
          condition,
          language,
          collectionStatus,
        },
        select: { id: true },
      });
      await tx.inventoryTransaction.create({
        data: {
          userId,
          inventoryItemId: created.id,
          quantityDelta: quantity,
          reason,
          note,
        },
      });
      return created.id;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const again = await tx.$queryRaw<
          Array<{ id: string; quantity: number }>
        >`
          SELECT id, quantity
          FROM inventory_items
          WHERE "userId" = ${userId}
            AND "cardPrintingId" = ${cardPrintingId}
            AND condition = ${condition}::"Condition"
            AND language = ${language}
            AND "collectionStatus" = ${collectionStatus}::"CollectionStatus"
          FOR UPDATE
        `;
        const row = again[0];
        if (!row) {
          throw error;
        }
        await tx.inventoryItem.update({
          where: { id: row.id },
          data: { quantity: row.quantity + quantity },
        });
        await tx.inventoryTransaction.create({
          data: {
            userId,
            inventoryItemId: row.id,
            quantityDelta: quantity,
            reason,
            note,
          },
        });
        return row.id;
      }
      throw error;
    }
  });

  return getInventoryItem(userId, itemId);
}

export async function adjustInventoryItem(
  userId: string,
  itemId: string,
  input: {
    quantityDelta?: unknown;
    reason?: unknown;
    note?: unknown;
  },
): Promise<InventoryItemView> {
  const quantityDelta = parseDelta(input.quantityDelta);
  const reason = parseReason(
    input.reason,
    quantityDelta > 0
      ? InventoryTransactionReason.CORRECTION
      : InventoryTransactionReason.CORRECTION,
  );
  const note = parseOptionalNote(input.note);

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        quantity: number;
        userId: string;
      }>
    >`
      SELECT id, quantity, "userId"
      FROM inventory_items
      WHERE id = ${itemId}
      FOR UPDATE
    `;

    const row = locked[0];
    if (!row || row.userId !== userId) {
      throw new InventoryServiceError(
        "Item de inventário não encontrado.",
        404,
        "ITEM_NOT_FOUND",
      );
    }

    const allocationRows = await tx.$queryRaw<Array<{ total: bigint | number }>>`
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM deck_allocations
      WHERE "inventoryItemId" = ${itemId}
    `;
    const sleeved = Number(allocationRows[0]?.total ?? 0);
    const nextQuantity = row.quantity + quantityDelta;

    if (nextQuantity < 0) {
      throw new InventoryServiceError(
        "Quantidade não pode ficar negativa.",
        400,
        "NEGATIVE_QUANTITY",
      );
    }

    if (nextQuantity < sleeved) {
      throw new InventoryServiceError(
        "Quantidade não pode ser menor que o estoque alocado em decks SLEEVED.",
        409,
        "BELOW_ALLOCATED",
      );
    }

    await tx.inventoryItem.update({
      where: { id: itemId },
      data: { quantity: nextQuantity },
    });

    await tx.inventoryTransaction.create({
      data: {
        userId,
        inventoryItemId: itemId,
        quantityDelta,
        reason,
        note,
      },
    });
  });

  return getInventoryItem(userId, itemId);
}

export async function listInventoryTransactions(
  userId: string,
  itemId: string,
): Promise<InventoryTransactionView[]> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, userId },
    select: { id: true },
  });

  if (!item) {
    throw new InventoryServiceError(
      "Item de inventário não encontrado.",
      404,
      "ITEM_NOT_FOUND",
    );
  }

  const rows = await prisma.inventoryTransaction.findMany({
    where: { inventoryItemId: itemId, userId },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(toTransactionView);
}

export function handleInventoryError(error: unknown) {
  if (error instanceof InventoryServiceError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
    };
  }
  return null;
}
