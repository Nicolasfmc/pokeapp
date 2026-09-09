import type { CollectionStatus, Condition } from "@prisma/client";

export type SelectableInventoryLot = {
  inventoryItemId: string;
  logicalCardId: string;
  freeQuantity: number;
  collectionStatus: CollectionStatus;
  condition: Condition;
  language: string;
  cardPrintingId: string;
};

export type DeckRequirement = {
  logicalCardId: string;
  quantity: number;
};

export type AllocationShortage = {
  logicalCardId: string;
  required: number;
  available: number;
};

export type AllocationPick = {
  inventoryItemId: string;
  quantity: number;
};

const CONDITION_RANK: Record<Condition, number> = {
  NM: 0,
  LP: 1,
  MP: 2,
  HP: 3,
  DMG: 4,
};

const COLLECTION_RANK: Record<CollectionStatus, number> = {
  COMPETITIVE: 0,
  COLLECTION: 1,
};

export function compareLotsForAutoSelect(
  a: SelectableInventoryLot,
  b: SelectableInventoryLot,
): number {
  const byCollection =
    COLLECTION_RANK[a.collectionStatus] - COLLECTION_RANK[b.collectionStatus];
  if (byCollection !== 0) return byCollection;

  const byCondition = CONDITION_RANK[a.condition] - CONDITION_RANK[b.condition];
  if (byCondition !== 0) return byCondition;

  const aEn = a.language === "en" ? 0 : 1;
  const bEn = b.language === "en" ? 0 : 1;
  if (aEn !== bEn) return aEn - bEn;

  const byLanguage = a.language.localeCompare(b.language);
  if (byLanguage !== 0) return byLanguage;

  const byPrinting = a.cardPrintingId.localeCompare(b.cardPrintingId);
  if (byPrinting !== 0) return byPrinting;

  return a.inventoryItemId.localeCompare(b.inventoryItemId);
}

export function selectAllocationsForDeck(
  requirements: DeckRequirement[],
  lots: SelectableInventoryLot[],
):
  | { ok: true; picks: AllocationPick[] }
  | { ok: false; shortages: AllocationShortage[] } {
  const remaining = new Map<string, number>();
  for (const req of requirements) {
    if (req.quantity <= 0) continue;
    remaining.set(
      req.logicalCardId,
      (remaining.get(req.logicalCardId) ?? 0) + req.quantity,
    );
  }

  const freeByItem = new Map<string, number>();
  for (const lot of lots) {
    freeByItem.set(
      lot.inventoryItemId,
      Math.max(0, lot.freeQuantity) + (freeByItem.get(lot.inventoryItemId) ?? 0),
    );
  }

  const lotsByLogical = new Map<string, SelectableInventoryLot[]>();
  for (const lot of lots) {
    if ((freeByItem.get(lot.inventoryItemId) ?? 0) <= 0) continue;
    const list = lotsByLogical.get(lot.logicalCardId) ?? [];
    list.push(lot);
    lotsByLogical.set(lot.logicalCardId, list);
  }

  for (const [, list] of lotsByLogical) {
    list.sort(compareLotsForAutoSelect);
  }

  const pickMap = new Map<string, number>();
  const shortages: AllocationShortage[] = [];

  for (const [logicalCardId, needed] of remaining) {
    let left = needed;
    const candidates = lotsByLogical.get(logicalCardId) ?? [];

    for (const lot of candidates) {
      if (left <= 0) break;
      const free = freeByItem.get(lot.inventoryItemId) ?? 0;
      if (free <= 0) continue;
      const take = Math.min(free, left);
      pickMap.set(
        lot.inventoryItemId,
        (pickMap.get(lot.inventoryItemId) ?? 0) + take,
      );
      freeByItem.set(lot.inventoryItemId, free - take);
      left -= take;
    }

    if (left > 0) {
      shortages.push({
        logicalCardId,
        required: needed,
        available: needed - left,
      });
    }
  }

  if (shortages.length > 0) {
    return { ok: false, shortages };
  }

  return {
    ok: true,
    picks: [...pickMap.entries()].map(([inventoryItemId, quantity]) => ({
      inventoryItemId,
      quantity,
    })),
  };
}
