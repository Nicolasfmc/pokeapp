export type AvailabilityMetrics = {
  ownedQuantity: number;
  sleevedAllocatedQuantity: number;
  competitiveReserve: number;
  protectedQuantity: number;
  availableForTrade: number;
};

export function computeAvailability(
  ownedQuantity: number,
  sleevedAllocatedQuantity: number,
): AvailabilityMetrics {
  const owned = Math.max(0, ownedQuantity);
  const sleeved = Math.max(0, sleevedAllocatedQuantity);
  const competitiveReserve = Math.min(owned, 4);
  const protectedQuantity = Math.max(competitiveReserve, sleeved);
  const availableForTrade = Math.max(0, owned - protectedQuantity);

  return {
    ownedQuantity: owned,
    sleevedAllocatedQuantity: sleeved,
    competitiveReserve,
    protectedQuantity,
    availableForTrade,
  };
}
