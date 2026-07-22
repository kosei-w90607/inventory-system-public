import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "@/components/patterns/PageHeader";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductPagination } from "@/features/products/components/ProductPagination";
import { commands, type IntegrityFixResult, type IntegrityResult } from "@/lib/bindings";
import { invalidateByContract, invalidationContract } from "@/lib/invalidation-contract";
import { isInvokeError, unwrapResult } from "@/lib/invoke";

const PER_PAGE = 100;

type IntegrityPhase = "idle" | "running" | "completed";
type PendingOperation = "check" | "fix" | null;
interface OperationError {
  operation: "check" | "fix";
  message: string;
}

function describeError(error: unknown): string {
  if (isInvokeError(error)) return error.cmdError.message;
  return "処理を完了できませんでした。もう一度お試しください。";
}

function formatCheckedAt(value: string): string {
  return value.replace("T", " ");
}

function differenceLabel(difference: number): string {
  if (difference > 0) return "システム在庫が多い";
  if (difference < 0) return "入出庫の合計が多い";
  return "差異なし";
}

export function IntegrityCheckPage() {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<IntegrityPhase>("idle");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation>(null);
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fixResult, setFixResult] = useState<IntegrityFixResult | null>(null);
  const [fixedCodes, setFixedCodes] = useState<Set<string>>(() => new Set());
  const [operationError, setOperationError] = useState<OperationError | null>(null);

  const latestCheckQuery = useQuery({
    queryKey: ["settings", "integrity", "latest-check"],
    queryFn: () =>
      unwrapResult(
        commands.listLogs({
          page: 1,
          per_page: 1,
          operation_type: "integrity_check",
          start_date: null,
          end_date: null,
        }),
        { source: "commands", cmd: "list_logs" },
      ),
    staleTime: 0,
    gcTime: 300_000,
    retry: 0,
  });

  const isBusy = pendingOperation !== null;
  const mismatches = useMemo(() => result?.mismatches ?? [], [result]);
  const visibleMismatches = useMemo(
    () => mismatches.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [mismatches, page],
  );
  const selectedMismatches = useMemo(
    () => mismatches.filter((item) => selectedCodes.has(item.product_code)),
    [mismatches, selectedCodes],
  );

  async function handleCheck() {
    if (isBusy) return;
    const previousPhase = phase;
    setPendingOperation("check");
    setPhase("running");
    setResult(null);
    setSelectedCodes(new Set());
    setPage(1);
    setFixResult(null);
    setFixedCodes(new Set());
    setOperationError(null);
    try {
      const nextResult = await unwrapResult(commands.runIntegrityCheck(), {
        source: "commands",
        cmd: "run_integrity_check",
      });
      setResult(nextResult);
      setPhase("completed");
      void latestCheckQuery.refetch();
    } catch (error) {
      setPhase(previousPhase);
      setOperationError({ operation: "check", message: describeError(error) });
    } finally {
      setPendingOperation(null);
    }
  }

  async function handleFix() {
    if (isBusy || selectedCodes.size === 0) return;
    const productCodes = Array.from(selectedCodes);
    setDialogOpen(false);
    setPendingOperation("fix");
    setPhase("running");
    setOperationError(null);
    try {
      const nextFixResult = await unwrapResult(commands.fixIntegrity(productCodes), {
        source: "commands",
        cmd: "fix_integrity",
      });
      const adjustedCodes = new Set(
        nextFixResult.adjustments.map((adjustment) => adjustment.product_code),
      );
      setFixResult(nextFixResult);
      setFixedCodes((current) => new Set([...current, ...adjustedCodes]));
      setSelectedCodes(
        (current) => new Set(Array.from(current).filter((code) => !adjustedCodes.has(code))),
      );
      await invalidateByContract(queryClient, invalidationContract.integrityFix());
    } catch (error) {
      setOperationError({ operation: "fix", message: describeError(error) });
    } finally {
      setPhase("completed");
      setPendingOperation(null);
    }
  }

  function toggleSelected(code: string, checked: boolean) {
    setSelectedCodes((current) => {
      const next = new Set(current);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  let latestCheckText = "読み込み中です";
  if (latestCheckQuery.isError) latestCheckText = "取得できませんでした";
  else if (latestCheckQuery.data)
    latestCheckText = latestCheckQuery.data.items[0]
      ? formatCheckedAt(latestCheckQuery.data.items[0].created_at)
      : "まだ実行されていません";

  return (
    <div className="relative min-h-screen space-y-6 p-6">
      <div className="space-y-2">
        <PageHeader
          title="在庫整合性チェック"
          actions={
            <Button type="button" disabled={isBusy} onClick={() => void handleCheck()}>
              {phase === "completed" ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <ShieldCheck aria-hidden="true" />
              )}
              {phase === "completed" ? "再度チェック" : "整合性チェック実行"}
            </Button>
          }
        />
        <p className="text-sm text-muted-foreground">
          システム在庫と入出庫の記録を照合し、差異を確認します。
        </p>
        <p className="text-sm font-medium">直近の確認日時: {latestCheckText}</p>
      </div>

      {operationError ? (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>処理を完了できませんでした</AlertTitle>
          <AlertDescription>
            <p>{operationError.message}</p>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() =>
                void (operationError.operation === "fix" ? handleFix() : handleCheck())
              }
            >
              <RotateCcw aria-hidden="true" />
              {operationError.operation === "fix" ? "補正を再試行" : "再試行"}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {phase === "completed" && result !== null ? (
        result.mismatch_count === 0 ? (
          <Alert role="status" className="border-success bg-success-soft text-success">
            <CheckCircle2 aria-hidden="true" className="text-success" />
            <AlertTitle>差異はありません</AlertTitle>
            <AlertDescription>
              {result.checked_count.toLocaleString("ja-JP")}件の商品を確認しました。
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-5">
            <Alert role="status" className="border-warning bg-warning-soft text-warning-strong">
              <AlertTriangle aria-hidden="true" className="text-warning-foreground" />
              <AlertTitle>差異が見つかりました</AlertTitle>
              <AlertDescription>
                {result.mismatch_count.toLocaleString("ja-JP")}件の商品を確認してください。
              </AlertDescription>
            </Alert>

            {fixResult ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck aria-hidden="true" className="size-5 text-success" />
                    {fixResult.fixed_count.toLocaleString("ja-JP")}件を補正しました
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {fixResult.adjustments.length > 0 ? (
                    <ul className="space-y-2">
                      {fixResult.adjustments.map((adjustment) => (
                        <li
                          key={adjustment.product_code}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
                        >
                          <span className="font-mono font-medium">{adjustment.product_code}</span>
                          <span>
                            {adjustment.old_stock} → {adjustment.new_stock}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">補正された商品はありません。</p>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {fixResult && fixResult.skipped_count > 0 ? (
              <Alert className="border-warning bg-warning-soft text-warning-strong">
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>一部の商品は補正されませんでした</AlertTitle>
                <AlertDescription>
                  {fixResult.skipped_count.toLocaleString("ja-JP")}
                  件は状態が変わっていたため、補正を見送りました。
                </AlertDescription>
              </Alert>
            ) : null}

            <section aria-labelledby="integrity-difference-heading" className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="integrity-difference-heading" className="text-xl font-semibold">
                    差異のある商品
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    補正する商品を行ごとに選び、内容を確認して確定してください。
                  </p>
                </div>
                <Button
                  type="button"
                  disabled={isBusy || selectedCodes.size === 0}
                  onClick={() => {
                    setDialogOpen(true);
                  }}
                >
                  補正を確定
                </Button>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-32">商品コード</TableHead>
                      <TableHead className="min-w-56">名前</TableHead>
                      <TableHead className="w-28 text-right">システム在庫</TableHead>
                      <TableHead className="w-28 text-right">入出庫の合計</TableHead>
                      <TableHead className="min-w-40 text-right">差異</TableHead>
                      <TableHead className="w-32 text-center">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleMismatches.map((item) => {
                      const isFixed = fixedCodes.has(item.product_code);
                      return (
                        <TableRow key={item.product_code}>
                          <TableCell className="font-mono font-medium">
                            {item.product_code}
                          </TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.stock_quantity.toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.movements_sum.toLocaleString("ja-JP")}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-semibold tabular-nums">
                                {item.difference > 0 ? "+" : ""}
                                {item.difference.toLocaleString("ja-JP")}
                              </span>
                              <Badge variant="outline">{differenceLabel(item.difference)}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              {isFixed ? (
                                <Badge className="bg-success text-primary-foreground">
                                  <CheckCircle2 aria-hidden="true" />
                                  補正済み
                                </Badge>
                              ) : (
                                <label
                                  htmlFor={`integrity-fix-${item.product_code}`}
                                  className="flex cursor-pointer items-center gap-2"
                                >
                                  <Checkbox
                                    id={`integrity-fix-${item.product_code}`}
                                    aria-label={`${item.product_code}を補正する`}
                                    checked={selectedCodes.has(item.product_code)}
                                    disabled={isBusy}
                                    onCheckedChange={(checked) => {
                                      toggleSelected(item.product_code, checked === true);
                                    }}
                                  />
                                  <span className="text-sm">補正する</span>
                                </label>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <ProductPagination
                page={page}
                perPage={PER_PAGE}
                totalCount={mismatches.length}
                onPageChange={setPage}
              />
            </section>
          </div>
        )
      ) : null}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>在庫数を入出庫の合計に合わせて補正します</AlertDialogTitle>
            <AlertDialogDescription className="sr-only">
              補正すると元に戻せません。選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Alert className="border-warning bg-warning-soft text-warning-strong">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>補正すると元に戻せません</AlertTitle>
            <AlertDescription>
              選択した商品のシステム在庫を入出庫の合計に合わせて更新し、操作ログに記録します。
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              補正する商品（システム在庫 → 入出庫の合計）
            </p>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <ul className="divide-y">
                {selectedMismatches.map((item) => (
                  <li key={item.product_code} className="space-y-1 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-medium">{item.product_code}</span>
                      <span className="font-medium tabular-nums">
                        {item.stock_quantity} → {item.movements_sum}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBusy}>キャンセル</AlertDialogCancel>
            <AlertDialogAction disabled={isBusy} onClick={() => void handleFix()}>
              補正を実行する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isBusy ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute inset-0 z-40 flex items-center justify-center bg-background/85 p-6 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6 text-center shadow-lg">
            <Loader2 aria-hidden="true" className="mx-auto size-8 animate-spin text-primary" />
            <p className="text-lg font-semibold">
              {pendingOperation === "fix" ? "補正を記録しています" : "在庫データを確認しています"}
            </p>
            <p className="text-sm text-muted-foreground">完了するまでこの画面でお待ちください。</p>
            <Progress
              aria-label="処理中"
              className="before:absolute before:inset-y-0 before:left-1/4 before:w-1/2 before:animate-pulse before:bg-warning before:content-['']"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
