// src/features/daily-sales/lib/group-items.ts
//
// 部門ごとの section（小計行を含む）にグルーピングする純関数。
// 設計: docs/function-design/56-ui-daily-sales.md §56.6

import type { DailySaleItem } from "@/lib/bindings";
import type { GroupedSection } from "../types";

/// 商品行を部門ごとに section 化し、各 section に小計を付与する。
/// 部門順は `department_id` 昇順固定（BIZ-05 順を尊重）。
/// 入力が空配列なら空配列を返す。
export function groupItemsByDepartment(items: DailySaleItem[]): GroupedSection[] {
  if (items.length === 0) return [];

  const groups = new Map<number, { name: string; items: DailySaleItem[] }>();
  for (const item of items) {
    const existing = groups.get(item.department_id);
    if (existing === undefined) {
      groups.set(item.department_id, { name: item.department_name, items: [item] });
    } else {
      existing.items.push(item);
    }
  }

  const sections: GroupedSection[] = [];
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => a - b);
  for (const id of sortedKeys) {
    const g = groups.get(id);
    if (g === undefined) continue;
    const subtotalQuantity = g.items.reduce((acc, i) => acc + i.quantity, 0);
    const subtotalAmount = g.items.reduce((acc, i) => acc + i.amount, 0);
    sections.push({
      departmentId: id,
      departmentName: g.name,
      items: g.items,
      subtotal: {
        department_id: id,
        department_name: g.name,
        quantity: subtotalQuantity,
        amount: subtotalAmount,
      },
    });
  }
  return sections;
}
