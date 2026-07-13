// src/features/csv-import/components/OverwriteConfirmDialog.tsx
//
// DuplicateStatus === "OverwriteRequired" 時の確認ダイアログ。
// shadcn AlertDialog を使用、Esc は Radix 標準 (cancel として動作)。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.4 step 9 / §55.7

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface OverwriteConfirmDialogProps {
  open: boolean;
  existingImportId: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/// open は parent state、open=false にする経路は (1) onConfirm (2) onCancel (Esc / 外側クリック / キャンセルボタン)。
/// Radix の onOpenChange を onCancel にブリッジする。
export function OverwriteConfirmDialog({
  open,
  existingImportId,
  onConfirm,
  onCancel,
}: OverwriteConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>同じ精算日の取込み履歴があります</AlertDialogTitle>
          <AlertDialogDescription>
            既存の取込み (ID: {existingImportId ?? "—"})
            を上書きします。既存の売上・在庫変動は取り消され、新しいファイルの内容で再登録されます。続行しますか？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>上書きする</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
