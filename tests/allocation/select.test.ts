import { describe, expect, it } from "vitest";
import {
  compareLotsForAutoSelect,
  selectAllocationsForDeck,
  type SelectableInventoryLot,
} from "../../server/services/allocation-select";

function lot(
  partial: Partial<SelectableInventoryLot> &
    Pick<SelectableInventoryLot, "inventoryItemId" | "logicalCardId" | "freeQuantity">,
): SelectableInventoryLot {
  return {
    collectionStatus: "COMPETITIVE",
    condition: "NM",
    language: "en",
    cardPrintingId: `print-${partial.inventoryItemId}`,
    ...partial,
  };
}

describe("selectAllocationsForDeck", () => {
  it("escolhe impressões deterministicamente (TEF+PRE)", () => {
    const result = selectAllocationsForDeck(
      [{ logicalCardId: "poffin", quantity: 4 }],
      [
        lot({
          inventoryItemId: "tef",
          logicalCardId: "poffin",
          freeQuantity: 2,
          cardPrintingId: "tef-print",
        }),
        lot({
          inventoryItemId: "pre",
          logicalCardId: "poffin",
          freeQuantity: 3,
          cardPrintingId: "pre-print",
        }),
      ],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byId = Object.fromEntries(
      result.picks.map((p) => [p.inventoryItemId, p.quantity]),
    );
    expect(byId).toEqual({ pre: 3, tef: 1 });
    expect(Object.values(byId).reduce((a, b) => a + b, 0)).toBe(4);
  });

  it("prefere COMPETITIVE e condição melhor", () => {
    const a = lot({
      inventoryItemId: "dmg-col",
      logicalCardId: "x",
      freeQuantity: 4,
      collectionStatus: "COLLECTION",
      condition: "DMG",
    });
    const b = lot({
      inventoryItemId: "nm-comp",
      logicalCardId: "x",
      freeQuantity: 4,
      collectionStatus: "COMPETITIVE",
      condition: "NM",
    });
    expect(compareLotsForAutoSelect(b, a)).toBeLessThan(0);

    const result = selectAllocationsForDeck(
      [{ logicalCardId: "x", quantity: 2 }],
      [a, b],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.picks).toEqual([{ inventoryItemId: "nm-comp", quantity: 2 }]);
  });

  it("reporta shortage quando falta estoque livre", () => {
    const result = selectAllocationsForDeck(
      [
        { logicalCardId: "a", quantity: 4 },
        { logicalCardId: "b", quantity: 2 },
      ],
      [
        lot({
          inventoryItemId: "a1",
          logicalCardId: "a",
          freeQuantity: 3,
        }),
        lot({
          inventoryItemId: "b1",
          logicalCardId: "b",
          freeQuantity: 2,
        }),
      ],
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.shortages).toEqual([
      { logicalCardId: "a", required: 4, available: 3 },
    ]);
  });

  it("não usa o mesmo free quantity duas vezes", () => {
    const result = selectAllocationsForDeck(
      [{ logicalCardId: "a", quantity: 3 }],
      [
        lot({
          inventoryItemId: "only",
          logicalCardId: "a",
          freeQuantity: 2,
        }),
      ],
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.shortages[0]?.available).toBe(2);
  });
});
