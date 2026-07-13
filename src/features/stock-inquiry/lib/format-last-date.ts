// src/features/stock-inquiry/lib/format-last-date.ts
//
// 最終入庫日 / 最終販売日の表示文字列を生成する純関数（None → 「—」、Q-2）。
// UI-09a「比較不可」/ UI-09b「—」と表記一貫。
//
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6 / §58.12

/**
 * `string | null` を表示文字列に変換する。
 *
 * - null → 「—」（None 表示、Q-2）
 * - 値あり → そのまま返す（`YYYY-MM-DD`、DB_DESIGN.md 日付書式規約）
 */
export function formatLastDate(value: string | null): string {
  if (value === null || value === "") {
    return "—";
  }
  return value;
}
