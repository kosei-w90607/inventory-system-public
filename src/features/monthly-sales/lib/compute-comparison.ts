// src/features/monthly-sales/lib/compute-comparison.ts
//
// 前月比較 Map<key, ComparisonInfo> 生成（key 突合 + Q-7 prev_amount <= 0 ガード）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.6 compute-comparison

import type { ComparisonInfo, MonthlySaleItem } from "../types";

/// current items と prev items を key で突合し、key ごとの ComparisonInfo を Map で返す。
/// `prevItems === null` は specta `Option<Vec<T>>` 境界の defensive guard（通常 BIZ-05 は前月
/// データなしも `Some(空Vec)` を返す常時セット = `sales_service.rs:196-197`）、全件
/// `isComparable: false` の Map を返す。通常 path の `prevItems === []` は下の prevMap 作成に
/// fallthrough し、`prevMap.get(cur.key)` が undefined になるため各 current item に対して
/// 「前月に該当 key なし = 新規商品/部門」扱いで isComparable: false 同等の挙動になる。
///
/// Q-7 ガード（Z004 返品超過月対策）:
/// - `prev.amount === 0` → isComparable: false（除算ガード）
/// - `prev.amount < 0` → isComparable: false（色分け逆転回避、業務上比較困難）
export function computeMonthlyComparison(
  currentItems: readonly MonthlySaleItem[],
  prevItems: readonly MonthlySaleItem[] | null,
): Map<string, ComparisonInfo> {
  const map = new Map<string, ComparisonInfo>();

  if (prevItems === null) {
    for (const cur of currentItems) {
      map.set(cur.key, {
        prevAmount: null,
        diff: null,
        ratio: null,
        isComparable: false,
      });
    }
    return map;
  }

  const prevMap = new Map<string, MonthlySaleItem>();
  for (const p of prevItems) {
    prevMap.set(p.key, p);
  }

  for (const cur of currentItems) {
    const prev = prevMap.get(cur.key);
    if (prev === undefined) {
      // 前月に該当 key なし = 新規商品/部門。比較不可扱い。
      map.set(cur.key, {
        prevAmount: null,
        diff: null,
        ratio: null,
        isComparable: false,
      });
      continue;
    }
    // Q-7 ガード
    if (prev.amount <= 0) {
      map.set(cur.key, {
        prevAmount: prev.amount,
        diff: null,
        ratio: null,
        isComparable: false,
      });
      continue;
    }
    const diff = cur.amount - prev.amount;
    const ratio = diff / prev.amount;
    map.set(cur.key, {
      prevAmount: prev.amount,
      diff,
      ratio,
      isComparable: true,
    });
  }

  return map;
}
