// src/features/monthly-sales/components/ExportBar.tsx
//
// CSV 出力 button (active) + 印刷 button (aria-disabled + Tooltip)。
// memory feedback-radix-tooltip-aria-disabled.md 3 層パターン適用。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ExportBarProps {
  onExportCsv: () => void;
  isExporting: boolean;
}

export function ExportBar({ onExportCsv, isExporting }: ExportBarProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="default"
        onClick={onExportCsv}
        disabled={isExporting}
        aria-label="CSV を保存"
      >
        {isExporting ? "出力中..." : "CSV 出力"}
      </Button>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              aria-disabled="true"
              tabIndex={0}
              className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium opacity-60"
              onClick={(e) => {
                e.preventDefault();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                }
              }}
            >
              印刷
            </span>
          </TooltipTrigger>
          <TooltipContent>準備中（Phase 4 で実装予定）</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
