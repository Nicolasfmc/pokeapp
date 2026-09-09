export type { AvailabilityMetrics } from "@/server/services/availability-compute";
export { computeAvailability } from "@/server/services/availability-compute";
export {
  getLogicalAvailability,
  getPrintingAvailability,
  getLogicalAvailabilityMap,
} from "@/server/services/availability";
export type {
  InventoryItemView,
  InventoryTransactionView,
} from "@/server/services/inventory";
export {
  InventoryServiceError,
  listInventoryItems,
  getInventoryItem,
  addInventoryStock,
  adjustInventoryItem,
  listInventoryTransactions,
} from "@/server/services/inventory";
export { InventoryPanel } from "./InventoryPanel";
