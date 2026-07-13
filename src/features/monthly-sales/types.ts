// src/features/monthly-sales/types.ts
//
// UI-09b 月次売上レポート画面の型定義。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.2

import type { MonthlySaleItem, SalesMode } from "@/lib/bindings";

export type SortColumn = "name" | "quantity" | "amount" | "prev_month_diff";
export type SortDirection = "asc" | "desc";

/// 表示モード（bindings の SalesMode と同値、UI 内部別名）
export type SalesViewMode = SalesMode;

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
