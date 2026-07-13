// src/features/stock-inquiry/lib/derive-stock-state.ts
//
// 在庫状態を派生する純関数。
// 高視認性表示契約 H（§58.10、SCREEN_DESIGN.md §6）に従う。
// frontend は閾値を保持しない（Q-1 + Round 4 P2-3 で 2 重確定、drift 源排除）。
//
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6

import type { ProductWithRelations } from "@/lib/bindings";
import type { StockStatus } from "../types";

/**
 * 在庫状態を派生する。
 *
 * - source="search"（search_products 由来）: stock_quantity > 0 は "ok"。
 *   stock_quantity <= 0 のみ "stockout" として明示する。
 * - source="low_stock"（list_low_stock 由来、BIZ 判定済み集合）: stock_quantity > 0 は
 *   在庫少（"low"）、stock_quantity <= 0 は在庫切れ（"stockout"）。
 */
export function deriveStockState(
  item: ProductWithRelations,
  source: "search" | "low_stock",
): StockStatus {
  if (item.stock_quantity <= 0) {
    return "stockout";
  }
  // ここで stock_quantity > 0
  if (source === "search") {
    return "ok";
  }
  return "low";
}
