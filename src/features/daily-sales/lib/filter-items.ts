// src/features/daily-sales/lib/filter-items.ts
//
// 部門フィルタ純関数。deptId === null は恒等関数（全部門表示）。
// 設計: docs/function-design/56-ui-daily-sales.md §56.6

import type { DailySaleItem } from "@/lib/bindings";

export function filterItemsByDepartment(
  items: DailySaleItem[],
  deptId: number | null,
): DailySaleItem[] {
  if (deptId === null) return items;
  return items.filter((i) => i.department_id === deptId);
}
