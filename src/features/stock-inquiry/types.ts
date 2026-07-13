// src/features/stock-inquiry/types.ts
//
// UI-06a 在庫照会の feature 内型定義。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.2 / §58.5

import type { ProductWithRelations } from "@/lib/bindings";

/** 在庫状態表示用。閾値判定は持たず、source + stock_quantity から派生する。 */
export type StockStatus = "ok" | "low" | "stockout";

/** 状態チップのフィルタ値（URL state `status`）。 */
export type ListChipFilter = "all" | "stockout" | "low_stock";

/**
 * list query の戻り値正規化型。
 *
 * `search_products` は `PaginatedResult<T>`、`list_low_stock` は `T[]` で形状が
 * 異なるため、hook 内でこの型に正規化する（§58.5 Round 6 P2(a)）。
 * 自動展開 / EmptySearchPlaceholder 判定 / TruncatedResultsAlert は常に
 * `items` / `truncated` を参照する（生 DTO 直接参照禁止、type narrowing 維持）。
 */
export interface StockInquiryListResult {
  items: ProductWithRelations[];
  /** source="search" 時は total_count、source="low_stock" 時は null。 */
  totalCount: number | null;
  source: "search" | "low_stock";
  /** source="search" かつ total_count > items.length。pagination UI は Phase 2 非実装。 */
  truncated: boolean;
}

/** 部門フィルタの選択肢（UI-06a 用ローカル再定義、daily-sales 横依存禁止）。 */
export interface DepartmentOption {
  id: number;
  name: string;
}

/** URL search params（zod 4 validateSearch で検証）。 */
export interface StockInquirySearch {
  q?: string;
  dept?: number;
  status?: ListChipFilter;
  selected?: string;
}
