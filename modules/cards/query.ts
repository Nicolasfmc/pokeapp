import type { CardCategory, Prisma } from "@prisma/client";
import { CardsServiceError } from "./errors";
import type { CardCategoryDto, CardSearchMode, CardSearchParams } from "./types";

const CATEGORIES = new Set<CardCategoryDto>(["POKEMON", "TRAINER", "ENERGY"]);
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 100;

function parseBoolean(value: string | null): boolean | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "sim"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "nao", "não"].includes(normalized)) {
    return false;
  }
  throw new CardsServiceError(`Booleano inválido: ${value}`, 400, "INVALID_BOOLEAN");
}

function parsePositiveInt(
  value: string | null,
  fallback: number,
  label: string,
  max?: number,
): number {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new CardsServiceError(`${label} inválido.`, 400, "INVALID_PAGINATION");
  }
  if (max !== undefined && parsed > max) {
    return max;
  }
  return parsed;
}

function parseCategory(value: string | null): CardCategoryDto | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase() as CardCategoryDto;
  if (!CATEGORIES.has(normalized)) {
    throw new CardsServiceError(
      "Categoria inválida. Use POKEMON, TRAINER ou ENERGY.",
      400,
      "INVALID_CATEGORY",
    );
  }
  return normalized;
}

function parseMode(value: string | null): CardSearchMode {
  if (!value || value === "printing") {
    return "printing";
  }
  if (value === "logical") {
    return "logical";
  }
  throw new CardsServiceError(
    "mode inválido. Use printing ou logical.",
    400,
    "INVALID_MODE",
  );
}

function parseFormat(
  value: string | null,
): "standard" | "expanded" | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "standard" || normalized === "expanded") {
    return normalized;
  }
  throw new CardsServiceError(
    "format inválido. Use standard ou expanded.",
    400,
    "INVALID_FORMAT",
  );
}

export function parseCardSearchParams(
  searchParams: URLSearchParams,
): CardSearchParams {
  const q = searchParams.get("q")?.trim() || undefined;
  const name = searchParams.get("name")?.trim() || undefined;
  const setId = searchParams.get("setId")?.trim() || undefined;
  const setCode = searchParams.get("setCode")?.trim() || undefined;
  const setTcgdexId = searchParams.get("setTcgdexId")?.trim() || undefined;
  const rarity = searchParams.get("rarity")?.trim() || undefined;
  const regulationMark =
    searchParams.get("regulationMark")?.trim() || undefined;
  const illustrator = searchParams.get("illustrator")?.trim() || undefined;
  const localId = searchParams.get("localId")?.trim() || undefined;

  return {
    q,
    name,
    setId,
    setCode,
    setTcgdexId,
    category: parseCategory(searchParams.get("category")),
    rarity,
    regulationMark,
    illustrator,
    localId,
    legalStandard: parseBoolean(searchParams.get("legalStandard")),
    legalExpanded: parseBoolean(searchParams.get("legalExpanded")),
    format: parseFormat(searchParams.get("format")),
    isActive: parseBoolean(searchParams.get("isActive")) ?? true,
    mode: parseMode(searchParams.get("mode")),
    page: parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE, "page"),
    pageSize: parsePositiveInt(
      searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      "pageSize",
      MAX_PAGE_SIZE,
    ),
  };
}

export function buildPrintingWhere(
  params: CardSearchParams,
): Prisma.CardPrintingWhereInput {
  const and: Prisma.CardPrintingWhereInput[] = [];

  if (params.isActive !== undefined) {
    and.push({ isActive: params.isActive });
  }

  const text = params.q || params.name;
  if (text) {
    and.push({
      OR: [
        { name: { contains: text, mode: "insensitive" } },
        { localId: { contains: text, mode: "insensitive" } },
        { tcgdexId: { contains: text, mode: "insensitive" } },
        {
          logicalCard: {
            canonicalName: { contains: text, mode: "insensitive" },
          },
        },
      ],
    });
  }

  if (params.category) {
    and.push({ category: params.category as CardCategory });
  }

  if (params.rarity) {
    and.push({ rarity: { equals: params.rarity, mode: "insensitive" } });
  }

  if (params.regulationMark) {
    and.push({
      regulationMark: {
        equals: params.regulationMark,
        mode: "insensitive",
      },
    });
  }

  if (params.illustrator) {
    and.push({
      illustrator: { contains: params.illustrator, mode: "insensitive" },
    });
  }

  if (params.localId) {
    // "2" deve casar "002" (TCGdex) e vice-versa.
    const raw = params.localId.trim();
    const stripped = raw.replace(/^0+(?=\d)/, "");
    const variants = new Set([raw, stripped]);
    if (/^\d+$/.test(stripped)) {
      variants.add(stripped.padStart(2, "0"));
      variants.add(stripped.padStart(3, "0"));
    }
    and.push({
      OR: [...variants].map((localId) => ({
        localId: { equals: localId, mode: "insensitive" as const },
      })),
    });
  }

  if (params.legalStandard !== undefined) {
    and.push({ legalStandard: params.legalStandard });
  }

  if (params.legalExpanded !== undefined) {
    and.push({ legalExpanded: params.legalExpanded });
  }

  if (params.format === "standard") {
    and.push({ legalStandard: true });
  } else if (params.format === "expanded") {
    and.push({ legalExpanded: true });
  }

  if (params.setId) {
    and.push({ setId: params.setId });
  }

  if (params.setCode || params.setTcgdexId) {
    and.push({
      set: {
        ...(params.setCode
          ? { code: { equals: params.setCode, mode: "insensitive" } }
          : {}),
        ...(params.setTcgdexId ? { tcgdexId: params.setTcgdexId } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildLogicalWhere(
  params: CardSearchParams,
): Prisma.CardLogicalWhereInput {
  const and: Prisma.CardLogicalWhereInput[] = [];
  const text = params.q || params.name;

  if (text) {
    and.push({
      canonicalName: { contains: text, mode: "insensitive" },
    });
  }

  if (params.category) {
    and.push({ category: params.category as CardCategory });
  }

  const printingFilter = buildPrintingWhere({
    ...params,
    q: undefined,
    name: undefined,
    category: undefined,
    mode: "printing",
  });

  if (Object.keys(printingFilter).length > 0) {
    and.push({ printings: { some: printingFilter } });
  } else if (params.isActive !== undefined) {
    and.push({ printings: { some: { isActive: params.isActive } } });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function buildSetWhere(params: {
  q?: string;
  isActive?: boolean;
}): Prisma.CardSetWhereInput {
  const and: Prisma.CardSetWhereInput[] = [];

  if (params.isActive !== undefined) {
    and.push({ isActive: params.isActive });
  }

  if (params.q) {
    and.push({
      OR: [
        { name: { contains: params.q, mode: "insensitive" } },
        { code: { contains: params.q, mode: "insensitive" } },
        { tcgdexId: { contains: params.q, mode: "insensitive" } },
        { series: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

export function parseSetListParams(searchParams: URLSearchParams): {
  q?: string;
  isActive: boolean;
  page: number;
  pageSize: number;
} {
  return {
    q: searchParams.get("q")?.trim() || undefined,
    isActive: parseBoolean(searchParams.get("isActive")) ?? true,
    page: parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE, "page"),
    pageSize: parsePositiveInt(
      searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      "pageSize",
      MAX_PAGE_SIZE,
    ),
  };
}
