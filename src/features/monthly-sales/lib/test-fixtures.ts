// src/features/monthly-sales/lib/test-fixtures.ts
//
// テスト用 factory helper (G-12)。
// - makeMockMonthlyItem: bindings.ts MonthlySaleItem 5 field 全必須を保証
// - makeMockProductRankingRow / makeMockDeptCompositionRow: UI 派生型 (prev_month_diff 含む)
// 設計: docs/function-design/57-ui-monthly-sales.md §57.6 factory 2 種類

import type { MonthlySaleItem } from "@/lib/bindings";
import type { DeptCompositionRow, ProductRankingRow } from "../types";

export function makeMockMonthlyItem(overrides: Partial<MonthlySaleItem> = {}): MonthlySaleItem {
  return {
    key: "P001",
    label: "商品A",
    quantity: 1,
    amount: 100,
    ranking: 1,
    ...overrides,
  };
}

export function makeMockProductRankingRow(
  overrides: Partial<ProductRankingRow> = {},
): ProductRankingRow {
  return {
    key: "P001",
    label: "商品A",
    quantity: 1,
    amount: 100,
    ranking: 1,
    prev_month_diff: null,
    ...overrides,
  };
}

export function makeMockDeptCompositionRow(
  overrides: Partial<DeptCompositionRow> = {},
): DeptCompositionRow {
  return {
    key: "1",
    label: "毛糸",
    amount: 1000,
    ratio: 0.5,
    prev_month_diff: null,
    ...overrides,
  };
}
