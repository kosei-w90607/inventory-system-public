// src/features/products/components/DiscontinueConfirmDialog.tsx
//
// UI-01b-D13: 「廃番にする」操作の確認ダイアログ。
// shadcn AlertDialog を使用、Esc / 外側クリック / キャンセルは onCancel として動作。
// 「表示に戻す」は確認なしで直接実行するため、本ダイアログは廃番化のみに使う。
// 先例: src/features/csv-import/components/OverwriteConfirmDialog.tsx
// 設計: docs/function-design/51-ui-product-form.md §7.1 UI-01b-D13 / §7.5 step 5

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

export interface DiscontinueConfirmDialogProps {
  open: boolean;
  productName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/// open は parent state、open=false にする経路は (1) onConfirm (2) onCancel (Esc / 外側クリック / キャンセルボタン)。
/// Radix の onOpenChange を onCancel にブリッジする。
export function DiscontinueConfirmDialog({
  open,
  productName,
  onConfirm,
  onCancel,
}: DiscontinueConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>この商品を廃番にしますか？</AlertDialogTitle>
          <AlertDialogDescription>
            商品「{productName}
            」は商品一覧の通常表示から外れます。あとから「表示に戻す」で戻せます。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>廃番にする</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
