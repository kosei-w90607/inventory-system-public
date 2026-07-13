// src/features/stock-inquiry/lib/filter-low-stock-list.ts
//
// list_low_stock 結果の frontend sub-filter 純関数（§設計判断 C / Q-1）。
// stockout/low の分岐 + q（商品コード/商品名/JAN 部分一致）+ dept 絞り込み。
// list_low_stock 返り値は 100 件以下想定で frontend filter で高速。
//
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6

import type { ProductWithRelations } from "@/lib/bindings";

/**
 * list_low_stock 結果を status / q / dept で sub-filter する。
 *
 * @param items list_low_stock(false) の戻り値（廃番除外済み）
 * @param q     検索キーワード（空文字は無視）
 * @param dept  部門 ID（null は全部門）
 * @param status "stockout"（在庫切れ）または "low_stock"（在庫少）
 */
export function filterLowStockList(
  items: ProductWithRelations[],
  q: string,
  dept: number | null,
  status: "stockout" | "low_stock",
): ProductWithRelations[] {
  const keyword = q.trim().toLowerCase();
  return items.filter((item) => {
    // status 分岐: stockout = 在庫 0 以下、low_stock = 在庫あり
    if (status === "stockout" && item.stock_quantity > 0) {
      return false;
    }
    if (status === "low_stock" && item.stock_quantity <= 0) {
      return false;
    }
    // 部門絞り込み
    if (dept !== null && item.department_id !== dept) {
      return false;
    }
    // キーワード部分一致（商品コード / 商品名 / JAN）
    if (keyword !== "") {
      const haystack = [item.product_code, item.name, item.jan_code ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }
    return true;
  });
}
