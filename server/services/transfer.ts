import { PhysicalStatus } from "@prisma/client";
import { prisma } from "@/server/database";
import {
  AllocationServiceError,
  allocateDeckFromInventory,
  allocationsToViews,
  clearDeckAllocations,
  lockDecksOrdered,
  type DeckAllocationView,
} from "./allocation";

export type TransferResult = {
  sourceDeckId: string;
  targetDeckId: string;
  sourcePhysicalStatus: typeof PhysicalStatus.NOT_SLEEVED;
  targetPhysicalStatus: typeof PhysicalStatus.SLEEVED;
  allocations: DeckAllocationView[];
};

export async function transferSleevedDeck(
  userId: string,
  targetDeckId: string,
  sourceDeckId: string,
): Promise<TransferResult> {
  if (!sourceDeckId || typeof sourceDeckId !== "string") {
    throw new AllocationServiceError(
      "sourceDeckId é obrigatório.",
      400,
      "INVALID_SOURCE",
    );
  }

  if (sourceDeckId === targetDeckId) {
    throw new AllocationServiceError(
      "Origem e destino devem ser decks diferentes.",
      400,
      "SAME_DECK",
    );
  }

  return prisma.$transaction(async (tx) => {
    const locked = await lockDecksOrdered(tx, userId, [
      sourceDeckId,
      targetDeckId,
    ]);
    const byId = new Map(locked.map((row) => [row.id, row]));
    const source = byId.get(sourceDeckId);
    const target = byId.get(targetDeckId);

    if (!source || !target) {
      throw new AllocationServiceError("Deck não encontrado.", 404, "NOT_FOUND");
    }

    if (source.physicalStatus !== PhysicalStatus.SLEEVED) {
      throw new AllocationServiceError(
        "Deck de origem precisa estar SLEEVED.",
        409,
        "SOURCE_NOT_SLEEVED",
      );
    }

    await clearDeckAllocations(tx, sourceDeckId);
    await tx.deck.update({
      where: { id: sourceDeckId },
      data: { physicalStatus: PhysicalStatus.NOT_SLEEVED },
    });

    await allocateDeckFromInventory(tx, userId, targetDeckId);

    const allocations = await allocationsToViews(tx, targetDeckId);

    return {
      sourceDeckId,
      targetDeckId,
      sourcePhysicalStatus: PhysicalStatus.NOT_SLEEVED,
      targetPhysicalStatus: PhysicalStatus.SLEEVED,
      allocations,
    };
  });
}
