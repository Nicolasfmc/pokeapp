import { prisma } from "@/server/database";
import {
  computeAvailability,
  type AvailabilityMetrics,
} from "./availability-compute";

export type { AvailabilityMetrics };
export { computeAvailability };

function sumQuantities(items: { quantity: number }[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function sumAllocationQuantities(
  items: { allocations: { quantity: number }[] }[],
): number {
  return items.reduce(
    (total, item) =>
      total + item.allocations.reduce((sum, row) => sum + row.quantity, 0),
    0,
  );
}

export async function getLogicalAvailability(
  userId: string,
  logicalCardId: string,
): Promise<AvailabilityMetrics & { logicalCardId: string }> {
  const items = await prisma.inventoryItem.findMany({
    where: {
      userId,
      cardPrinting: { logicalCardId },
    },
    select: {
      quantity: true,
      allocations: { select: { quantity: true } },
    },
  });

  return {
    logicalCardId,
    ...computeAvailability(sumQuantities(items), sumAllocationQuantities(items)),
  };
}

export async function getPrintingAvailability(
  userId: string,
  cardPrintingId: string,
): Promise<
  AvailabilityMetrics & {
    cardPrintingId: string;
    logicalCardId: string | null;
    logicalAvailability: AvailabilityMetrics | null;
  }
> {
  const printing = await prisma.cardPrinting.findUnique({
    where: { id: cardPrintingId },
    select: { id: true, logicalCardId: true },
  });

  if (!printing) {
    return {
      cardPrintingId,
      logicalCardId: null,
      logicalAvailability: null,
      ...computeAvailability(0, 0),
    };
  }

  const items = await prisma.inventoryItem.findMany({
    where: {
      userId,
      cardPrintingId,
    },
    select: {
      quantity: true,
      allocations: { select: { quantity: true } },
    },
  });

  const printingMetrics = computeAvailability(
    sumQuantities(items),
    sumAllocationQuantities(items),
  );
  const logicalAvailability = await getLogicalAvailability(
    userId,
    printing.logicalCardId,
  );

  return {
    cardPrintingId,
    logicalCardId: printing.logicalCardId,
    logicalAvailability: {
      ownedQuantity: logicalAvailability.ownedQuantity,
      sleevedAllocatedQuantity: logicalAvailability.sleevedAllocatedQuantity,
      competitiveReserve: logicalAvailability.competitiveReserve,
      protectedQuantity: logicalAvailability.protectedQuantity,
      availableForTrade: logicalAvailability.availableForTrade,
    },
    ...printingMetrics,
  };
}

export async function getLogicalAvailabilityMap(
  userId: string,
  logicalCardIds: string[],
): Promise<Map<string, AvailabilityMetrics>> {
  const uniqueIds = [...new Set(logicalCardIds.filter(Boolean))];
  const result = new Map<string, AvailabilityMetrics>();

  if (uniqueIds.length === 0) {
    return result;
  }

  const items = await prisma.inventoryItem.findMany({
    where: {
      userId,
      cardPrinting: { logicalCardId: { in: uniqueIds } },
    },
    select: {
      quantity: true,
      cardPrinting: { select: { logicalCardId: true } },
      allocations: { select: { quantity: true } },
    },
  });

  const ownedByLogical = new Map<string, number>();
  const sleevedByLogical = new Map<string, number>();

  for (const item of items) {
    const logicalId = item.cardPrinting.logicalCardId;
    ownedByLogical.set(
      logicalId,
      (ownedByLogical.get(logicalId) ?? 0) + item.quantity,
    );
    const sleeved = item.allocations.reduce((sum, row) => sum + row.quantity, 0);
    sleevedByLogical.set(
      logicalId,
      (sleevedByLogical.get(logicalId) ?? 0) + sleeved,
    );
  }

  for (const logicalId of uniqueIds) {
    result.set(
      logicalId,
      computeAvailability(
        ownedByLogical.get(logicalId) ?? 0,
        sleevedByLogical.get(logicalId) ?? 0,
      ),
    );
  }

  return result;
}
