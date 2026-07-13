// src/features/csv-import/components/PreviewStep.tsx
//
// Step 2/3: プレビュー確認 + 取込み / 選び直し CTA + OverwriteConfirmDialog 連動。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.4 step 6-10 / §55.5

import { useRef, useState, type ChangeEvent } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewData } from "@/lib/bindings";
import { ErrorRowsTable } from "./ErrorRowsTable";
import { OverwriteConfirmDialog } from "./OverwriteConfirmDialog";

export interface PreviewStepProps {
  preview: PreviewData;
  filename: string;
  onConfirm: (overwriteConfirmed: boolean) => void;
  onReselect: (file: File) => void;
  isImporting: boolean;
}

export function PreviewStep({
  preview,
  filename,
  onConfirm,
  onReselect,
  isImporting,
}: PreviewStepProps) {
  const { file_info, matched_summary, error_summary, duplicate_check } = preview;
  const [dialogOpen, setDialogOpen] = useState(false);
  const reselectInputRef = useRef<HTMLInputElement>(null);

  const requiresOverwriteConfirm = duplicate_check.status === "OverwriteRequired";

  function handleImportClick() {
    if (requiresOverwriteConfirm) {
      setDialogOpen(true);
      return;
    }
    onConfirm(false);
  }

  function handleOverwriteConfirm() {
    setDialogOpen(false);
    onConfirm(true);
  }

  function handleReselectClick() {
    reselectInputRef.current?.click();
  }

  function handleReselectChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onReselect(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ファイル情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">精算日: </span>
            <span className="font-medium">{file_info.settlement_date}</span>
          </div>
          <div>
            <span className="text-muted-foreground">元ファイル名: </span>
            <span>{filename}</span>
          </div>
          <div>
            <span className="text-muted-foreground">ファイル hash: </span>
            <code className="text-xs">{file_info.file_hash.slice(0, 8)}…</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>紐付け結果</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            紐付け成功:{" "}
            <span className="font-medium">{matched_summary.count.toLocaleString()}</span> 件
          </div>
          <div>
            合計金額:{" "}
            <span className="font-medium">¥{matched_summary.total_amount.toLocaleString()}</span>
          </div>
          {matched_summary.warnings.length > 0 && (
            <Alert>
              <AlertTitle>警告 {matched_summary.warnings.length} 件</AlertTitle>
              <AlertDescription>
                <ul className="ml-4 list-disc">
                  {matched_summary.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {error_summary.count > 0 && <ErrorRowsTable errorSummary={error_summary} />}

      {requiresOverwriteConfirm && (
        <Alert variant="destructive">
          <AlertTitle>同じ精算日の取込み履歴があります</AlertTitle>
          <AlertDescription>
            既存の取込み (ID: {duplicate_check.existing_import_id ?? "—"})
            を上書きするには「取り込む」を押し、表示される確認ダイアログで承認してください。
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleImportClick} disabled={isImporting}>
          取り込む
        </Button>
        <Button variant="outline" onClick={handleReselectClick} disabled={isImporting}>
          ファイルを選び直す
        </Button>
        <input
          ref={reselectInputRef}
          type="file"
          accept=".csv,.txt"
          className="sr-only"
          onChange={handleReselectChange}
        />
      </div>

      <OverwriteConfirmDialog
        open={dialogOpen}
        existingImportId={duplicate_check.existing_import_id}
        onConfirm={handleOverwriteConfirm}
        onCancel={() => {
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
