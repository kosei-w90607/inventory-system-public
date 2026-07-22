// src/features/csv-import/components/ResultStep.tsx
//
// Step 3/3 完了: 4 サマリ + status badge + 「売上レポートを見る」(/reports/daily 遷移、UI-09a 着手済) / 「取り消す」(rollback) / 「ホームに戻る」(navigate)。
// 設計: docs/function-design/55-ui-csv-import.md §55.1 / §55.4 step 15-19 / §55.6 rollback spinner

import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportResult } from "@/lib/bindings";

export interface ResultStepProps {
  result: ImportResult;
  settlementDate: string;
  onRollback: () => void;
  isRollingBack: boolean;
}

export function ResultStep({ result, settlementDate, onRollback, isRollingBack }: ResultStepProps) {
  const navigate = useNavigate();
  const isPartial = result.status === "completed_partial";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>取込み完了</CardTitle>
          <Badge variant={isPartial ? "outline" : "secondary"}>
            {isPartial ? "部分成功" : "成功"}
          </Badge>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">取込み ID</dt>
            <dd className="font-medium">{result.csv_import_id}</dd>
            <dt className="text-muted-foreground">精算日</dt>
            <dd className="font-medium">{settlementDate}</dd>
            <dt className="text-muted-foreground">取込み件数</dt>
            <dd className="font-medium">{result.total_items.toLocaleString()} 件</dd>
            <dt className="text-muted-foreground">合計金額</dt>
            <dd className="font-medium">¥{result.total_amount.toLocaleString()}</dd>
            <dt className="text-muted-foreground">スキップ件数</dt>
            <dd className="font-medium">{result.skipped_count.toLocaleString()} 件</dd>
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {/* UI-09a 着手済 (Phase 2 8-3、PR #65 Round 1 P1 fix): settlementDate を
            URL state で渡すことで、当日 !== settlementDate のケース (例: 前日分 CSV を
            翌日取り込み) でも取込み済データを直接表示。invalidation は useCsvImportFlow
            の commit/rollback success で queryKeys.dailySalesRoot() prefix 実施済。 */}
        <Button
          variant="outline"
          onClick={() => {
            void navigate({ to: "/reports/daily", search: { date: settlementDate } });
          }}
        >
          売上レポートを見る
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={isRollingBack}>
              {isRollingBack && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />}
              {isRollingBack ? "取り消し中…" : "取り消す"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>取込みを取り消しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                ID {result.csv_import_id} の取込み ({result.total_items.toLocaleString()} 件、¥
                {result.total_amount.toLocaleString()}) を取り消します。在庫数も元に戻ります。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={onRollback}>取り消す</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          onClick={() => {
            void navigate({ to: "/" });
          }}
        >
          ホームに戻る
        </Button>
      </div>
    </div>
  );
}
