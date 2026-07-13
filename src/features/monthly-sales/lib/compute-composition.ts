// src/features/monthly-sales/lib/compute-composition.ts
//
// 部門別構成比 % 計算（grand_total === 0 ガード含む）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.6 compute-composition

import type { ComparisonInfo, DeptCompositionRow, MonthlySaleItem } from "../types";

/// items から構成比 row を生成する。
/// `grandTotal === 0` の場合は全件 `ratio: 0` を返す（除算ガード）。
///
/// `comparisonMap` を渡すと、各 row に `prev_month_diff` を充填する。
/// 未指定または `isComparable === false` の場合は `prev_month_diff: null`。
export function computeDeptComposition(
  items: readonly MonthlySaleItem[],
  comparisonMap?: ReadonlyMap<string, ComparisonInfo>,
): DeptCompositionRow[] {
  let grandTotal = 0;
  for (const item of items) {
    grandTotal += item.amount;
  }

  return items.map((item) => {
    const info = comparisonMap?.get(item.key);
    const prevDiff = info?.isComparable ? info.diff : null;
    return {
      key: item.key,
      label: item.label,
      amount: item.amount,
      ratio: grandTotal === 0 ? 0 : item.amount / grandTotal,
      prev_month_diff: prevDiff,
    };
  });
}
