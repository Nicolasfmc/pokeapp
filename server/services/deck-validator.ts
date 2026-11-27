import { prisma } from "@/server/database";
import type { CardCategory, CardLogical } from "@prisma/client";

export type DeckCardInput = {
  logicalCardId: string;
  quantity: number;
  category?: CardCategory;
  canonicalName?: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  logicalCardId?: string;
};

export type DeckValidationSummary = {
  totalCards: number;
  byCategory: Record<CardCategory, number>;
};

export type DeckValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: DeckValidationSummary;
};

type DeckSizeRule = { min?: number; max?: number };
type MaxCopiesRule = {
  default?: number;
  exceptions?: Record<string, number>;
  unlimited_canonical_names?: string[];
};
type LegalityRule = {
  field?: "legalStandard" | "legalExpanded";
};
type BannedRule = { logical_card_ids?: string[]; canonical_names?: string[] };
type RestrictedRule = Record<string, number>;

function asObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function emptySummary(): DeckValidationSummary {
  return {
    totalCards: 0,
    byCategory: {
      POKEMON: 0,
      TRAINER: 0,
      ENERGY: 0,
    },
  };
}

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isUnlimitedBasicEnergy(
  card: { category: CardCategory; canonicalName: string },
  rule: MaxCopiesRule,
): boolean {
  if (card.category !== "ENERGY") return false;
  const names = rule.unlimited_canonical_names ?? [];
  if (names.some((n) => normalizeName(n) === normalizeName(card.canonicalName))) {
    return true;
  }
  const n = normalizeName(card.canonicalName);
  return (
    n.includes("energy") &&
    (n.startsWith("basic ") ||
      /^[a-z]+ energy$/.test(n) ||
      n === "grass energy" ||
      n === "fire energy" ||
      n === "water energy" ||
      n === "lightning energy" ||
      n === "psychic energy" ||
      n === "fighting energy" ||
      n === "darkness energy" ||
      n === "metal energy" ||
      n === "fairy energy")
  );
}

async function loadLogicalCards(
  ids: string[],
): Promise<Map<string, Pick<CardLogical, "id" | "canonicalName" | "category">>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.cardLogical.findMany({
    where: { id: { in: ids } },
    select: { id: true, canonicalName: true, category: true },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

async function checkLegality(
  formatCode: string,
  cards: Array<{ logicalCardId: string; canonicalName: string }>,
  legalityRule: LegalityRule | null,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  if (cards.length === 0) return issues;

  let field = legalityRule?.field;
  if (!field) {
    const code = formatCode.toUpperCase();
    if (code === "STANDARD") field = "legalStandard";
    else if (code === "EXPANDED") field = "legalExpanded";
  }
  if (!field) return issues;

  const legalFilter =
    field === "legalStandard"
      ? { legalStandard: true }
      : { legalExpanded: true };

  for (const card of cards) {
    const legalPrinting = await prisma.cardPrinting.findFirst({
      where: {
        logicalCardId: card.logicalCardId,
        isActive: true,
        ...legalFilter,
      },
      select: { id: true },
    });
    if (!legalPrinting) {
      issues.push({
        code: "ILLEGAL_CARD",
        message: `"${card.canonicalName}" não é legal em ${formatCode}`,
        logicalCardId: card.logicalCardId,
      });
    }
  }

  return issues;
}

export async function validateDecklist(options: {
  formatId: string;
  cards: DeckCardInput[];
}): Promise<DeckValidationResult> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const summary = emptySummary();

  const format = await prisma.format.findUnique({
    where: { id: options.formatId },
    include: { rules: true },
  });

  if (!format || !format.isActive) {
    return {
      valid: false,
      errors: [
        {
          code: "FORMAT_NOT_FOUND",
          message: "Formato inválido ou inativo",
        },
      ],
      warnings,
      summary,
    };
  }

  const rulesByKey = new Map(format.rules.map((rule) => [rule.key, rule.value]));
  const logicalIds = [...new Set(options.cards.map((c) => c.logicalCardId))];
  const logicalMap = await loadLogicalCards(logicalIds);

  for (const card of options.cards) {
    if (!Number.isInteger(card.quantity) || card.quantity < 1) {
      errors.push({
        code: "INVALID_QUANTITY",
        message: "Quantidade deve ser um inteiro positivo",
        logicalCardId: card.logicalCardId,
      });
      continue;
    }

    const logical = logicalMap.get(card.logicalCardId);
    if (!logical) {
      errors.push({
        code: "UNKNOWN_LOGICAL_CARD",
        message: `Carta lógica não encontrada: ${card.logicalCardId}`,
        logicalCardId: card.logicalCardId,
      });
      continue;
    }

    summary.totalCards += card.quantity;
    summary.byCategory[logical.category] += card.quantity;
  }

  const deckSize = asObject(rulesByKey.get("deck_size")) as DeckSizeRule | null;
  if (deckSize) {
    const min = typeof deckSize.min === "number" ? deckSize.min : undefined;
    const max = typeof deckSize.max === "number" ? deckSize.max : undefined;
    if (min !== undefined && summary.totalCards < min) {
      errors.push({
        code: "DECK_TOO_SMALL",
        message: `Deck precisa de pelo menos ${min} cartas (atual: ${summary.totalCards})`,
      });
    }
    if (max !== undefined && summary.totalCards > max) {
      errors.push({
        code: "DECK_TOO_LARGE",
        message: `Deck pode ter no máximo ${max} cartas (atual: ${summary.totalCards})`,
      });
    }
  }

  const maxCopies = asObject(rulesByKey.get("max_copies")) as MaxCopiesRule | null;
  const defaultMax =
    typeof maxCopies?.default === "number" ? maxCopies.default : 4;
  const exceptions = maxCopies?.exceptions ?? {};

  // The copy limit counts by name: two different "Yveltal" cards (different
  // gameplay versions) share the same 4 copies.
  const byName = new Map<string, { name: string; quantity: number; logicalIds: string[] }>();
  for (const card of options.cards) {
    const logical = logicalMap.get(card.logicalCardId);
    if (!logical || !Number.isInteger(card.quantity) || card.quantity < 1) continue;

    if (
      maxCopies &&
      isUnlimitedBasicEnergy(
        { category: logical.category, canonicalName: logical.canonicalName },
        maxCopies,
      )
    ) {
      continue;
    }

    const key = normalizeName(logical.canonicalName);
    const group = byName.get(key) ?? { name: logical.canonicalName, quantity: 0, logicalIds: [] };
    group.quantity += card.quantity;
    group.logicalIds.push(card.logicalCardId);
    byName.set(key, group);
  }

  for (const group of byName.values()) {
    const exception = group.logicalIds.find((id) => typeof exceptions[id] === "number");
    const limit = exception ? exceptions[exception] : defaultMax;

    if (group.quantity > limit) {
      errors.push({
        code: "MAX_COPIES_EXCEEDED",
        message: `"${group.name}" permite no máximo ${limit} cópias (atual: ${group.quantity})`,
        logicalCardId: group.logicalIds[0],
      });
    }
  }

  const banned = asObject(rulesByKey.get("banned")) as BannedRule | null;
  if (banned) {
    const bannedIds = new Set(banned.logical_card_ids ?? []);
    const bannedNames = new Set(
      (banned.canonical_names ?? []).map((n) => normalizeName(n)),
    );
    for (const card of options.cards) {
      const logical = logicalMap.get(card.logicalCardId);
      if (!logical) continue;
      if (
        bannedIds.has(card.logicalCardId) ||
        bannedNames.has(normalizeName(logical.canonicalName))
      ) {
        errors.push({
          code: "BANNED_CARD",
          message: `"${logical.canonicalName}" é banida neste formato`,
          logicalCardId: card.logicalCardId,
        });
      }
    }
  }

  const restrictedRaw = asObject(rulesByKey.get("restricted"));
  if (restrictedRaw) {
    const restricted = restrictedRaw as RestrictedRule;
    for (const card of options.cards) {
      const logical = logicalMap.get(card.logicalCardId);
      if (!logical) continue;
      const limit = restricted[card.logicalCardId];
      if (typeof limit === "number" && card.quantity > limit) {
        errors.push({
          code: "RESTRICTED_CARD",
          message: `"${logical.canonicalName}" é restrita a ${limit} cópia(s)`,
          logicalCardId: card.logicalCardId,
        });
      }
    }
  }

  const legality = asObject(rulesByKey.get("legality")) as LegalityRule | null;
  const legalityCards = options.cards
    .map((card) => {
      const logical = logicalMap.get(card.logicalCardId);
      if (!logical) return null;
      return {
        logicalCardId: card.logicalCardId,
        canonicalName: logical.canonicalName,
      };
    })
    .filter((c): c is { logicalCardId: string; canonicalName: string } => c !== null);

  const legalityIssues = await checkLegality(format.code, legalityCards, legality);
  errors.push(...legalityIssues);

  if (summary.totalCards === 0) {
    warnings.push({
      code: "EMPTY_DECK",
      message: "Deck sem cartas",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary,
  };
}
