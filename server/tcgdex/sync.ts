import type { CardCategory, PrismaClient } from "@prisma/client";
import { TcgdexSyncError } from "./errors";
import {
  logicalCardKey,
  parseReleaseDate,
  parseTcgdexUpdatedAt,
} from "./normalize";
import {
  buildStandardReference,
  inferLegalStandard,
  mergeStandardReferences,
  type StandardReference,
} from "./legality";
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
  legalStandardAuto: boolean;
  legalExpanded: boolean;
  imageUrl: string | null;
  tcgdexUpdatedAt: Date | null;
  isActive: boolean;
};

function toPrismaCategory(category: ExternalCard["category"]): CardCategory {
  return category as CardCategory;
}

/**
 * `card.legalStandard` is the automatic value (TCGdex + new-set inference);
 * a manual override on the set (admin panel) wins over it.
 */
function printingData(
  card: ExternalCard,
  logicalCardId: string,
  setId: string,
  standardOverride: boolean | null = null,
) {
  return {
    logicalCardId,
    setId,
    localId: card.localId,
    name: card.name,
    category: toPrismaCategory(card.category),
    rarity: card.rarity,
    illustrator: card.illustrator,
    regulationMark: card.regulationMark,
    legalStandard: standardOverride ?? card.legalStandard,
    legalStandardAuto: card.legalStandard,
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
    existing.legalStandardAuto === next.legalStandardAuto &&
    existing.legalExpanded === next.legalExpanded &&
    existing.imageUrl === next.imageUrl &&
    (existing.tcgdexUpdatedAt?.getTime() ?? null) ===
      (next.tcgdexUpdatedAt?.getTime() ?? null);
  return same ? "UNCHANGED" : "UPDATED";
}

/**
 * Standard reference from what is already stored (used by per-set syncs).
 * Reads the automatic value, so manual overrides never feed the inference, and
 * skips the sets being synced: their stored value may itself be inferred, and
 * a new set must not count as "already classified" against itself.
 */
async function loadStandardReference(
  prisma: PrismaLike,
  excludedSetIds: string[],
): Promise<StandardReference> {
  const [newest, marks] = await Promise.all([
    prisma.cardSet.findFirst({
      where: {
        id: { notIn: excludedSetIds },
        releaseDate: { not: null },
        printings: { some: { legalStandardAuto: true } },
      },
      orderBy: { releaseDate: "desc" },
      select: { releaseDate: true },
    }),
    prisma.cardPrinting.findMany({
      where: { setId: { notIn: excludedSetIds }, legalStandardAuto: true, regulationMark: { not: null } },
      distinct: ["regulationMark"],
      select: { regulationMark: true },
    }),
  ]);
  return {
    legalMarks: new Set(marks.map((m) => m.regulationMark).filter((m): m is string => m !== null)),
    newestClassifiedRelease: newest?.releaseDate ? newest.releaseDate.toISOString().slice(0, 10) : null,
  };
}

async function upsertSet(
  prisma: PrismaLike,
  set: ExternalSet,
): Promise<{ id: string; standardOverride: boolean | null }> {
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
    select: { id: true, standardOverride: true },
  });
  return record;
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
        legalStandardAuto: true,
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
  const standardOverrideBySetId = new Map<string, boolean | null>();
  const logicalCache = new Map<string, string>();
  let logicalsCreated = 0;
  let cardsNew = 0;
  let cardsUpdated = 0;
  let cardsUnchanged = 0;

  for (const set of catalog.sets) {
    const { id, standardOverride } = await upsertSet(prisma, set);
    setIdByTcgdexId.set(set.tcgdexId, id);
    standardOverrideBySetId.set(id, standardOverride);
  }

  const existing = await loadExistingPrintings(
    prisma,
    catalog.cards.map((card) => card.tcgdexId),
  );

  const releaseDateBySet = new Map(catalog.sets.map((set) => [set.tcgdexId, set.releaseDate]));
  let standardReference = buildStandardReference(catalog.cards, releaseDateBySet);
  if (options.partial) {
    // A per-set sync only sees its own cards; the rest of the catalog is in the DB.
    standardReference = mergeStandardReferences(
      standardReference,
      await loadStandardReference(prisma, [...setIdByTcgdexId.values()]),
    );
  }

  let done = 0;
  for (const rawCard of catalog.cards) {
    const card: ExternalCard = {
      ...rawCard,
      legalStandard: inferLegalStandard(
        rawCard,
        releaseDateBySet.get(rawCard.setTcgdexId) ?? null,
        standardReference,
      ),
    };
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

    const data = printingData(card, logical.id, setId, standardOverrideBySetId.get(setId) ?? null);
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
