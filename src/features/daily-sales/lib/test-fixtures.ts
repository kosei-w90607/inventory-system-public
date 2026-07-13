// src/features/daily-sales/lib/test-fixtures.ts
//
// テスト用 factory helper。`DailySaleItem` 7 field 全必須を保証（bindings.ts 整合）。
// 設計: docs/function-design/56-ui-daily-sales.md §56.9

import type { DailySaleItem } from "@/lib/bindings";

export function makeMockItem(overrides: Partial<DailySaleItem> = {}): DailySaleItem {
  return {
    product_code: "P001",
    name: "商品A",
    department_name: "毛糸",
    department_id: 1,
    quantity: 1,
    amount: 100,
    source: "auto",
    ...overrides,
  };
}
