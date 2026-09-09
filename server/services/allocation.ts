import { PhysicalStatus, Prisma } from "@prisma/client";
import { prisma } from "@/server/database";
import { writeAuditLog } from "@/server/audit";
import {
  selectAllocationsForDeck,
  type AllocationPick,
  type AllocationShortage,
  type SelectableInventoryLot,
} from "./allocation-select";

export class AllocationServiceError extends Error {
  status: number;
  code: string;
  shortages?: AllocationShortage[];

  constructor(
    message: string,
    status: number,
    code: string,
    shortages?: AllocationShortage[],
  ) {
    super(message);
    this.name = "AllocationServiceError";
    this.status = status;
    this.code = code;
    this.shortages = shortages;
  }
}

export type DeckAllocationView = {
  id: string;
  deckId: string;
  inventoryItemId: string;
  quantity: number;
  createdAt: string;
  cardPrintingId: string;
  logicalCardId: string;
  printingName: string;
  setCode: string | null;
};

type Tx = Prisma.TransactionClient;

export async function lockDeckRow(tx: Tx, userId: string, deckId: string) {
  const rows = await tx.$queryRaw<
    Array<{
      id: string;
      userId: string;
      physicalStatus: PhysicalStatus;
    }>
  >`
    SELECT id, "userId", "physicalStatus"
    FROM decks
    WHERE id = ${deckId}
    FOR UPDATE
  `;

  const row = rows[0];
  if (!row || row.userId !== userId) {
    throw new AllocationServiceError("Deck não encontrado.", 404, "NOT_FOUND");
  }
  return row;
}

export async function lockDecksOrdered(
  tx: Tx,
  userId: string,
  deckIds: string[],
) {
  const unique = [...new Set(deckIds)].sort((a, b) => a.localeCompare(b));
  const locked = [];
  for (const id of unique) {
    locked.push(await lockDeckRow(tx, userId, id));
  }
  return locked;
}

async function loadDeckRequirements(tx: Tx, deckId: string) {
  const cards = await tx.deckCard.findMany({
    where: { deckId },
    select: {
      logicalCardId: true,
      quantity: true,
      logicalCard: { select: { canonicalName: true } },
    },
  });

  return cards.map((card) => ({
    logicalCardId: card.logicalCardId,
    quantity: card.quantity,
    canonicalName: card.logicalCard.canonicalName,
  }));
}

async function lockInventoryLotsForLogicals(
  tx: Tx,
  userId: string,
  logicalCardIds: string[],
  excludeDeckId?: string,
): Promise<SelectableInventoryLot[]> {
  const uniqueLogicals = [...new Set(logicalCardIds.filter(Boolean))];
  if (uniqueLogicals.length === 0) {
    return [];
  }

  const items = await tx.$queryRaw<
    Array<{
      id: string;
      quantity: number;
      condition: SelectableInventoryLot["condition"];
      language: string;
      collectionStatus: SelectableInventoryLot["collectionStatus"];
      cardPrintingId: string;
      logicalCardId: string;
    }>
  >`
    SELECT
      i.id,
      i.quantity,
      i.condition,
      i.language,
      i."collectionStatus",
      i."cardPrintingId",
      p."logicalCardId"
    FROM inventory_items i
    INNER JOIN card_printings p ON p.id = i."cardPrintingId"
    WHERE i."userId" = ${userId}
      AND p."logicalCardId" IN (${Prisma.join(uniqueLogicals)})
    ORDER BY i.id
    FOR UPDATE OF i
  `;

  if (items.length === 0) {
    return [];
  }

  const itemIds = items.map((item) => item.id);
  const allocationRows = excludeDeckId
    ? await tx.$queryRaw<
        Array<{ inventoryItemId: string; quantity: number }>
      >`
        SELECT "inventoryItemId", quantity
        FROM deck_allocations
        WHERE "inventoryItemId" IN (${Prisma.join(itemIds)})
          AND "deckId" <> ${excludeDeckId}
      `
    : await tx.$queryRaw<
        Array<{ inventoryItemId: string; quantity: number }>
      >`
        SELECT "inventoryItemId", quantity
        FROM deck_allocations
        WHERE "inventoryItemId" IN (${Prisma.join(itemIds)})
      `;

  const allocated = new Map<string, number>();
  for (const row of allocationRows) {
    allocated.set(
      row.inventoryItemId,
      (allocated.get(row.inventoryItemId) ?? 0) + row.quantity,
    );
  }

  return items.map((item) => ({
    inventoryItemId: item.id,
    logicalCardId: item.logicalCardId,
    freeQuantity: Math.max(
      0,
      item.quantity - (allocated.get(item.id) ?? 0),
    ),
    collectionStatus: item.collectionStatus,
    condition: item.condition,
    language: item.language,
    cardPrintingId: item.cardPrintingId,
  }));
}

export async function clearDeckAllocations(tx: Tx, deckId: string) {
  await tx.deckAllocation.deleteMany({ where: { deckId } });
}

async function writeAllocations(
  tx: Tx,
  deckId: string,
  picks: AllocationPick[],
) {
  if (picks.length === 0) return;
  await tx.deckAllocation.createMany({
    data: picks.map((pick) => ({
      deckId,
      inventoryItemId: pick.inventoryItemId,
      quantity: pick.quantity,
    })),
  });
}

export async function allocationsToViews(
  tx: Tx,
  deckId: string,
): Promise<DeckAllocationView[]> {
  const rows = await tx.deckAllocation.findMany({
    where: { deckId },
    include: {
      inventoryItem: {
        include: {
          cardPrinting: {
            select: {
              id: true,
              name: true,
              logicalCardId: true,
              set: { select: { code: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    deckId: row.deckId,
    inventoryItemId: row.inventoryItemId,
    quantity: row.quantity,
    createdAt: row.createdAt.toISOString(),
    cardPrintingId: row.inventoryItem.cardPrintingId,
    logicalCardId: row.inventoryItem.cardPrinting.logicalCardId,
    printingName: row.inventoryItem.cardPrinting.name,
    setCode: row.inventoryItem.cardPrinting.set.code,
  }));
}

function throwShortage(
  requirements: Array<{
    logicalCardId: string;
    quantity: number;
    canonicalName: string;
  }>,
  shortages: AllocationShortage[],
): never {
  const names = new Map(
    requirements.map((r) => [r.logicalCardId, r.canonicalName]),
  );
  const detail = shortages
    .map((s) => {
      const name = names.get(s.logicalCardId) ?? s.logicalCardId;
      return `${name}: precisa ${s.required}, disponível ${s.available}`;
    })
    .join("; ");

  throw new AllocationServiceError(
    `Estoque insuficiente para sleevado. ${detail}`,
    409,
    "INSUFFICIENT_STOCK",
    shortages,
  );
}

export async function allocateDeckFromInventory(
  tx: Tx,
  userId: string,
  deckId: string,
  options?: { excludeDeckId?: string },
) {
  const requirements = await loadDeckRequirements(tx, deckId);
  if (requirements.length === 0) {
    throw new AllocationServiceError(
      "Deck sem cartas não pode ser SLEEVED.",
      400,
      "EMPTY_DECK",
    );
  }

  await clearDeckAllocations(tx, deckId);

  const lots = await lockInventoryLotsForLogicals(
    tx,
    userId,
    requirements.map((r) => r.logicalCardId),
    options?.excludeDeckId ?? deckId,
  );

  const selected = selectAllocationsForDeck(requirements, lots);
  if (!selected.ok) {
    throwShortage(requirements, selected.shortages);
  }

  await writeAllocations(tx, deckId, selected.picks);
  await tx.deck.update({
    where: { id: deckId },
    data: { physicalStatus: PhysicalStatus.SLEEVED },
  });
}

export async function sleeveDeck(userId: string, deckId: string) {
  const allocations = await prisma.$transaction(async (tx) => {
    await lockDeckRow(tx, userId, deckId);
    await allocateDeckFromInventory(tx, userId, deckId);
    return allocationsToViews(tx, deckId);
  });

  await writeAuditLog({
    userId,
    action: "DECK_SLEEVED",
    entity: "Deck",
    entityId: deckId,
    metadata: { allocationCount: allocations.length },
  });

  return {
    physicalStatus: PhysicalStatus.SLEEVED,
    allocations,
  };
}

export async function unsleeveDeck(userId: string, deckId: string) {
  await prisma.$transaction(async (tx) => {
    await lockDeckRow(tx, userId, deckId);
    await clearDeckAllocations(tx, deckId);
    await tx.deck.update({
      where: { id: deckId },
      data: { physicalStatus: PhysicalStatus.NOT_SLEEVED },
    });
  });

  return { physicalStatus: PhysicalStatus.NOT_SLEEVED };
}

export async function releaseDeckAllocationsBeforeDelete(
  userId: string,
  deckId: string,
) {
  await prisma.$transaction(async (tx) => {
    await lockDeckRow(tx, userId, deckId);
    await clearDeckAllocations(tx, deckId);
  });
}

export async function resyncSleevedAllocationsInTx(
  tx: Tx,
  userId: string,
  deckId: string,
): Promise<PhysicalStatus> {
  const deck = await lockDeckRow(tx, userId, deckId);
  if (deck.physicalStatus !== PhysicalStatus.SLEEVED) {
    return PhysicalStatus.NOT_SLEEVED;
  }

  try {
    await allocateDeckFromInventory(tx, userId, deckId);
    return PhysicalStatus.SLEEVED;
  } catch (error) {
    if (
      error instanceof AllocationServiceError &&
      (error.code === "INSUFFICIENT_STOCK" || error.code === "EMPTY_DECK")
    ) {
      await clearDeckAllocations(tx, deckId);
      await tx.deck.update({
        where: { id: deckId },
        data: { physicalStatus: PhysicalStatus.NOT_SLEEVED },
      });
      return PhysicalStatus.NOT_SLEEVED;
    }
    throw error;
  }
}

export async function listDeckAllocations(userId: string, deckId: string) {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    select: { id: true },
  });
  if (!deck) {
    throw new AllocationServiceError("Deck não encontrado.", 404, "NOT_FOUND");
  }

  return prisma.$transaction((tx) => allocationsToViews(tx, deckId));
}

export function handleAllocationError(error: unknown) {
  if (error instanceof AllocationServiceError) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
      shortages: error.shortages,
    };
  }
  return null;
}
