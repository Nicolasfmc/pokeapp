import { prisma } from "@/server/database";
import type { CardCategory } from "@prisma/client";

export type ResolvedCardPrinting = {
  printingId: string;
  logicalCardId: string;
  canonicalName: string;
  category: CardCategory;
  setCode: string | null;
  localId: string;
  printingName: string;
  nameMatched: boolean;
};

export type CardResolveQuery = {
  setCode: string;
  collectorNumber: string;
  name?: string;
};

export type CardResolveSuccess = {
  ok: true;
  value: ResolvedCardPrinting;
};

export type CardResolveFailure = {
  ok: false;
  code: "SET_NOT_FOUND" | "PRINTING_NOT_FOUND";
  message: string;
  query: CardResolveQuery;
};

export type CardResolveResult = CardResolveSuccess | CardResolveFailure;

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function namesCompatible(expected: string | undefined, actual: string): boolean {
  if (!expected) return true;
  const a = normalizeToken(expected);
  const b = normalizeToken(actual);
  if (!a || !b) return true;
  return a === b || a.includes(b) || b.includes(a);
}

function collectorCandidates(collectorNumber: string): string[] {
  const raw = collectorNumber.trim();
  const stripped = raw.replace(/^0+(?=\d)/, "");
  const unique = new Set<string>([raw, stripped].filter(Boolean));
  return [...unique];
}

export async function resolveCardBySetAndCollector(
  query: CardResolveQuery,
): Promise<CardResolveResult> {
  const setCode = query.setCode.trim();
  const collectorNumber = query.collectorNumber.trim();

  if (!setCode || !collectorNumber) {
    return {
      ok: false,
      code: "SET_NOT_FOUND",
      message: "setCode e collectorNumber são obrigatórios",
      query,
    };
  }

  const set = await prisma.cardSet.findFirst({
    where: {
      isActive: true,
      code: { equals: setCode, mode: "insensitive" },
    },
    select: { id: true, code: true },
  });

  if (!set) {
    return {
      ok: false,
      code: "SET_NOT_FOUND",
      message: `Set não encontrado: ${setCode}`,
      query,
    };
  }

  const localIds = collectorCandidates(collectorNumber);
  const printing = await prisma.cardPrinting.findFirst({
    where: {
      setId: set.id,
      isActive: true,
      OR: localIds.map((localId) => ({
        localId: { equals: localId, mode: "insensitive" as const },
      })),
    },
    include: {
      logicalCard: {
        select: {
          id: true,
          canonicalName: true,
          category: true,
        },
      },
    },
  });

  if (!printing) {
    return {
      ok: false,
      code: "PRINTING_NOT_FOUND",
      message: `Impressão não encontrada: ${setCode} ${collectorNumber}`,
      query,
    };
  }

  const nameMatched = namesCompatible(
    query.name,
    printing.logicalCard.canonicalName,
  );

  return {
    ok: true,
    value: {
      printingId: printing.id,
      logicalCardId: printing.logicalCard.id,
      canonicalName: printing.logicalCard.canonicalName,
      category: printing.logicalCard.category,
      setCode: set.code,
      localId: printing.localId,
      printingName: printing.name,
      nameMatched,
    },
  };
}

export type AggregatedLogicalCard = {
  logicalCardId: string;
  quantity: number;
  canonicalName: string;
  category: CardCategory;
  unresolved?: never;
};

export function aggregateByLogicalCard(
  items: Array<{
    logicalCardId: string;
    quantity: number;
    canonicalName: string;
    category: CardCategory;
  }>,
): AggregatedLogicalCard[] {
  const map = new Map<string, AggregatedLogicalCard>();

  for (const item of items) {
    const existing = map.get(item.logicalCardId);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(item.logicalCardId, {
        logicalCardId: item.logicalCardId,
        quantity: item.quantity,
        canonicalName: item.canonicalName,
        category: item.category,
      });
    }
  }

  return [...map.values()];
}
