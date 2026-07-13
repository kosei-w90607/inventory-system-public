// src/features/monthly-sales/lib/compute-summary.ts
//
// 月間売上合計 / 販売点数集計（純関数）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.6 compute-summary

import type { MonthlySaleItem, MonthlySummary } from "../types";

/// items から totalAmount / totalQuantity を集計する。
/// 空配列 → { totalAmount: 0, totalQuantity: 0 }。
/// 負数 amount（返品超過月）はそのまま合計する（業務判断は呼出側）。
export function computeMonthlySummary(items: readonly MonthlySaleItem[]): MonthlySummary {
  let totalAmount = 0;
  let totalQuantity = 0;
  for (const item of items) {
    totalAmount += item.amount;
    totalQuantity += item.quantity;
  }
  return { totalAmount, totalQuantity };
}
