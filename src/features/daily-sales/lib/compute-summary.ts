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
    switch (item.source) {
      case "auto":
        autoCount += 1;
        break;
      case "manual":
        manualCount += 1;
        break;
      default: {
        const exhaustive: never = item.source;
        return exhaustive;
      }
    }
  }
  return { total: items.length, autoCount, manualCount };
}
