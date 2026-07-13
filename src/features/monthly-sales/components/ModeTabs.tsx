// src/features/monthly-sales/components/ModeTabs.tsx
//
// mode 切替 segmented control（?mode=by_product|by_department）。URL state 駆動。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7

import { SegmentedControl, type SegmentedControlOption } from "@/components/ui/segmented-control";
import type { SalesViewMode } from "../types";

const modeOptions = [
  { value: "by_product", label: "商品別ランキング" },
  { value: "by_department", label: "部門別構成比" },
] satisfies readonly SegmentedControlOption<SalesViewMode>[];

export interface ModeTabsProps {
  mode: SalesViewMode;
  onChange: (newMode: SalesViewMode) => void;
}

export function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <SegmentedControl
      ariaLabel="月次売上表示切替"
      value={mode}
      options={modeOptions}
      onValueChange={onChange}
    />
  );
}
