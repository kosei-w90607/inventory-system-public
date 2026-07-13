// src/features/monthly-sales/hooks/useMonthlySalesReport.ts
//
// 1 useQuery + 派生 6 純関数 orchestration (Q-5)。
// BIZ-05 が当月 + 前月比較を 1 call で返す設計 (`prev_month_comparison: T[] | null` field)、
// UI-09a の 2 useQuery 機械的横展開は誤り (memory `feedback-design-doc-tech-premise-verify-from-output.md`)。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.5

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import type { MonthlySalesReport, SalesMode } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";

import { computeMonthlyComparison } from "../lib/compute-comparison";
import { computeDeptComposition } from "../lib/compute-composition";
import { computeMonthlySummary } from "../lib/compute-summary";
import { computePeriodLabel } from "../lib/compute-period-label";
import { pickTopRanking } from "../lib/pick-top-ranking";
import { sortMonthlyItems } from "../lib/sort-items";
import type {
  ComparisonInfo,
  DeptCompositionRow,
  MonthlySummary,
  ProductRankingRow,
  SortColumn,
  SortDirection,
} from "../types";

export interface UseMonthlySalesReportArgs {
  month: string;
  mode: SalesMode;
  sortBy: SortColumn | null;
  sortDir: SortDirection;
}

export interface MonthlyDerived {
  summary: MonthlySummary;
  periodLabel: string;
  comparisonMap: Map<string, ComparisonInfo>;
  ranking: ProductRankingRow[];
  composition: DeptCompositionRow[];
}

export interface UseMonthlySalesReportResult {
  query: UseQueryResult<MonthlySalesReport>;
  derived: MonthlyDerived | null;
}

/// 月次売上 1 useQuery + 派生 6 純関数 orchestration。
/// 売上は数十秒単位で動かないため staleTime 1min / gcTime 5min（UI-09b 固有、UI-09a の 5min より短め）。
export function useMonthlySalesReport(
  args: UseMonthlySalesReportArgs,
): UseMonthlySalesReportResult {
  const query = useQuery({
    queryKey: queryKeys.monthlySales(args.month, args.mode),
    queryFn: () =>
      unwrapResult(commands.getMonthlySales(args.month, args.mode), {
        source: "commands",
        cmd: "get_monthly_sales",
      }),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const derived = useMemo((): MonthlyDerived | null => {
    if (!query.data) return null;
    const { items, prev_month_comparison: prev } = query.data;
    const comparisonMap = computeMonthlyComparison(items, prev);
    // ranking / composition 双方に sort 適用 (Plan §2 commit 3 非対称根拠)。
    // raw items には適用しない: UI-09a (フラット → グルーピング) vs UI-09b (multi-derived)
    // の派生木差異に対応し、(a) ranking 順位列 ranking field 保持で badge 追従 (G-3、
    // sort-items.test.ts:79-90 検証済)、(b) composition 部門 sort 軸は ranking と独立。
    const rankingRaw = pickTopRanking(items, comparisonMap);
    const compositionRaw = computeDeptComposition(items, comparisonMap);
    return {
      summary: computeMonthlySummary(items),
      periodLabel: computePeriodLabel(args.month),
      comparisonMap,
      ranking: sortMonthlyItems(rankingRaw, args.sortBy, args.sortDir),
      composition: sortMonthlyItems(compositionRaw, args.sortBy, args.sortDir),
    };
  }, [query.data, args.month, args.sortBy, args.sortDir]);

  return { query, derived };
}
