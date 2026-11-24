import { prisma } from "@/server/database";
import { CardsServiceError } from "./errors";
import {
  toCardLogicalDto,
  toCardPrintingDto,
  toCardSetDto,
} from "./mappers";
import {
  buildLogicalWhere,
  buildPrintingWhere,
  buildSetWhere,
} from "./query";
import { pickRepresentative } from "./representative";
import type {
  CardLogicalDetailDto,
  CardPrintingDto,
  CardSearchParams,
  CardSearchResult,
  CardSetDetailDto,
  CardSetListResult,
} from "./types";

const printingInclude = {
  set: true,
  logicalCard: true,
} as const;

export const representativeSelect = {
  id: true,
  imageUrl: true,
  rarity: true,
  legalStandard: true,
  legalExpanded: true,
  isActive: true,
  set: { select: { releaseDate: true } },
} as const;

export function flattenCandidate(p: {
  id: string;
  imageUrl: string | null;
  rarity: string | null;
  legalStandard: boolean;
  legalExpanded: boolean;
  isActive: boolean;
  set: { releaseDate: Date | null };
}) {
  return { ...p, releaseDate: p.set.releaseDate };
}

export async function searchCards(
  params: CardSearchParams,
): Promise<CardSearchResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const mode = params.mode ?? "printing";
  const skip = (page - 1) * pageSize;

  if (mode === "logical") {
    const where = buildLogicalWhere(params);
    const [total, rows] = await Promise.all([
      prisma.cardLogical.count({ where }),
      prisma.cardLogical.findMany({
        where,
        include: {
          _count: { select: { printings: true } },
          printings: {
            where: { isActive: true, imageUrl: { not: null } },
            select: representativeSelect,
          },
        },
        orderBy: [{ canonicalName: "asc" }, { category: "asc" }],
        skip,
        take: pageSize,
      }),
    ]);

    return {
      mode,
      page,
      pageSize,
      total,
      items: rows.map((row) => {
        const rep = pickRepresentative(
          row.printings.map(flattenCandidate),
          params.format ?? null,
        );
        return {
          ...toCardLogicalDto(row),
          imageUrl: rep?.imageUrl ?? null,
          representativePrintingId: rep?.id ?? null,
        };
      }),
    };
  }

  const where = buildPrintingWhere(params);
  const [total, rows] = await Promise.all([
    prisma.cardPrinting.count({ where }),
    prisma.cardPrinting.findMany({
      where,
      include: printingInclude,
      orderBy: [{ name: "asc" }, { localId: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    mode,
    page,
    pageSize,
    total,
    items: rows.map(toCardPrintingDto),
  };
}

export async function getPrintingById(id: string): Promise<CardPrintingDto> {
  const printing = await prisma.cardPrinting.findUnique({
    where: { id },
    include: printingInclude,
  });

  if (!printing) {
    throw new CardsServiceError("Impressão não encontrada.", 404, "NOT_FOUND");
  }

  return toCardPrintingDto(printing);
}

export async function getPrintingByTcgdexId(
  tcgdexId: string,
): Promise<CardPrintingDto> {
  const printing = await prisma.cardPrinting.findUnique({
    where: { tcgdexId },
    include: printingInclude,
  });

  if (!printing) {
    throw new CardsServiceError("Impressão não encontrada.", 404, "NOT_FOUND");
  }

  return toCardPrintingDto(printing);
}

export async function getLogicalById(id: string): Promise<CardLogicalDetailDto> {
  const logical = await prisma.cardLogical.findUnique({
    where: { id },
    include: {
      _count: { select: { printings: true } },
      printings: {
        where: { isActive: true },
        include: { set: true },
        orderBy: [{ set: { releaseDate: "desc" } }, { localId: "asc" }],
      },
    },
  });

  if (!logical) {
    throw new CardsServiceError("Carta lógica não encontrada.", 404, "NOT_FOUND");
  }

  return {
    ...toCardLogicalDto(logical),
    printings: logical.printings.map((printing) =>
      toCardPrintingDto({ ...printing, logicalCard: logical }),
    ),
  };
}

export async function listSets(params: {
  q?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<CardSetListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 24;
  const skip = (page - 1) * pageSize;
  const where = buildSetWhere({
    q: params.q,
    isActive: params.isActive ?? true,
  });

  const [total, rows] = await Promise.all([
    prisma.cardSet.count({ where }),
    prisma.cardSet.findMany({
      where,
      orderBy: [{ releaseDate: "desc" }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    items: rows.map(toCardSetDto),
  };
}

export async function getSetById(id: string): Promise<CardSetDetailDto> {
  const set = await prisma.cardSet.findUnique({
    where: { id },
    include: {
      printings: {
        where: { isActive: true },
        include: { logicalCard: true },
        orderBy: [{ localId: "asc" }],
      },
      _count: { select: { printings: true } },
    },
  });

  if (!set) {
    throw new CardsServiceError("Set não encontrado.", 404, "NOT_FOUND");
  }

  return {
    ...toCardSetDto(set),
    printingCount: set._count.printings,
    printings: set.printings.map((printing) =>
      toCardPrintingDto({ ...printing, set }),
    ),
  };
}
