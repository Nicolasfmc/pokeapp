import { describe, expect, it } from "vitest";
import { selectAllocationsForDeck } from "../../server/services/allocation-select";

describe("transfer allocation reuse (§48)", () => {
  it("após liberar origem, destino cobre com o estoque liberado", () => {
    const beforeRelease = selectAllocationsForDeck(
      [{ logicalCardId: "x", quantity: 4 }],
      [
        {
          inventoryItemId: "item",
          logicalCardId: "x",
          freeQuantity: 0,
          collectionStatus: "COMPETITIVE",
          condition: "NM",
          language: "en",
          cardPrintingId: "p1",
        },
      ],
    );
    expect(beforeRelease.ok).toBe(false);

    const afterRelease = selectAllocationsForDeck(
      [{ logicalCardId: "x", quantity: 4 }],
      [
        {
          inventoryItemId: "item",
          logicalCardId: "x",
          freeQuantity: 4,
          collectionStatus: "COMPETITIVE",
          condition: "NM",
          language: "en",
          cardPrintingId: "p1",
        },
      ],
    );
    expect(afterRelease.ok).toBe(true);
    if (!afterRelease.ok) return;
    expect(afterRelease.picks).toEqual([
      { inventoryItemId: "item", quantity: 4 },
    ]);
  });
});
