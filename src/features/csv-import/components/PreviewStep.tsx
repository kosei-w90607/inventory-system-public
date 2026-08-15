// src/features/csv-import/components/PreviewStep.tsx
//
// Step 2/3: プレビュー確認 + 取込み / 選び直し CTA + 同日追加確認。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.4 step 6-10 / §55.5

import { useState } from "react";
import { FilePicker, type PickedFile } from "@/components/FilePicker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PreviewData } from "@/lib/bindings";
import { ErrorRowsTable } from "./ErrorRowsTable";
import { AdditionalImportConfirmDialog } from "./AdditionalImportConfirmDialog";

export interface PreviewStepProps {
  preview: PreviewData;
  filename: string;
  onConfirm: (additionalImportConfirmed: boolean) => void;
  onReselect: (file: PickedFile) => void;
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

  const requiresAdditionalConfirm =
    duplicate_check.status === "AdditionalImportConfirmationRequired";

  function handleImportClick() {
    if (requiresAdditionalConfirm) {
      setDialogOpen(true);
      return;
    }
    onConfirm(false);
  }

  function handleAdditionalConfirm() {
    setDialogOpen(false);
    onConfirm(true);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>ファイル情報</CardTitle>
          {requiresAdditionalConfirm && <Badge variant="outline">追加確認</Badge>}
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

      {requiresAdditionalConfirm && (
        <Alert>
          <AlertTitle>同じ日の取込みがあります</AlertTitle>
          <AlertDescription>
            既存分を残したまま今回分を追加します。内容を確認してください。
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleImportClick} disabled={isImporting}>
          取り込む
        </Button>
        <FilePicker
          accept=".csv,.txt"
          ariaLabel="ファイルを選び直す（商品別CSV）"
          buttonLabel="ファイルを選び直す"
          dialogFilterName="CSV / TXT"
          dropEnabled={false}
          disabled={isImporting}
          onSelect={onReselect}
        />
      </div>

      <AdditionalImportConfirmDialog
        open={dialogOpen}
        existingImports={duplicate_check.same_date_imports.map((item) => ({
          id: item.id,
          filenames: item.filename,
          amount: `¥${item.total_amount.toLocaleString("ja-JP")} / ${item.total_items.toLocaleString("ja-JP")}件`,
          importedAt: item.imported_at,
        }))}
        incomingImport={{
          filenames: file_info.filename,
          amount: `¥${matched_summary.total_amount.toLocaleString("ja-JP")} / ${matched_summary.count.toLocaleString("ja-JP")}件`,
          importedAt: preview.preview_created_at,
        }}
        onConfirm={handleAdditionalConfirm}
        onCancel={() => {
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
