// src/features/csv-import/components/ParseStep.tsx
//
// Step 1/3: ファイル選択 or 解析中。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.4 / §55.6

import { Loader2 } from "lucide-react";
import { FileDropzone } from "./FileDropzone";

export interface ParseStepProps {
  isParsing: boolean;
  onFileSelect: (file: File) => void;
}

/// parsing 中は spinner + 状態文言、それ以外は FileDropzone を表示。
/// 設計: 55-ui-csv-import.md §55.6 Spinner 戦略 (parsing は 1-3 秒目安、Skeleton 不使用)。
export function ParseStep({ isParsing, onFileSelect }: ParseStepProps) {
  if (isParsing) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border p-12"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">ファイルを解析中…</p>
        <p className="text-xs text-muted-foreground">数百行で約 1-3 秒かかります</p>
      </div>
    );
  }
  return <FileDropzone onFileSelect={onFileSelect} />;
}
