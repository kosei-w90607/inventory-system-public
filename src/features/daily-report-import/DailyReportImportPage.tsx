import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import type { DailyReportImportResult, DailyReportPreviewData } from "@/lib/bindings";
import { useDailyReportImportFlow } from "./hooks/useDailyReportImportFlow";

export function DailyReportImportPage() {
  const flow = useDailyReportImportFlow();
  const { state } = flow;

  const content = (() => {
    switch (state.status) {
      case "idle":
      case "parsing":
        return (
          <DailyReportParseStep
            isParsing={flow.isParsing || state.status === "parsing"}
            selectionError={state.lastSelectionError}
            onChooseFiles={() => void flow.chooseFiles()}
          />
        );
      case "preview":
        return (
          <DailyReportPreviewStep
            preview={state.preview}
            filenames={state.filenames}
            isImporting={flow.isImporting}
            selectionError={state.lastSelectionError}
            onConfirm={flow.confirmImport}
            onChooseFiles={() => void flow.chooseFiles()}
          />
        );
      case "importing":
        return <DailyReportImportingStep filenames={state.filenames} />;
      case "result":
        return (
          <DailyReportResultStep
            result={state.result}
            reportDate={state.reportDate}
            isRollingBack={flow.isRollingBack}
            onRollback={() => {
              flow.rollback(state.result.daily_report_import_id);
            }}
          />
        );
      case "error":
        return (
          <Alert variant="destructive">
            <AlertTitle>処理できませんでした</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{state.error.cmdError.message}</p>
              <Button variant="outline" onClick={flow.dismissError}>
                戻る
              </Button>
            </AlertDescription>
          </Alert>
        );
    }
  })();

  return content;
}

function DailyReportParseStep({
  isParsing,
  selectionError,
  onChooseFiles,
}: {
  isParsing: boolean;
  selectionError: string | null;
  onChooseFiles: () => void;
}) {
  if (isParsing) {
    return (
      <div
        className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border p-8"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm font-medium">日報ファイルを解析中…</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>日報ファイル</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" onClick={onChooseFiles}>
          日報ファイルを選択
        </Button>
        <SelectionErrorMessage message={selectionError} />
        <p className="text-sm text-muted-foreground">
          Z001 / Z002 / Z005 の3ファイルを選択します。
        </p>
      </CardContent>
    </Card>
  );
}

function DailyReportPreviewStep({
  preview,
  filenames,
  isImporting,
  selectionError,
  onConfirm,
  onChooseFiles,
}: {
  preview: DailyReportPreviewData;
  filenames: string[];
  isImporting: boolean;
  selectionError: string | null;
  onConfirm: (overwriteConfirmed: boolean) => void;
  onChooseFiles: () => void;
}) {
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const requiresOverwrite = preview.duplicate_check.status === "OverwriteRequired";
  const alreadyImported = preview.duplicate_check.status === "AlreadyImported";

  return (
    <div className="space-y-4">
      {alreadyImported && (
        <Alert variant="destructive">
          <AlertTitle>この日報は取込み済みです。二重取込みはできません。</AlertTitle>
          <AlertDescription>別の日報ファイルを選び直してください。</AlertDescription>
        </Alert>
      )}

      {requiresOverwrite && (
        <Alert className="border-warning bg-warning-soft text-warning-strong">
          <AlertTitle>同じ対象日の日報があります</AlertTitle>
          <AlertDescription className="text-warning-strong">
            取り込むには上書き確認にチェックしてください。
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>取込み内容</CardTitle>
          <Badge
            variant={alreadyImported ? "destructive" : requiresOverwrite ? "outline" : "secondary"}
          >
            {alreadyImported ? "取込み済み" : requiresOverwrite ? "上書き確認" : "確認済み"}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Info label="対象日" value={preview.file_info.report_date} />
          <Info label="bundle hash" value={`${preview.file_info.bundle_hash.slice(0, 8)}...`} />
          <Info label="総売上" value={formatMoney(preview.totals.gross_amount)} />
          <Info label="純売上" value={formatMoney(preview.totals.net_amount)} />
          <div className="md:col-span-2">
            <p className="text-muted-foreground">ファイル</p>
            <p className="font-medium">{filenames.join(" / ")}</p>
          </div>
        </CardContent>
      </Card>

      {preview.warnings.length > 0 && (
        <Alert>
          <AlertTitle>確認が必要な部門があります</AlertTitle>
          <AlertDescription>
            <ul className="ml-4 list-disc">
              {preview.warnings.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>支払集計</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {preview.payment_summary.map((line) => (
              <Info key={line.sort_order} label={line.label} value={formatMoney(line.amount)} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>部門別集計</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {preview.department_summary.map((line) => (
              <Info
                key={`${String(line.sort_order)}-${line.raw_department_name}`}
                label={line.raw_department_name}
                value={formatMoney(line.amount)}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {requiresOverwrite && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmOverwrite}
            onChange={(event) => {
              setConfirmOverwrite(event.target.checked);
            }}
          />
          同じ対象日の既存日報を取り消して上書きします
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            onConfirm(requiresOverwrite);
          }}
          disabled={isImporting || alreadyImported || (requiresOverwrite && !confirmOverwrite)}
        >
          取り込む
        </Button>
        <Button variant="outline" onClick={onChooseFiles} disabled={isImporting}>
          ファイルを選び直す
        </Button>
      </div>
      <SelectionErrorMessage message={selectionError} />
    </div>
  );
}

function SelectionErrorMessage({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <p className="flex items-start gap-2 text-sm font-medium text-destructive" role="alert">
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function DailyReportImportingStep({ filenames }: { filenames: string[] }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-lg border p-8">
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm font-medium">日報を取り込み中…</p>
      <p className="text-xs text-muted-foreground">{filenames.join(" / ")}</p>
    </div>
  );
}

function DailyReportResultStep({
  result,
  reportDate,
  isRollingBack,
  onRollback,
}: {
  result: DailyReportImportResult;
  reportDate: string;
  isRollingBack: boolean;
  onRollback: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>日報取込み完了</CardTitle>
        <Badge>成功</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Info label="取込み ID" value={String(result.daily_report_import_id)} />
          <Info label="対象日" value={reportDate} />
          <Info label="総売上" value={formatMoney(result.gross_amount)} />
          <Info label="純売上" value={formatMoney(result.net_amount)} />
          <Info label="警告" value={`${result.warning_count.toLocaleString()} 件`} />
        </dl>
        <Alert>
          <AlertTitle>在庫数は変わりません</AlertTitle>
          <AlertDescription>取消しても在庫数は変わりません。</AlertDescription>
        </Alert>
        <Button asChild>
          <a href={`/reports/daily?date=${encodeURIComponent(reportDate)}`}>日次売上を見る</a>
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
              <AlertDialogTitle>日報取込みを取り消しますか？</AlertDialogTitle>
              <AlertDialogDescription>
                ID {result.daily_report_import_id}{" "}
                の日報取込みを取り消します。取消しても在庫数は変わりません。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction onClick={onRollback}>取り消す</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function formatMoney(value: number | null) {
  return value === null ? "未取得" : `¥${value.toLocaleString()}`;
}
