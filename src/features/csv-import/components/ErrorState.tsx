// src/features/csv-import/components/ErrorState.tsx
//
// CsvImportState.error variant の表示。CmdError.kind 別固定文言 + recoverTo に応じた復帰ボタンラベル。
// 設計: docs/function-design/55-ui-csv-import.md §55.5 CmdError kind 別表示マトリクス

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CMD_ERROR_KIND, type InvokeError } from "@/lib/invoke";
import type { ErrorRecoverTo } from "../types";

export interface ErrorStateProps {
  error: InvokeError;
  recoverTo: ErrorRecoverTo;
  onDismiss: () => void;
}

/// kind 別固定文言 (§55.5):
/// - import_error → 「プレビューが利用できません」
/// - validation → 「入力に問題があります」
/// - その他 (internal / not_found 等) → 「エラーが発生しました」
function titleForKind(kind: string): string {
  switch (kind) {
    case CMD_ERROR_KIND.IMPORT_ERROR:
      return "プレビューが利用できません";
    case CMD_ERROR_KIND.VALIDATION:
      return "入力に問題があります";
    default:
      return "エラーが発生しました";
  }
}

export function ErrorState({ error, recoverTo, onDismiss }: ErrorStateProps) {
  const title = titleForKind(error.cmdError.kind);
  const buttonLabel = recoverTo === "preview" ? "プレビューに戻る" : "最初に戻る";

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{error.cmdError.message}</AlertDescription>
      </Alert>
      <Button onClick={onDismiss}>{buttonLabel}</Button>
    </div>
  );
}
