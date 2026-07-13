// src/features/home/types.ts
//
// UI-00 ホーム画面のローカル型定義。
// 設計: docs/function-design/53-ui-home.md §53.1 / §53.2

import type { UseQueryResult } from "@tanstack/react-query";
import type {
  CsvImport,
  DailySalesReport,
  PaginatedResult,
  ProductResponse,
  ProductWithRelations,
} from "@/lib/bindings";

/// useHomeSummary が返す 4 useQuery の result object 型。
/// D-3「独立 useQuery × 4」採用。1 件失敗しても他 3 件は継続。
export interface HomeSummaryQueries {
  sales: UseQueryResult<DailySalesReport>;
  lowStock: UseQueryResult<ProductWithRelations[]>;
  pluDirty: UseQueryResult<ProductResponse[]>;
  csvImports: UseQueryResult<PaginatedResult<CsvImport>>;
}

/// useHomeSummary 内で計算する派生値。
/// 53-ui-home.md §53.2 派生値表参照。
export interface HomeSummaryDerived {
  yesterdayLabel: string;
  outOfStockCount: number;
  lowStockCount: number;
  pluDirtyCount: number;
  lastImportSettlementDate: string | null;
  needsImportWarning: boolean;
}

/// useHomeSummary の戻り値型。
export type HomeSummaryState = HomeSummaryQueries & {
  derived: HomeSummaryDerived;
};
