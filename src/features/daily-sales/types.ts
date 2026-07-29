// src/features/daily-sales/types.ts
//
// UI-09a 日次売上レポート画面の型定義。
// 設計: docs/function-design/56-ui-daily-sales.md §56.2

import type { DailySaleItem, DeptSubtotal } from "@/lib/bindings";
import { z } from "zod";

export const DAILY_SORT_DESCRIPTORS = [
  { value: "product_code", label: "商品コード", align: "left" },
  { value: "name", label: "商品名", align: "left" },
  { value: "quantity", label: "数量", align: "right" },
  { value: "unit_price", label: "単価", align: "right" },
  { value: "amount", label: "金額", align: "right" },
] as const;
export const DAILY_SORT_DIRECTION_OPTIONS = [
  { value: "asc", label: "昇順" },
  { value: "desc", label: "降順" },
] as const;

export type SortColumn = (typeof DAILY_SORT_DESCRIPTORS)[number]["value"];
export type SortDirection = (typeof DAILY_SORT_DIRECTION_OPTIONS)[number]["value"];

function descriptorValues<
  const T extends readonly [{ readonly value: string }, ...{ readonly value: string }[]],
>(descriptors: T): { [K in keyof T]: T[K]["value"] } {
  return descriptors.map(({ value }) => value) as { [K in keyof T]: T[K]["value"] };
}

const DAILY_SORT_VALUES = descriptorValues(DAILY_SORT_DESCRIPTORS);
const DAILY_SORT_DIRECTION_VALUES = descriptorValues(DAILY_SORT_DIRECTION_OPTIONS);

export const dailySalesSearchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  dept: z.coerce.number().int().positive().optional().catch(undefined),
  sortBy: z.enum(DAILY_SORT_VALUES).optional().catch(undefined),
  sortDir: z.enum(DAILY_SORT_DIRECTION_VALUES).optional().catch(undefined),
});

export type DailySalesSearch = z.output<typeof dailySalesSearchSchema>;

/// 部門小計挿入済みの section（ProductTable 描画単位）
export interface GroupedSection {
  departmentId: number;
  departmentName: string;
  items: DailySaleItem[];
  subtotal: DeptSubtotal;
}

/// 売上明細数サマリ（user Option 1.5、items.length + source 別内訳）
export interface SalesLineSummary {
  total: number;
  autoCount: number;
  manualCount: number;
}

/// 部門フィルタ Select 用 option（hook 側で items から派生生成）
export interface DepartmentOption {
  id: number;
  name: string;
}
