// src/features/home/hooks/useHomeSummary.ts
//
// UI-00 ホーム画面の 4 useQuery 束ね + 派生値計算。
// 設計: docs/function-design/53-ui-home.md §53.2 / §53.3 / D-3 / D-8

import { useQuery } from "@tanstack/react-query";
import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import type { HomeSummaryState } from "../types";
import { countStockStatus } from "../lib/count-stock-status";
import { useYesterdayDate } from "./useYesterdayDate";

/// 4 useQuery を独立束ねし、派生値を計算して返す。
/// D-3: 1 件失敗しても他 3 件は継続 fetch（部分障害許容）。
export function useHomeSummary(): HomeSummaryState {
  const yesterday = useYesterdayDate();

  const sales = useQuery({
    queryKey: queryKeys.dailySales(yesterday),
    queryFn: () =>
      unwrapResult(commands.getDailySales(yesterday), {
        source: "commands",
        cmd: "get_daily_sales",
      }),
    staleTime: 5 * 60_000, // D-5: 昨日のデータは当日中不変
    gcTime: 10 * 60_000,
    enabled: true, // P2-C: useYesterdayDate は常に string、enabled 条件不要
  });

  const lowStock = useQuery({
    queryKey: queryKeys.lowStock(false),
    queryFn: () =>
      unwrapResult(commands.listLowStock(false), { source: "commands", cmd: "list_low_stock" }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    enabled: true,
  });

  const pluDirty = useQuery({
    queryKey: queryKeys.pluDirty(),
    queryFn: () =>
      unwrapResult(commands.listPluDirty(), { source: "commands", cmd: "list_plu_dirty" }),
    staleTime: 30_000, // D-5: PLU は商品編集直後の反映を早める
    gcTime: 5 * 60_000,
    enabled: true,
  });

  const csvImports = useQuery({
    queryKey: queryKeys.csvImports(1, 1),
    queryFn: () =>
      unwrapResult(commands.listCsvImports(1, 1), { source: "commands", cmd: "list_csv_imports" }),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    enabled: true,
  });

  // 派生値計算
  const stockCounts = lowStock.data
    ? countStockStatus(lowStock.data)
    : { outOfStock: 0, lowStock: 0 };
  const pluDirtyCount = pluDirty.data?.length ?? 0;
  const lastImportSettlementDate = csvImports.data?.items[0]?.settlement_date ?? null;
  const needsImportWarning =
    lastImportSettlementDate !== null && lastImportSettlementDate < yesterday;

  return {
    sales,
    lowStock,
    pluDirty,
    csvImports,
    derived: {
      yesterdayLabel: yesterday,
      outOfStockCount: stockCounts.outOfStock,
      lowStockCount: stockCounts.lowStock,
      pluDirtyCount,
      lastImportSettlementDate,
      needsImportWarning,
    },
  };
}
