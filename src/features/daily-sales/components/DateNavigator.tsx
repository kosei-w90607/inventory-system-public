// src/features/daily-sales/components/DateNavigator.tsx
//
// 前日 button + <input type="date"> + 翌日 button + 日本語日付ラベル。
// 設計: docs/function-design/56-ui-daily-sales.md §56.7

import { Button } from "@/components/ui/button";
import { addDays, formatJpDate } from "../lib/date-nav";

export interface DateNavigatorProps {
  date: string;
  onChange: (newDate: string) => void;
}

export function DateNavigator({ date, onChange }: DateNavigatorProps) {
  const label = formatJpDate(date);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onChange(addDays(date, -1));
        }}
        aria-label="前日"
      >
        前日
      </Button>
      <span className="min-w-[10rem] text-center text-sm font-medium" aria-live="polite">
        {label}
      </span>
      <input
        type="date"
        value={date}
        onChange={(e) => {
          if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
            onChange(e.target.value);
          }
        }}
        className="rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="日付を選択"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onChange(addDays(date, 1));
        }}
        aria-label="翌日"
      >
        翌日
      </Button>
    </div>
  );
}
