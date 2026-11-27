import type { PrismaClient } from "@prisma/client";

type PrismaLike = Pick<PrismaClient, "cardLogical" | "deckCard" | "deckAllocation" | "$transaction">;

export type RemapStats = { logicalsRemapped: number; deckCardsMoved: number };

type Candidate = {
  id: string;
  printings: Array<{ legalStandard: boolean; isActive: boolean; set: { releaseDate: Date | null } }>;
};

/**
 * Picks the version a deck most likely meant: one with a Standard-legal
 * printing first, then the one with the most recent printing.
 */
export function newestVersion(candidates: Candidate[]): string | null {
  let best: { id: string; legal: number; release: number } | null = null;
  for (const candidate of candidates) {
    const active = candidate.printings.filter((p) => p.isActive);
    const pool = active.length ? active : candidate.printings;
    const legal = pool.some((p) => p.legalStandard) ? 1 : 0;
    const release = Math.max(0, ...pool.map((p) => p.set.releaseDate?.getTime() ?? 0));
    if (!best || legal > best.legal || (legal === best.legal && release > best.release)) {
      best = { id: candidate.id, legal, release };
    }
  }
  return best?.id ?? null;
}

/**
 * Once the sync has split a name into gameplay versions (gameplayKey), the
 * legacy logical card (gameplayKey "") is left without printings. Deck lines
 * still pointing to it move to the version the player physically sleeved
 * (deck allocations), else to the newest Standard-legal version. Quantities
 * merge when the deck already has that version. The legacy row is kept so
 * frozen tournament snapshots that mention its id stay readable.
 */
export async function remapSplitLogicals(prisma: PrismaLike): Promise<RemapStats> {
  const legacy = await prisma.cardLogical.findMany({
    where: { category: "POKEMON", gameplayKey: "", printings: { none: {} }, deckCards: { some: {} } },
    select: {
      id: true,
      canonicalName: true,
      category: true,
      deckCards: { select: { id: true, deckId: true, quantity: true } },
    },
  });

  let logicalsRemapped = 0;
  let deckCardsMoved = 0;

  for (const old of legacy) {
    const candidates = await prisma.cardLogical.findMany({
      where: {
        canonicalName: old.canonicalName,
        category: old.category,
        gameplayKey: { not: "" },
        printings: { some: {} },
      },
      select: {
        id: true,
        printings: { select: { legalStandard: true, isActive: true, set: { select: { releaseDate: true } } } },
      },
    });
    const fallback = newestVersion(candidates);
    if (!fallback) continue;
    const candidateIds = new Set(candidates.map((c) => c.id));

    for (const line of old.deckCards) {
      const target = (await sleevedVersion(prisma, line.deckId, candidateIds)) ?? fallback;
      await prisma.$transaction(async (tx) => {
        const existing = await tx.deckCard.findUnique({
          where: { deckId_logicalCardId: { deckId: line.deckId, logicalCardId: target } },
          select: { id: true },
        });
        if (existing) {
          await tx.deckCard.update({ where: { id: existing.id }, data: { quantity: { increment: line.quantity } } });
          await tx.deckCard.delete({ where: { id: line.id } });
        } else {
          await tx.deckCard.update({ where: { id: line.id }, data: { logicalCardId: target } });
        }
      });
      deckCardsMoved += 1;
    }
    logicalsRemapped += 1;
  }

  return { logicalsRemapped, deckCardsMoved };
}

/** The version with the most copies allocated to this deck, if any. */
async function sleevedVersion(prisma: PrismaLike, deckId: string, candidateIds: Set<string>) {
  const allocations = await prisma.deckAllocation.findMany({
    where: { deckId },
    select: { quantity: true, inventoryItem: { select: { cardPrinting: { select: { logicalCardId: true } } } } },
  });
  const totals = new Map<string, number>();
  for (const allocation of allocations) {
    const id = allocation.inventoryItem.cardPrinting.logicalCardId;
    if (candidateIds.has(id)) totals.set(id, (totals.get(id) ?? 0) + allocation.quantity);
  }
  let best: string | null = null;
  for (const [id, quantity] of totals) {
    if (best === null || quantity > (totals.get(best) ?? 0)) best = id;
  }
  return best;
}
