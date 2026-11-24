import type {
  ExternalCard,
  ExternalCardCategory,
  ExternalSet,
  LogicalCardKey,
  TcgdexCardNormalizeInput,
  TcgdexSetNormalizeInput,
} from "./types";

const CATEGORY_MAP: Record<string, ExternalCardCategory> = {
  pokemon: "POKEMON",
  trainer: "TRAINER",
  energy: "ENERGY",
};

export function mapTcgdexCategory(raw: string): ExternalCardCategory {
  const mapped = CATEGORY_MAP[raw.trim().toLowerCase()];
  if (!mapped) {
    throw new Error(`Categoria TCGdex desconhecida: ${raw}`);
  }
  return mapped;
}

export function buildCardImageUrl(imageBase: string | null | undefined): string | null {
  if (!imageBase) {
    return null;
  }
  const trimmed = imageBase.replace(/\/+$/, "");
  if (/\.(webp|png|jpg|jpeg)$/i.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}/high.webp`;
}

/**
 * Identidade lógica (§12, §18). Energias básicas compartilham identidade:
 * a TCGdex nomeia algumas como "Basic Fire Energy" e outras como "Fire Energy";
 * ambas viram "Fire Energy".
 */
export function logicalCardKey(
  name: string,
  category: ExternalCardCategory,
  energyType?: string | null,
): LogicalCardKey {
  let canonicalName = name.trim().replace(/\s+/g, " ");
  if (
    category === "ENERGY" &&
    (energyType ?? "").trim().toLowerCase() === "normal"
  ) {
    canonicalName = canonicalName.replace(/^basic\s+/i, "");
  }
  return {
    canonicalName,
    category,
  };
}

export function normalizeSet(input: TcgdexSetNormalizeInput): ExternalSet {
  const code =
    input.abbreviation?.official?.trim() ||
    input.tcgOnline?.trim() ||
    null;

  return {
    tcgdexId: input.id,
    name: input.name,
    code,
    series: input.serie?.name?.trim() || null,
    seriesId: input.serie?.id?.trim() || null,
    releaseDate: input.releaseDate?.trim() || null,
    logoUrl: input.logo ?? null,
    symbolUrl: input.symbol ?? null,
  };
}

export function normalizeCard(input: TcgdexCardNormalizeInput): ExternalCard {
  const category = mapTcgdexCategory(input.category);

  return {
    tcgdexId: input.id,
    localId: String(input.localId),
    name: input.name,
    category,
    setTcgdexId: input.set.id,
    rarity: input.rarity ?? null,
    illustrator: input.illustrator ?? null,
    regulationMark: input.regulationMark ?? null,
    legalStandard: Boolean(input.legal?.standard),
    legalExpanded: Boolean(input.legal?.expanded),
    imageUrl: buildCardImageUrl(input.image),
    tcgdexUpdatedAt: input.updated ?? null,
    energyType: category === "ENERGY" ? (input.energyType ?? null) : null,
  };
}

export function parseReleaseDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function parseTcgdexUpdatedAt(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}
