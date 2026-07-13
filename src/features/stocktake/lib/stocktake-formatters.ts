// src/features/stocktake/lib/stocktake-formatters.ts
//
// REQ-205 / UI-10-D10: 一覧の差異・最終カウント列の表示用純関数。

import type { StocktakeItemDetail } from "@/lib/bindings";

/**
 * 一覧の「差異」列を計算する。
 *
 * `update_count` の `current_difference`（35-biz-stocktake-service.md §20.4）と同一の
 * `current_stock - actual_count` を使う。未入力（`actual_count === null`）は計算不可のため null。
 */
export function computeListDifference(item: StocktakeItemDetail): number | null {
  if (item.actual_count === null) return null;
  return item.current_stock - item.actual_count;
}

/**
 * 差異を符号付き文字列にする（例: 3 → "+3"、-2 → "-2"、0 → "0"）。未入力は「—」。
 */
export function formatListDifference(difference: number | null): string {
  if (difference === null) return "—";
  if (difference > 0) return `+${String(difference)}`;
  return String(difference);
}

/**
 * 最終カウント日時を表示する。null は「—」、値ありは `T` 区切りをスペースに変換する
 * （`src/features/stock-movements/lib/movement-formatters.ts` の `formatMovementDateTime` と同じ変換）。
 */
export function formatCountedAt(value: string | null): string {
  if (value === null) return "—";
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(value);
  if (match) {
    return `${match[1]} ${match[2]}`;
  }
  return value;
}
