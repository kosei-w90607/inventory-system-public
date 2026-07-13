// src/features/daily-sales/lib/sort-items.ts
//
// 商品行ソート純関数。5 列対応、`unit_price` 列は派生計算、null 行は末尾配置。
// 設計: docs/function-design/56-ui-daily-sales.md §56.6

import type { DailySaleItem } from "@/lib/bindings";
import type { SortColumn, SortDirection } from "../types";
import { calculateEffectiveUnitPrice } from "./calculate-unit-price";

/// 商品行を指定列・方向でソート。
/// `by === null` の場合は入力順を維持（BIZ-05 の department_id 昇順を尊重）。
/// 同値タイブレークは入力順保持（Array.prototype.sort の安定ソート性質）。
/// `unit_price` 列で quantity=0 の行は末尾配置（asc/desc 共通、user Option 1.5）。
export function sortDailyItems(
  items: DailySaleItem[],
  by: SortColumn | null,
  dir: SortDirection,
): DailySaleItem[] {
  if (by === null) return items.slice();

  const factor = dir === "asc" ? 1 : -1;
  const indexed = items.map((item, idx) => ({ item, idx }));

  indexed.sort((a, b) => {
    const av = extractValue(a.item, by);
    const bv = extractValue(b.item, by);

    // null は末尾配置（asc/desc 共通）
    if (av === null && bv === null) return a.idx - b.idx;
    if (av === null) return 1;
    if (bv === null) return -1;

    if (typeof av === "number" && typeof bv === "number") {
      const diff = av - bv;
      if (diff !== 0) return diff * factor;
    } else {
      const cmp = String(av).localeCompare(String(bv), "ja");
      if (cmp !== 0) return cmp * factor;
    }
    return a.idx - b.idx;
  });

  return indexed.map((x) => x.item);
}

function extractValue(item: DailySaleItem, by: SortColumn): string | number | null {
  switch (by) {
    case "product_code":
      return item.product_code;
    case "name":
      return item.name;
    case "quantity":
      return item.quantity;
    case "amount":
      return item.amount;
    case "unit_price":
      return calculateEffectiveUnitPrice(item);
  }
}
