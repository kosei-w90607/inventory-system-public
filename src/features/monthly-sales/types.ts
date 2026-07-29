// src/features/monthly-sales/types.ts
//
// UI-09b 月次売上レポート画面の型定義。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.2

import type { MonthlySaleItem, SalesMode } from "@/lib/bindings";
import { z } from "zod";

export const MONTHLY_MODE_DESCRIPTORS = [
  { value: "by_product", label: "商品別ランキング" },
  { value: "by_department", label: "部門別構成比" },
] as const satisfies readonly { value: SalesMode; label: string }[];
export const MONTHLY_SORT_DESCRIPTORS = [
  {
    value: "name",
    productLabel: "商品名",
    departmentLabel: "部門",
    align: "left",
    modes: ["by_product", "by_department"],
  },
  {
    value: "quantity",
    productLabel: "数量",
    departmentLabel: null,
    align: "right",
    modes: ["by_product"],
  },
  {
    value: "amount",
    productLabel: "金額",
    departmentLabel: "売上",
    align: "right",
    modes: ["by_product", "by_department"],
  },
  {
    value: "prev_month_diff",
    productLabel: "前月比",
    departmentLabel: "前月比",
    align: "right",
    modes: ["by_product", "by_department"],
  },
] as const satisfies readonly {
  value: string;
  productLabel: string;
  departmentLabel: string | null;
  align: "left" | "right";
  modes: readonly SalesMode[];
}[];
export const MONTHLY_SORT_DIRECTION_OPTIONS = [
  { value: "asc", label: "昇順" },
  { value: "desc", label: "降順" },
] as const;

export type SortColumn = (typeof MONTHLY_SORT_DESCRIPTORS)[number]["value"];
export type SortDirection = (typeof MONTHLY_SORT_DIRECTION_OPTIONS)[number]["value"];
export type SalesViewMode = (typeof MONTHLY_MODE_DESCRIPTORS)[number]["value"];

function descriptorValues<
  const T extends readonly [{ readonly value: string }, ...{ readonly value: string }[]],
>(descriptors: T): { [K in keyof T]: T[K]["value"] } {
  return descriptors.map(({ value }) => value) as { [K in keyof T]: T[K]["value"] };
}

const MONTHLY_MODE_VALUES = descriptorValues(MONTHLY_MODE_DESCRIPTORS);
const MONTHLY_SORT_VALUES = descriptorValues(MONTHLY_SORT_DESCRIPTORS);
const MONTHLY_SORT_DIRECTION_VALUES = descriptorValues(MONTHLY_SORT_DIRECTION_OPTIONS);

export const monthlySalesSearchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  mode: z.enum(MONTHLY_MODE_VALUES).optional().catch(undefined),
  sortBy: z.enum(MONTHLY_SORT_VALUES).optional().catch(undefined),
  sortDir: z.enum(MONTHLY_SORT_DIRECTION_VALUES).optional().catch(undefined),
});

export type MonthlySalesSearch = z.output<typeof monthlySalesSearchSchema>;

export function monthlySortDescriptorsForMode(mode: SalesViewMode) {
  return MONTHLY_SORT_DESCRIPTORS.filter((descriptor) =>
    (descriptor.modes as readonly SalesViewMode[]).includes(mode),
  ).flatMap((descriptor) => {
    const label = mode === "by_product" ? descriptor.productLabel : descriptor.departmentLabel;
    return label === null ? [] : [{ value: descriptor.value, label, align: descriptor.align }];
  });
}

/// 商品ランキングテーブル行（UI 派生型）。
/// BIZ-05 row_number 由来の ranking + 前月比 diff を併せ持つ。
export interface ProductRankingRow {
  key: string;
  label: string;
  quantity: number;
  amount: number;
  ranking: number;
  prev_month_diff: number | null;
}

/// 部門別構成比テーブル行（UI 派生型）。
/// 構成比 (ratio) と前月比 diff を併せ持つ。
export interface DeptCompositionRow {
  key: string;
  label: string;
  amount: number;
  ratio: number;
  prev_month_diff: number | null;
}

/// 前月比比較情報（compute-comparison が key ごとに返す）。
/// `isComparable === false` で「比較不可」灰「—」表示（Q-7 ガード適用後）。
export interface ComparisonInfo {
  prevAmount: number | null;
  diff: number | null;
  ratio: number | null;
  isComparable: boolean;
}

/// 月次サマリ（4 カード描画用）
export interface MonthlySummary {
  totalAmount: number;
  totalQuantity: number;
}

/// MonthlySaleItem を再 export（UI 側 import 簡略化）
export type { MonthlySaleItem };
