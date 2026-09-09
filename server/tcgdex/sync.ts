import type { CardCategory, PrismaClient } from "@prisma/client";
import { TcgdexSyncError } from "./errors";
import {
  logicalCardKey,
  parseReleaseDate,
  parseTcgdexUpdatedAt,
} from "./normalize";
import { TCGdexProvider } from "./provider";
import type {
  CardDataProvider,
  ExternalCard,
  ExternalSet,
  SyncOptions,
  SyncStats,
} from "./types";

type PrismaLike = Pick<
  PrismaClient,
  "cardSet" | "cardLogical" | "cardPrinting" | "$transaction"
>;

function toPrismaCategory(category: ExternalCard["category"]): CardCategory {
  return category as CardCategory;
}

async function upsertSet(
  prisma: PrismaLike,
  set: ExternalSet,
): Promise<string> {
  const record = await prisma.cardSet.upsert({
    where: { tcgdexId: set.tcgdexId },
    create: {
      tcgdexId: set.tcgdexId,
      name: set.name,
      code: set.code,
      series: set.series,
      releaseDate: parseReleaseDate(set.releaseDate),
      logoUrl: set.logoUrl,
      symbolUrl: set.symbolUrl,
      isActive: true,
    },
    update: {
      name: set.name,
      code: set.code,
      series: set.series,
      releaseDate: parseReleaseDate(set.releaseDate),
      logoUrl: set.logoUrl,
      symbolUrl: set.symbolUrl,
      isActive: true,
    },
  });
  return record.id;
}

async function findOrCreateLogical(
  prisma: PrismaLike,
  card: ExternalCard,
  cache: Map<string, string>,
): Promise<{ id: string; created: boolean }> {
  const key = logicalCardKey(card.name, card.category);
  const cacheKey = `${key.canonicalName}::${key.category}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return { id: cached, created: false };
  }

  const category = toPrismaCategory(key.category);
  const existing = await prisma.cardLogical.findUnique({
    where: {
      canonicalName_category: {
        canonicalName: key.canonicalName,
        category,
      },
    },
  });

  if (existing) {
    cache.set(cacheKey, existing.id);
    return { id: existing.id, created: false };
  }

  try {
    const created = await prisma.cardLogical.create({
      data: {
        canonicalName: key.canonicalName,
        category,
      },
    });
    cache.set(cacheKey, created.id);
    return { id: created.id, created: true };
  } catch (error) {
    const raced = await prisma.cardLogical.findUnique({
      where: {
        canonicalName_category: {
          canonicalName: key.canonicalName,
          category,
        },
      },
    });
    if (raced) {
      cache.set(cacheKey, raced.id);
      return { id: raced.id, created: false };
    }
    throw error;
  }
}

async function upsertPrinting(
  prisma: PrismaLike,
  card: ExternalCard,
  logicalCardId: string,
  setId: string,
): Promise<void> {
  await prisma.cardPrinting.upsert({
    where: { tcgdexId: card.tcgdexId },
    create: {
      tcgdexId: card.tcgdexId,
      logicalCardId,
      setId,
      localId: card.localId,
      name: card.name,
      category: toPrismaCategory(card.category),
      rarity: card.rarity,
      illustrator: card.illustrator,
      regulationMark: card.regulationMark,
      legalStandard: card.legalStandard,
      legalExpanded: card.legalExpanded,
      imageUrl: card.imageUrl,
      tcgdexUpdatedAt: parseTcgdexUpdatedAt(card.tcgdexUpdatedAt),
      isActive: true,
    },
    update: {
      logicalCardId,
      setId,
      localId: card.localId,
      name: card.name,
      category: toPrismaCategory(card.category),
      rarity: card.rarity,
      illustrator: card.illustrator,
      regulationMark: card.regulationMark,
      legalStandard: card.legalStandard,
      legalExpanded: card.legalExpanded,
      imageUrl: card.imageUrl,
      tcgdexUpdatedAt: parseTcgdexUpdatedAt(card.tcgdexUpdatedAt),
      isActive: true,
    },
  });
}

export async function persistCatalog(
  prisma: PrismaLike,
  catalog: { sets: ExternalSet[]; cards: ExternalCard[] },
): Promise<SyncStats> {
  if (catalog.sets.length === 0 || catalog.cards.length === 0) {
    throw new TcgdexSyncError(
      "Catálogo TCGdex vazio; sync abortado para evitar soft-delete em massa",
    );
  }

  const setIdByTcgdexId = new Map<string, string>();
  const logicalCache = new Map<string, string>();
  let logicalsCreated = 0;

  for (const set of catalog.sets) {
    const id = await upsertSet(prisma, set);
    setIdByTcgdexId.set(set.tcgdexId, id);
  }

  for (const card of catalog.cards) {
    const setId = setIdByTcgdexId.get(card.setTcgdexId);
    if (!setId) {
      throw new TcgdexSyncError(
        `Carta ${card.tcgdexId} referencia set ausente ${card.setTcgdexId}`,
      );
    }

    const logical = await findOrCreateLogical(prisma, card, logicalCache);
    if (logical.created) {
      logicalsCreated += 1;
    }

    await upsertPrinting(prisma, card, logical.id, setId);
  }

  const seenSetIds = catalog.sets.map((set) => set.tcgdexId);
  const seenCardIds = catalog.cards.map((card) => card.tcgdexId);

  const setsDeactivated = await prisma.cardSet.updateMany({
    where: {
      isActive: true,
      tcgdexId: { notIn: seenSetIds },
    },
    data: { isActive: false },
  });

  const cardsDeactivated = await prisma.cardPrinting.updateMany({
    where: {
      isActive: true,
      tcgdexId: { notIn: seenCardIds },
    },
    data: { isActive: false },
  });

  return {
    setsUpserted: catalog.sets.length,
    setsDeactivated: setsDeactivated.count,
    cardsUpserted: catalog.cards.length,
    cardsDeactivated: cardsDeactivated.count,
    logicalsCreated,
  };
}

export async function syncTcgdex(
  prisma: PrismaLike,
  options: SyncOptions & { provider?: CardDataProvider } = {},
): Promise<SyncStats> {
  const provider =
    options.provider ??
    new TCGdexProvider({
      language: options.language,
      concurrency: options.concurrency,
    });

  try {
    let sets: ExternalSet[];
    let cards: ExternalCard[];

    if (provider instanceof TCGdexProvider) {
      const catalog = await provider.listSeriesThenSetsThenCards();
      sets = catalog.sets;
      cards = catalog.cards;
    } else {
      sets = await provider.listSets();
      cards = await provider.listCards();
    }

    return await persistCatalog(prisma, { sets, cards });
  } catch (error) {
    console.error(error);
    if (error instanceof TcgdexSyncError) {
      throw error;
    }
    throw new TcgdexSyncError("Falha na sincronização TCGdex", {
      cause: error,
    });
  }
}
