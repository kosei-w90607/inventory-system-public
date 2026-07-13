// src/features/stock-movements/types.ts
//
// UI-06c 商品別在庫変動履歴の URL search / 表示型。
// 設計: docs/function-design/66-ui-stock-movements.md §66.3

export const MOVEMENT_TYPES = [
  "all",
  "receiving",
  "return",
  "sale_auto",
  "sale_manual",
  "disposal",
  "stocktake",
] as const;

export type MovementTypeFilter = (typeof MOVEMENT_TYPES)[number];

export interface StockMovementsSearch {
  dateFrom?: string;
  dateTo?: string;
  type?: MovementTypeFilter;
  page?: number;
}

export interface NormalizedStockMovementsSearch {
  dateFrom?: string;
  dateTo?: string;
  type: MovementTypeFilter;
  page: number;
}

export const MOVEMENTS_PER_PAGE = 20;

export const movementTypeOptions: readonly { value: MovementTypeFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "receiving", label: "入庫" },
  { value: "return", label: "返品・交換" },
  { value: "sale_auto", label: "POS売上" },
  { value: "sale_manual", label: "手動販売" },
  { value: "disposal", label: "廃棄・破損" },
  { value: "stocktake", label: "棚卸し" },
];

export function normalizeStockMovementsSearch(
  search: StockMovementsSearch,
): NormalizedStockMovementsSearch {
  return {
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
    type: search.type ?? "all",
    page: Math.max(1, search.page ?? 1),
  };
}
