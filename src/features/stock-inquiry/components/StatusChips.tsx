// src/features/stock-inquiry/components/StatusChips.tsx
//
// 状態フィルタチップ（すべて / 在庫切れ / 在庫少）。件数バッジなし（Q-5）。
// shadcn ToggleGroup（type="single"）でラジオ的に 1 つ選択。
// 選択中は中庸 stone tone + 太字で、在庫状態色（rose/amber）と衝突しない形にする。
// primitive 既定の bg-accent を usage 側 className で上書き、toggle.tsx は触らない。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SELECTION_TONE_CHIP_ON } from "@/components/ui/selection-tone";
import { STOCK_FILTER_DESCRIPTORS, type ListChipFilter } from "../types";

export interface StatusChipsProps {
  value: ListChipFilter;
  onChange: (next: ListChipFilter) => void;
}

export function StatusChips({ value, onChange }: StatusChipsProps) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={value}
      onValueChange={(next) => {
        // deselect（空文字）は無視し、常に 1 つ選択を維持
        const filter = STOCK_FILTER_DESCRIPTORS.find(({ value }) => value === next)?.value;
        if (filter !== undefined) {
          onChange(filter);
        }
      }}
      aria-label="在庫状態フィルタ"
    >
      {STOCK_FILTER_DESCRIPTORS.map((chip) => (
        <ToggleGroupItem
          key={chip.value}
          value={chip.value}
          aria-label={chip.label}
          className={SELECTION_TONE_CHIP_ON}
        >
          {chip.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
