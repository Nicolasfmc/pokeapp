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

const DEACTIVATE_CHUNK = 1000;

export type CardChange = "NEW" | "UPDATED" | "UNCHANGED";

type ExistingPrinting = {
  tcgdexId: string;
  logicalCardId: string;
  setId: string;
  localId: string;
  name: string;
  category: CardCategory;
  rarity: string | null;
  illustrator: string | null;
  regulationMark: string | null;
  legalStandard: boolean;
  legalExpanded: boolean;
  imageUrl: string | null;
  tcgdexUpdatedAt: Date | null;
  isActive: boolean;
};

function toPrismaCategory(category: ExternalCard["category"]): CardCategory {
  return category as CardCategory;
}

function printingData(card: ExternalCard, logicalCardId: string, setId: string) {
  return {
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
  };
}

/** §11.2 — compara o registro local com o normalizado vindo da fonte. */
export function classifyCardChange(
  existing: ExistingPrinting | undefined,
  next: ReturnType<typeof printingData>,
): CardChange {
  if (!existing) return "NEW";
  const same =
    existing.isActive === next.isActive &&
    existing.logicalCardId === next.logicalCardId &&
    existing.setId === next.setId &&
    existing.localId === next.localId &&
    existing.name === next.name &&
    existing.category === next.category &&
    existing.rarity === next.rarity &&
    existing.illustrator === next.illustrator &&
    existing.regulationMark === next.regulationMark &&
    existing.legalStandard === next.legalStandard &&
    existing.legalExpanded === next.legalExpanded &&
    existing.imageUrl === next.imageUrl &&
    (existing.tcgdexUpdatedAt?.getTime() ?? null) ===
      (next.tcgdexUpdatedAt?.getTime() ?? null);
  return same ? "UNCHANGED" : "UPDATED";
}

async function upsertSet(
  prisma: PrismaLike,
  set: ExternalSet,
): Promise<string> {
  const data = {
    name: set.name,
    code: set.code,
    series: set.series,
    releaseDate: parseReleaseDate(set.releaseDate),
    logoUrl: set.logoUrl,
    symbolUrl: set.symbolUrl,
    isActive: true,
  };
  const record = await prisma.cardSet.upsert({
    where: { tcgdexId: set.tcgdexId },
    create: { tcgdexId: set.tcgdexId, ...data },
    update: data,
  });
  return record.id;
}

async function findOrCreateLogical(
  prisma: PrismaLike,
  card: ExternalCard,
  cache: Map<string, string>,
): Promise<{ id: string; created: boolean }> {
  const key = logicalCardKey(card.name, card.category, card.energyType);
  const cacheKey = `${key.canonicalName}::${key.category}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return { id: cached, created: false };
  }

  const category = toPrismaCategory(key.category);
  const where = {
    canonicalName_category: {
      canonicalName: key.canonicalName,
      category,
    },
  };
  const existing = await prisma.cardLogical.findUnique({ where });

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
    const raced = await prisma.cardLogical.findUnique({ where });
    if (raced) {
      cache.set(cacheKey, raced.id);
      return { id: raced.id, created: false };
    }
    throw error;
  }
}

async function loadExistingPrintings(
  prisma: PrismaLike,
  tcgdexIds: string[],
): Promise<Map<string, ExistingPrinting>> {
  const map = new Map<string, ExistingPrinting>();
  for (let i = 0; i < tcgdexIds.length; i += DEACTIVATE_CHUNK) {
    const chunk = tcgdexIds.slice(i, i + DEACTIVATE_CHUNK);
    const rows = (await prisma.cardPrinting.findMany({
      where: { tcgdexId: { in: chunk } },
      select: {
        tcgdexId: true,
        logicalCardId: true,
        setId: true,
        localId: true,
        name: true,
        category: true,
        rarity: true,
        illustrator: true,
        regulationMark: true,
        legalStandard: true,
        legalExpanded: true,
        imageUrl: true,
        tcgdexUpdatedAt: true,
        isActive: true,
      },
    })) as ExistingPrinting[];
    for (const row of rows) {
      map.set(row.tcgdexId, row);
    }
  }
  return map;
}

async function deactivateMissing(
  prisma: PrismaLike,
  model: "cardSet" | "cardPrinting",
  seen: Set<string>,
): Promise<number> {
  const delegate = prisma[model] as unknown as {
    findMany(args: unknown): Promise<Array<{ id: string; tcgdexId: string }>>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  const active = await delegate.findMany({
    where: { isActive: true },
    select: { id: true, tcgdexId: true },
  });
  const missing = active.filter((row) => !seen.has(row.tcgdexId)).map((r) => r.id);
  let count = 0;
  for (let i = 0; i < missing.length; i += DEACTIVATE_CHUNK) {
    const result = await delegate.updateMany({
      where: { id: { in: missing.slice(i, i + DEACTIVATE_CHUNK) } },
      data: { isActive: false },
    });
    count += result.count;
  }
  return count;
}

/**
 * Persiste o catálogo normalizado (§11). Nunca apaga linhas: o que sumiu da
 * fonte vira `isActive = false` (§11.3), preservando decks/inventory/partidas.
 * Com `partial: true` (sync por set) nada é desativado.
 */
export async function persistCatalog(
  prisma: PrismaLike,
  catalog: {
    sets: ExternalSet[];
    cards: ExternalCard[];
    /** Listadas pela fonte mas não baixadas (erro transitório): não são REMOVED. */
    unavailableCardIds?: string[];
  },
  options: { partial?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<SyncStats> {
  if (catalog.sets.length === 0 || catalog.cards.length === 0) {
    throw new TcgdexSyncError(
      "Catálogo TCGdex vazio; sync abortado para evitar soft-delete em massa",
    );
  }

  const setIdByTcgdexId = new Map<string, string>();
  const logicalCache = new Map<string, string>();
  let logicalsCreated = 0;
  let cardsNew = 0;
  let cardsUpdated = 0;
  let cardsUnchanged = 0;

  for (const set of catalog.sets) {
    const id = await upsertSet(prisma, set);
    setIdByTcgdexId.set(set.tcgdexId, id);
  }

  const existing = await loadExistingPrintings(
    prisma,
    catalog.cards.map((card) => card.tcgdexId),
  );

  let done = 0;
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

    const data = printingData(card, logical.id, setId);
    const change = classifyCardChange(existing.get(card.tcgdexId), data);
    if (change === "UNCHANGED") {
      cardsUnchanged += 1;
    } else {
      await prisma.cardPrinting.upsert({
        where: { tcgdexId: card.tcgdexId },
        create: { tcgdexId: card.tcgdexId, ...data },
        update: data,
      });
      if (change === "NEW") cardsNew += 1;
      else cardsUpdated += 1;
    }

    done += 1;
    if (options.onProgress && done % 500 === 0) {
      options.onProgress(done, catalog.cards.length);
    }
  }

  let setsDeactivated = 0;
  let cardsRemoved = 0;
  if (!options.partial) {
    setsDeactivated = await deactivateMissing(
      prisma,
      "cardSet",
      new Set(catalog.sets.map((set) => set.tcgdexId)),
    );
    cardsRemoved = await deactivateMissing(
      prisma,
      "cardPrinting",
      new Set([
        ...catalog.cards.map((card) => card.tcgdexId),
        ...(catalog.unavailableCardIds ?? []),
      ]),
    );
  }

  return {
    setsUpserted: catalog.sets.length,
    setsDeactivated,
    cardsUpserted: cardsNew + cardsUpdated,
    cardsDeactivated: cardsRemoved,
    logicalsCreated,
    cardsNew,
    cardsUpdated,
    cardsUnchanged,
    cardsRemoved,
  };
}

export async function syncTcgdex(
  prisma: PrismaLike,
  options: SyncOptions & {
    provider?: CardDataProvider;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<SyncStats> {
  const provider =
    options.provider ??
    new TCGdexProvider({
      language: options.language,
      concurrency: options.concurrency,
    });
  const partial = Boolean(options.setIds?.length);

  try {
    let sets: ExternalSet[];
    let cards: ExternalCard[];
    let unavailableCardIds: string[] = [];

    if (provider instanceof TCGdexProvider) {
      const catalog = await provider.listSeriesThenSetsThenCards({
        setIds: options.setIds,
        excludedSeriesIds: options.excludedSeriesIds,
      });
      sets = catalog.sets;
      cards = catalog.cards;
      unavailableCardIds = catalog.unavailableCardIds;
    } else {
      sets = await provider.listSets();
      cards = await provider.listCards();
    }

    return await persistCatalog(
      prisma,
      { sets, cards, unavailableCardIds },
      { partial, onProgress: options.onProgress },
    );
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
