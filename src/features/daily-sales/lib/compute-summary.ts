// src/features/daily-sales/lib/compute-summary.ts
//
// 売上明細数サマリ純関数（user Option 1.5、items.length + source 別内訳）。
// BIZ-05 で source 別集計未提供のため UI 派生（将来 BIZ 拡張で削除可能）。
// 設計: docs/function-design/56-ui-daily-sales.md §56.6

import type { DailySaleItem } from "@/lib/bindings";
import type { SalesLineSummary } from "../types";

export function computeSalesLineSummary(items: DailySaleItem[]): SalesLineSummary {
  let autoCount = 0;
  let manualCount = 0;
  for (const item of items) {
    // source は bindings.ts では string 型（"auto" | "manual" literal union 化は将来 D-10）
    if (item.source === "auto") autoCount += 1;
    else if (item.source === "manual") manualCount += 1;
    // 未知 source は total には含むが内訳には含めない（防御的設計）
  }
  return { total: items.length, autoCount, manualCount };
}
