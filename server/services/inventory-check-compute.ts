/**
 * Inventory Check (§56–57). Lógica pura, sem banco, para teste unitário.
 *
 * Por carta lógica do deck:
 *  - owned: soma de TODAS as impressões compatíveis no Inventory (§57);
 *  - status: OWNED (owned >= required) | PARTIAL (0 < owned < required) | MISSING;
 *  - freeForDeck: owned menos o que está alocado a OUTROS decks Sleevados;
 *  - sourceDecks: decks Sleevados que seguram cópias (origem de transferência, §45).
 */

export type InventoryCheckStatus = "OWNED" | "PARTIAL" | "MISSING";

export type InventoryCheckRequirement = {
  logicalCardId: string;
  canonicalName: string;
  category: string;
  required: number;
  /** Imagem da impressão padrão (só exibição). */
  imageUrl?: string | null;
};

export type InventoryCheckLot = {
  logicalCardId: string;
  quantity: number;
  /** Alocações deste lote por deck. */
  allocations: Array<{ deckId: string; deckName: string; quantity: number }>;
};

export type InventoryCheckSourceDeck = {
  deckId: string;
  deckName: string;
  quantity: number;
};

export type InventoryCheckLine = InventoryCheckRequirement & {
  owned: number;
  allocatedToThisDeck: number;
  allocatedElsewhere: number;
  freeForDeck: number;
  status: InventoryCheckStatus;
  /** Faltam cópias livres para sleevar este deck sem transferência. */
  physicalShortage: number;
  sourceDecks: InventoryCheckSourceDeck[];
};

export type InventoryCheckSummary = {
  totalRequired: number;
  totalOwned: number;
  owned: number;
  partial: number;
  missing: number;
  /** Todas as cartas são possuídas (independente de alocação). */
  fullyOwned: boolean;
  /** Pode virar SLEEVED agora, sem transferência. */
  readyToSleeve: boolean;
  /** Cartas faltantes estão em outros decks Sleevados: transferência resolve. */
  resolvableByTransfer: boolean;
  /** Decks Sleevados que seguram cartas em falta (§45). */
  suggestedSourceDecks: InventoryCheckSourceDeck[];
};

export type InventoryCheckResult = {
  deckId: string;
  lines: InventoryCheckLine[];
  summary: InventoryCheckSummary;
};

export function statusFor(owned: number, required: number): InventoryCheckStatus {
  if (owned >= required) return "OWNED";
  if (owned > 0) return "PARTIAL";
  return "MISSING";
}

export function computeInventoryCheck(
  deckId: string,
  requirements: InventoryCheckRequirement[],
  lots: InventoryCheckLot[],
): InventoryCheckResult {
  const lotsByLogical = new Map<string, InventoryCheckLot[]>();
  for (const lot of lots) {
    const list = lotsByLogical.get(lot.logicalCardId) ?? [];
    list.push(lot);
    lotsByLogical.set(lot.logicalCardId, list);
  }

  const lines: InventoryCheckLine[] = requirements.map((req) => {
    const cardLots = lotsByLogical.get(req.logicalCardId) ?? [];
    let owned = 0;
    let allocatedToThisDeck = 0;
    let allocatedElsewhere = 0;
    const sources = new Map<string, InventoryCheckSourceDeck>();

    for (const lot of cardLots) {
      owned += lot.quantity;
      for (const alloc of lot.allocations) {
        if (alloc.deckId === deckId) {
          allocatedToThisDeck += alloc.quantity;
        } else {
          allocatedElsewhere += alloc.quantity;
          const existing = sources.get(alloc.deckId);
          if (existing) existing.quantity += alloc.quantity;
          else sources.set(alloc.deckId, { ...alloc });
        }
      }
    }

    const freeForDeck = Math.max(0, owned - allocatedElsewhere);
    return {
      ...req,
      owned,
      allocatedToThisDeck,
      allocatedElsewhere,
      freeForDeck,
      status: statusFor(owned, req.required),
      physicalShortage: Math.max(0, req.required - freeForDeck),
      sourceDecks: [...sources.values()].sort(
        (a, b) => b.quantity - a.quantity || a.deckName.localeCompare(b.deckName),
      ),
    };
  });

  const suggested = new Map<string, InventoryCheckSourceDeck>();
  for (const line of lines) {
    if (line.physicalShortage === 0) continue;
    for (const source of line.sourceDecks) {
      const existing = suggested.get(source.deckId);
      if (existing) existing.quantity += source.quantity;
      else suggested.set(source.deckId, { ...source });
    }
  }

  const fullyOwned = lines.every((line) => line.status === "OWNED");
  const readyToSleeve =
    lines.length > 0 && lines.every((line) => line.physicalShortage === 0);

  return {
    deckId,
    lines,
    summary: {
      totalRequired: lines.reduce((sum, l) => sum + l.required, 0),
      totalOwned: lines.reduce((sum, l) => sum + Math.min(l.owned, l.required), 0),
      owned: lines.filter((l) => l.status === "OWNED").length,
      partial: lines.filter((l) => l.status === "PARTIAL").length,
      missing: lines.filter((l) => l.status === "MISSING").length,
      fullyOwned,
      readyToSleeve,
      resolvableByTransfer: !readyToSleeve && fullyOwned && lines.length > 0,
      suggestedSourceDecks: [...suggested.values()].sort(
        (a, b) => b.quantity - a.quantity || a.deckName.localeCompare(b.deckName),
      ),
    },
  };
}
