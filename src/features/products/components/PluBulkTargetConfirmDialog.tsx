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

export interface PluBulkTargetConfirmDialogProps {
  open: boolean;
  pluTarget: boolean;
  count: number;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function PluBulkTargetConfirmDialog({
  open,
  pluTarget,
  count,
  isPending,
  onOpenChange,
  onConfirm,
}: PluBulkTargetConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {pluTarget ? "表示中の商品をPLU対象にしますか" : "表示中の商品をPLU対象から外しますか"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            現在の絞り込み条件に一致する {count.toLocaleString("ja-JP")}{" "}
            件が対象です。レジへの反映には PLU 書出しと PC ツールの取込みが別途必要です。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>キャンセル</AlertDialogCancel>
          <AlertDialogAction disabled={isPending || count === 0} onClick={onConfirm}>
            {isPending ? "更新中..." : pluTarget ? "PLU 対象にする" : "PLU 対象から外す"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
