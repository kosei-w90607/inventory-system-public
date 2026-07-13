// src/features/stock-inquiry/lib/format-stock-display.ts
//
// 在庫数 + 単位の表示文字列を生成する純関数（Q-4 `"pcs"` / `"cm"` の 2 値 + fallback）。
// 生地は「300 cm」と単位付き表示（SCREEN_DESIGN.md L131）。
//
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6 / §58.12

/**
 * 在庫数を単位付き文字列に整形する。
 *
 * - unit="pcs" → 「10 個」
 * - unit="cm"  → 「300 cm」（生地）
 * - 上記以外（unexpected）→ 「—」（fallback、Q-4 網羅）
 */
export function formatStockDisplay(quantity: number, unit: string): string {
  switch (unit) {
    case "pcs":
      return `${String(quantity)} 個`;
    case "cm":
      return `${String(quantity)} cm`;
    default:
      return "—";
  }
}
