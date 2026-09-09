import { describe, expect, it } from "vitest";
import { computeAvailability } from "../../server/services/availability-compute";

describe("computeAvailability", () => {
  it("5 owned, 0 sleeved → 1 trade", () => {
    expect(computeAvailability(5, 0)).toEqual({
      ownedQuantity: 5,
      sleevedAllocatedQuantity: 0,
      competitiveReserve: 4,
      protectedQuantity: 4,
      availableForTrade: 1,
    });
  });

  it("5 owned, 2 sleeved → protected 4, trade 1", () => {
    expect(computeAvailability(5, 2)).toEqual({
      ownedQuantity: 5,
      sleevedAllocatedQuantity: 2,
      competitiveReserve: 4,
      protectedQuantity: 4,
      availableForTrade: 1,
    });
  });

  it("10 owned, 6 sleeved → protected 6, trade 4", () => {
    expect(computeAvailability(10, 6)).toEqual({
      ownedQuantity: 10,
      sleevedAllocatedQuantity: 6,
      competitiveReserve: 4,
      protectedQuantity: 6,
      availableForTrade: 4,
    });
  });

  it("4 ou menos → trade 0", () => {
    expect(computeAvailability(4, 0).availableForTrade).toBe(0);
    expect(computeAvailability(2, 0).availableForTrade).toBe(0);
  });
});
