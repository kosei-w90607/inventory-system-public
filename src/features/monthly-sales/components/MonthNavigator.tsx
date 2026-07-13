// src/features/monthly-sales/components/MonthNavigator.tsx
//
// 前月 button + <input type="month"> + 翌月 button + 月ラベル。
// 未来月もガードなし（business: 月途中状態を見たい場合あり、F-11）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7

import { Button } from "@/components/ui/button";
import { formatMonthLabel, nextMonth, prevMonth } from "../lib/format-month-label";

export interface MonthNavigatorProps {
  month: string;
  onChange: (newMonth: string) => void;
}

export function MonthNavigator({ month, onChange }: MonthNavigatorProps) {
  const label = formatMonthLabel(month);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const prev = prevMonth(month);
          if (prev) onChange(prev);
        }}
        aria-label="前月"
      >
        前月
      </Button>
      <span className="min-w-[8rem] text-center text-sm font-medium" aria-live="polite">
        {label}
      </span>
      <input
        type="month"
        value={month}
        onChange={(e) => {
          if (/^\d{4}-\d{2}$/.test(e.target.value)) {
            onChange(e.target.value);
          }
        }}
        className="rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="月を選択"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          const next = nextMonth(month);
          if (next) onChange(next);
        }}
        aria-label="翌月"
      >
        翌月
      </Button>
    </div>
  );
}
