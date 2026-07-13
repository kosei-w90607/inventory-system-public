// src/features/monthly-sales/lib/pick-top-ranking.ts
//
// 上位 10 抽出（BIZ-05 row_number 同順位なし前提）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.6 pick-top-ranking

import type { ComparisonInfo, MonthlySaleItem, ProductRankingRow } from "../types";

const TOP_RANKING_LIMIT = 10;

/// BIZ-05 が ranking フィールドに 1-based row_number を入れて返す（同順位なし前提）。
/// 上位 10 件を抽出 + ranking 昇順で並べる + comparisonMap から prev_month_diff を充填。
export function pickTopRanking(
  items: readonly MonthlySaleItem[],
  comparisonMap?: ReadonlyMap<string, ComparisonInfo>,
): ProductRankingRow[] {
  return items
    .filter((item) => item.ranking >= 1 && item.ranking <= TOP_RANKING_LIMIT)
    .slice()
    .sort((a, b) => a.ranking - b.ranking)
    .map((item) => {
      const info = comparisonMap?.get(item.key);
      const prevDiff = info?.isComparable ? info.diff : null;
      return {
        key: item.key,
        label: item.label,
        quantity: item.quantity,
        amount: item.amount,
        ranking: item.ranking,
        prev_month_diff: prevDiff,
      };
    });
}
