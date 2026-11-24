import { prisma } from "@/server/database";
import {
  computeInventoryCheck,
  type InventoryCheckLot,
  type InventoryCheckRequirement,
  type InventoryCheckResult,
} from "./inventory-check-compute";

export * from "./inventory-check-compute";

export class InventoryCheckError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "InventoryCheckError";
    this.status = status;
    this.code = code;
  }
}

async function loadLots(
  userId: string,
  logicalCardIds: string[],
): Promise<InventoryCheckLot[]> {
  if (logicalCardIds.length === 0) return [];
  const items = await prisma.inventoryItem.findMany({
    where: {
      userId,
      cardPrinting: { logicalCardId: { in: logicalCardIds } },
    },
    select: {
      quantity: true,
      cardPrinting: { select: { logicalCardId: true } },
      allocations: {
        select: {
          quantity: true,
          deck: { select: { id: true, name: true } },
        },
      },
    },
  });

  return items.map((item) => ({
    logicalCardId: item.cardPrinting.logicalCardId,
    quantity: item.quantity,
    allocations: item.allocations.map((alloc) => ({
      deckId: alloc.deck.id,
      deckName: alloc.deck.name,
      quantity: alloc.quantity,
    })),
  }));
}

/** §56 — Inventory Check de um deck do usuário. */
export async function getDeckInventoryCheck(
  userId: string,
  deckId: string,
): Promise<InventoryCheckResult> {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    select: {
      id: true,
      cards: {
        select: {
          logicalCardId: true,
          quantity: true,
          logicalCard: { select: { canonicalName: true, category: true } },
        },
      },
    },
  });
  if (!deck) {
    throw new InventoryCheckError("Deck não encontrado.", 404, "NOT_FOUND");
  }

  const requirements: InventoryCheckRequirement[] = deck.cards.map((card) => ({
    logicalCardId: card.logicalCardId,
    canonicalName: card.logicalCard.canonicalName,
    category: card.logicalCard.category,
    required: card.quantity,
  }));

  const lots = await loadLots(
    userId,
    requirements.map((r) => r.logicalCardId),
  );
  return computeInventoryCheck(deck.id, requirements, lots);
}

/** Inventory Check para uma lista ainda não salva (ex.: resultado de import). */
export async function checkRequirementsAgainstInventory(
  userId: string,
  requirements: InventoryCheckRequirement[],
): Promise<InventoryCheckResult> {
  const lots = await loadLots(
    userId,
    requirements.map((r) => r.logicalCardId),
  );
  return computeInventoryCheck("", requirements, lots);
}

/** Resumo de todos os decks ativos do usuário (Dashboard: alertas de decks incompletos). */
export async function getInventoryCheckSummaries(userId: string) {
  const decks = await prisma.deck.findMany({
    where: { userId, NOT: { tags: { some: { tag: "ARCHIVED" } } } },
    select: {
      id: true,
      name: true,
      physicalStatus: true,
      updatedAt: true,
      cards: {
        select: {
          logicalCardId: true,
          quantity: true,
          logicalCard: { select: { canonicalName: true, category: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const allLogicalIds = [
    ...new Set(decks.flatMap((d) => d.cards.map((c) => c.logicalCardId))),
  ];
  const lots = await loadLots(userId, allLogicalIds);

  return decks.map((deck) => {
    const check = computeInventoryCheck(
      deck.id,
      deck.cards.map((card) => ({
        logicalCardId: card.logicalCardId,
        canonicalName: card.logicalCard.canonicalName,
        category: card.logicalCard.category,
        required: card.quantity,
      })),
      lots,
    );
    return {
      deckId: deck.id,
      deckName: deck.name,
      physicalStatus: deck.physicalStatus,
      updatedAt: deck.updatedAt.toISOString(),
      summary: check.summary,
    };
  });
}
