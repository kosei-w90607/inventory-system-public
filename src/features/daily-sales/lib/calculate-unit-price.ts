// src/features/daily-sales/lib/calculate-unit-price.ts
//
// 実績単価派生計算純関数（user Option 1.5、Round 2 β-2 採用）。
// 設計: docs/function-design/56-ui-daily-sales.md §56.10 単価派生

import type { DailySaleItem } from "@/lib/bindings";

/// 売上明細の実績単価を計算する。
///
/// 商品マスタの販売単価ではなく、売上記録の金額 ÷ 数量で求めた派生値。
/// 返品行（quantity<0 + amount<0）では絶対値で「単価の大きさ」として正数表示。
/// quantity=0 の場合は null（表示側で「—」placeholder + ソート時末尾配置）。
/// 端数は四捨五入で整数円表示（Math.round）。
export function calculateEffectiveUnitPrice(item: DailySaleItem): number | null {
  if (item.quantity === 0) return null;
  return Math.round(Math.abs(item.amount) / Math.abs(item.quantity));
}
