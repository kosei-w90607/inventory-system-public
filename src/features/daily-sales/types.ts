// src/features/daily-sales/types.ts
//
// UI-09a 日次売上レポート画面の型定義。
// 設計: docs/function-design/56-ui-daily-sales.md §56.2

import type { DailySaleItem, DeptSubtotal } from "@/lib/bindings";

export type SortColumn = "product_code" | "name" | "quantity" | "unit_price" | "amount";
export type SortDirection = "asc" | "desc";

/// 部門小計挿入済みの section（ProductTable 描画単位）
export interface GroupedSection {
  departmentId: number;
  departmentName: string;
  items: DailySaleItem[];
  subtotal: DeptSubtotal;
}

/// 売上明細数サマリ（user Option 1.5、items.length + source 別内訳）
export interface SalesLineSummary {
  total: number;
  autoCount: number;
  manualCount: number;
}

/// 部門フィルタ Select 用 option（hook 側で items から派生生成）
export interface DepartmentOption {
  id: number;
  name: string;
}
