// src/lib/hooks/useExportFile.ts
//
// 売上 CSV エクスポート共通 hook (8-7、UI-09a/b 兼用)。
// useMutation + Blob ダウンロード + Sonner dedup を `SalesReportType` 引数化で共通化。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.5 useExportFile
//
// G-4: try/catch + downloadBlobFromBase64 を hook 内 private で閉じる
// H-5: `SalesReportType` を bindings.ts から import (specta 由来 literal union、drift 耐性)

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { commands } from "@/lib/bindings";
import type { SalesExportResponse, SalesReportType } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";

// Chromium download 中断回避のため revokeObjectURL を少し遅延させる (UI-09a 由来)
const REVOKE_DELAY_MS = 100;

const REPORT_LABEL: Record<SalesReportType, string> = {
  daily: "日次売上",
  monthly_by_product: "月次売上（商品別）",
  monthly_by_department: "月次売上（部門別）",
};

export interface ExportFileArgs {
  reportType: SalesReportType;
  target: string;
}

/// 売上 CSV を base64 → Blob で受け取り、`<a download>` 経由でダウンロード保存させる。
/// Sonner id は `export-${reportType}-success/error` で reportType ごとに dedup。
export function useExportFile() {
  const mutation = useMutation<SalesExportResponse, Error, ExportFileArgs>({
    mutationFn: ({ reportType, target }) =>
      unwrapResult(commands.exportSalesCsv(reportType, target), {
        source: "commands",
        cmd: "export_sales_csv",
      }),
    onSuccess: (data, args) => {
      try {
        downloadBlobFromBase64(data);
        toast.success(
          `${REPORT_LABEL[args.reportType]} を保存しました（${String(data.record_count)} 件）`,
          {
            id: `export-${args.reportType}-success`,
          },
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`出力に失敗しました: ${message}`, {
          id: `export-${args.reportType}-error`,
        });
      }
    },
    onError: (error, args) => {
      toast.error(`出力に失敗しました: ${error.message}`, {
        id: `export-${args.reportType}-error`,
      });
    },
  });

  return {
    exportFile: (args: ExportFileArgs) => {
      mutation.mutate(args);
    },
    isExporting: mutation.isPending,
  };
}

/// base64 → Uint8Array → Blob → `<a download>` click → 100ms 後に revokeObjectURL。
/// Rust 側 base64::engine::general_purpose::STANDARD は改行混入なし、atob 直 decode 安全。
function downloadBlobFromBase64(data: SalesExportResponse): void {
  const binary = atob(data.bytes_base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: data.content_type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.suggested_filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, REVOKE_DELAY_MS);
}
