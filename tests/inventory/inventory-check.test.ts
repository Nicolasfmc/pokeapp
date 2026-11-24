import { describe, expect, it } from "vitest";
import {
  computeInventoryCheck,
  statusFor,
} from "../../server/services/inventory-check-compute";

const poffin = {
  logicalCardId: "poffin",
  canonicalName: "Buddy-Buddy Poffin",
  category: "TRAINER",
  required: 4,
};
const dreepy = {
  logicalCardId: "dreepy",
  canonicalName: "Dreepy",
  category: "POKEMON",
  required: 4,
};

describe("statusFor (§56)", () => {
  it("OWNED / PARTIAL / MISSING", () => {
    expect(statusFor(4, 4)).toBe("OWNED");
    expect(statusFor(5, 4)).toBe("OWNED");
    expect(statusFor(2, 4)).toBe("PARTIAL");
    expect(statusFor(0, 4)).toBe("MISSING");
  });
});

describe("computeInventoryCheck", () => {
  it("soma impressões compatíveis da carta lógica (§57: 2 TEF + 3 PRE = 5 ≥ 4)", () => {
    const result = computeInventoryCheck("deck-c", [poffin], [
      { logicalCardId: "poffin", quantity: 2, allocations: [] },
      { logicalCardId: "poffin", quantity: 3, allocations: [] },
    ]);
    expect(result.lines[0].owned).toBe(5);
    expect(result.lines[0].status).toBe("OWNED");
    expect(result.summary.readyToSleeve).toBe(true);
  });

  it("identifica PARTIAL e MISSING", () => {
    const result = computeInventoryCheck("deck-c", [poffin, dreepy], [
      { logicalCardId: "poffin", quantity: 2, allocations: [] },
    ]);
    expect(result.lines.map((l) => l.status)).toEqual(["PARTIAL", "MISSING"]);
    expect(result.summary.partial).toBe(1);
    expect(result.summary.missing).toBe(1);
    expect(result.summary.fullyOwned).toBe(false);
    expect(result.summary.readyToSleeve).toBe(false);
    expect(result.summary.resolvableByTransfer).toBe(false);
  });

  it("cartas presas em outro deck Sleevado: possuídas, mas exigem transferência (§45)", () => {
    const result = computeInventoryCheck("deck-c", [poffin], [
      {
        logicalCardId: "poffin",
        quantity: 4,
        allocations: [{ deckId: "deck-a", deckName: "Deck A", quantity: 3 }],
      },
    ]);
    const line = result.lines[0];
    expect(line.status).toBe("OWNED");
    expect(line.freeForDeck).toBe(1);
    expect(line.physicalShortage).toBe(3);
    expect(line.sourceDecks).toEqual([
      { deckId: "deck-a", deckName: "Deck A", quantity: 3 },
    ]);
    expect(result.summary.readyToSleeve).toBe(false);
    expect(result.summary.resolvableByTransfer).toBe(true);
    expect(result.summary.suggestedSourceDecks[0].deckId).toBe("deck-a");
  });

  it("alocações do próprio deck não contam como falta", () => {
    const result = computeInventoryCheck("deck-a", [poffin], [
      {
        logicalCardId: "poffin",
        quantity: 4,
        allocations: [{ deckId: "deck-a", deckName: "Deck A", quantity: 4 }],
      },
    ]);
    expect(result.lines[0].allocatedToThisDeck).toBe(4);
    expect(result.lines[0].physicalShortage).toBe(0);
    expect(result.summary.readyToSleeve).toBe(true);
  });

  it("deck vazio não está pronto para sleevar", () => {
    const result = computeInventoryCheck("deck-x", [], []);
    expect(result.summary.readyToSleeve).toBe(false);
  });
});
