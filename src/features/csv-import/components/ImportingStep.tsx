// src/features/csv-import/components/ImportingStep.tsx
//
// Step 3/3 進行中: commit 中の spinner + 補助文言 + 離脱不可バナー。
// useBlocker は useCsvImportFlow.ts で常時 block 登録済 (§55.7)、本 component は視覚バナーのみ。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.6 / §55.7

import { Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface ImportingStepProps {
  filename: string;
}

export function ImportingStep({ filename }: ImportingStepProps) {
  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg border p-12"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">取込み中…</p>
        <p className="text-xs text-muted-foreground">
          数百行で約 1-3 秒、数千行で約 5-10 秒かかります
        </p>
        <p className="text-xs text-muted-foreground">({filename})</p>
      </div>
      <Alert variant="destructive">
        <AlertTitle>取込み完了まで他画面に移れません</AlertTitle>
        <AlertDescription>
          取込み中は Sidebar
          の他リンクやブラウザバックが無効化されます。完了まで数秒お待ちください。
        </AlertDescription>
      </Alert>
    </div>
  );
}
