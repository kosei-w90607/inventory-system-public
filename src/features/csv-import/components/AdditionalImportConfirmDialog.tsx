// 両取込みタブで共有する同日追加確認ダイアログ。
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

export interface ExistingImportSummary {
  id: number;
  filenames: string;
  amount: string;
  importedAt: string;
}

export interface AdditionalImportConfirmDialogProps {
  open: boolean;
  existingImports: ExistingImportSummary[];
  incomingImport: Omit<ExistingImportSummary, "id">;
  onConfirm: () => void;
  onCancel: () => void;
}

/// open は parent state、open=false にする経路は (1) onConfirm (2) onCancel (Esc / 外側クリック / キャンセルボタン)。
/// Radix の onOpenChange を onCancel にブリッジする。
export function AdditionalImportConfirmDialog({
  open,
  existingImports,
  incomingImport,
  onConfirm,
  onCancel,
}: AdditionalImportConfirmDialogProps) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>同じ日のデータを追加で取り込みますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は既存の取込みを置き換えません。対象日の売上に今回分を追加します。復旧用に書き出した同内容のファイルを選んでいないか確認してください。
          </AlertDialogDescription>
          <div className="space-y-2 text-sm">
            <p className="font-medium">
              既存分（{existingImports.length.toLocaleString("ja-JP")}回）
            </p>
            <ul className="space-y-2">
              {existingImports.map((item) => (
                <li key={item.id} className="rounded-md border p-3">
                  <span className="font-medium">ID {item.id}</span> / {item.filenames} /{" "}
                  {item.amount} / {item.importedAt}
                </li>
              ))}
            </ul>
            <p className="font-medium">今回分</p>
            <p className="rounded-md border p-3">
              {incomingImport.filenames} / {incomingImport.amount} / {incomingImport.importedAt}
            </p>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>追加で取り込む</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
