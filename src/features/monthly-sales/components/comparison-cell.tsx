// src/features/monthly-sales/components/comparison-cell.tsx
//
// 前月比セル描画 helper（F-15 ±1.0% 閾値 + Q-7 prev <= 0 「—」灰）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7 + §57.10

import type { ComparisonInfo } from "../types";

const THRESHOLD = 0.01; // ±1.0%

const GREEN_CLASS = "bg-success-soft text-success";
const RED_CLASS = "bg-destructive-soft text-destructive";
const NEUTRAL_CLASS = "bg-stone-50 text-stone-600";
const INCOMPARABLE_CLASS = "bg-stone-50 text-stone-500";

const CELL_BASE = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";

export interface ComparisonCellProps {
  info: ComparisonInfo | undefined;
}

export function ComparisonCell({ info }: ComparisonCellProps) {
  if (!info || !info.isComparable || info.ratio === null) {
    return <span className={`${CELL_BASE} ${INCOMPARABLE_CLASS}`}>—</span>;
  }
  const colorClass =
    info.ratio >= THRESHOLD ? GREEN_CLASS : info.ratio <= -THRESHOLD ? RED_CLASS : NEUTRAL_CLASS;
  const sign = info.ratio >= 0 ? "+" : "";
  const pct = (info.ratio * 100).toFixed(1);
  return <span className={`${CELL_BASE} ${colorClass}`}>{`${sign}${pct}%`}</span>;
}
