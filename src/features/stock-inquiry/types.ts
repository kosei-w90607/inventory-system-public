// src/features/stock-inquiry/types.ts
//
// UI-06a 在庫照会の feature 内型定義。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.2 / §58.5

import type { ProductWithRelations } from "@/lib/bindings";
import { z } from "zod";

/** 在庫状態表示用。閾値判定は持たず、source + stock_quantity から派生する。 */
export type StockStatus = "ok" | "low" | "stockout";

export const LOW_STOCK_FILTER = "low_stock" as const;
export const STOCK_FILTER_DESCRIPTORS = [
  { value: "all", label: "すべて" },
  { value: "stockout", label: "在庫切れ" },
  { value: LOW_STOCK_FILTER, label: "在庫少" },
] as const;

/** 状態チップのフィルタ値（URL state `status`）。 */
export type ListChipFilter = (typeof STOCK_FILTER_DESCRIPTORS)[number]["value"];

function descriptorValues<
  const T extends readonly [{ readonly value: string }, ...{ readonly value: string }[]],
>(descriptors: T): { [K in keyof T]: T[K]["value"] } {
  return descriptors.map(({ value }) => value) as { [K in keyof T]: T[K]["value"] };
}

const STOCK_FILTER_VALUES = descriptorValues(STOCK_FILTER_DESCRIPTORS);

export const stockInquirySearchSchema = z.object({
  q: z.string().min(1).max(100).optional().catch(undefined),
  dept: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(STOCK_FILTER_VALUES).optional().catch(undefined),
  selected: z.string().min(1).max(20).optional().catch(undefined),
});

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
export type StockInquirySearch = z.output<typeof stockInquirySearchSchema>;
