// src/features/stock-inquiry/lib/test-fixtures.ts
//
// Vitest 用 factory（DRY）。DTO（ProductWithRelations）+ 詳細（StockDetail）を生成。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6

import type { ProductWithRelations, StockDetail } from "@/lib/bindings";

/** ProductWithRelations の factory。Product フィールドは flatten でトップレベル。 */
export function makeMockProductWithRelations(
  overrides: Partial<ProductWithRelations> = {},
): ProductWithRelations {
  return {
    product_code: "P-0001",
    jan_code: "4901234567890",
    name: "テスト商品",
    department_id: 1,
    supplier_id: null,
    selling_price: 500,
    cost_price: 300,
    tax_rate: "10",
    maker_code: null,
    stock_quantity: 10,
    stock_unit: "pcs",
    is_discontinued: false,
    plu_dirty: false,
    plu_exported_at: null,
    plu_target: false,
    pos_stock_sync: true,
    created_at: "2026-01-01T10:00:00",
    updated_at: "2026-01-01T10:00:00",
    department_name: "毛糸",
    supplier_name: null,
    ...overrides,
  };
}

/** StockDetail の factory。product は named field（flatten ではない）。 */
export function makeMockStockDetail(overrides: Partial<StockDetail> = {}): StockDetail {
  return {
    product: makeMockProductWithRelations(),
    last_receiving_date: "2026-03-20",
    last_sale_date: "2026-03-22",
    ...overrides,
  };
}
