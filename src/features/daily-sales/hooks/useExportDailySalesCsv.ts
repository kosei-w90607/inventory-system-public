// src/features/daily-sales/hooks/useExportDailySalesCsv.ts
//
// UI-09a 日次売上 CSV エクスポート hook。
// 共通 `useExportFile` (8-7、src/lib/hooks/useExportFile.ts) の薄い wrapper。
// 設計: docs/function-design/56-ui-daily-sales.md §56.5 + 57-ui-monthly-sales.md §57.5 (Q-2 共通化)

import { useExportFile } from "@/lib/hooks/useExportFile";

export interface ExportDailyCsvArgs {
  date: string;
}

/// 日次売上 CSV を出力する。
/// 内部で `useExportFile({ reportType: "daily" })` を呼び出すだけ。
/// Sonner id は `export-daily-success/error` (PR #66 で `-csv-` セグメント削除、history reference は PR #65 当時)。
export function useExportDailySalesCsv() {
  const { exportFile, isExporting } = useExportFile();
  return {
    exportCsv: (args: ExportDailyCsvArgs) => {
      exportFile({ reportType: "daily", target: args.date });
    },
    isExporting,
  };
}
