import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/patterns/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { commands, type PluExportPrepareResponse } from "@/lib/bindings";
import { invalidateByContract, invalidationContract } from "@/lib/invalidation-contract";
import { isInvokeError, unwrapResult } from "@/lib/invoke";
import { scrollPageToTop } from "@/lib/page-scroll";
import { queryKeys } from "@/lib/query-keys";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

type ExportMode = "diff" | "full";
type FlowStatus =
  | "idle"
  | "preparing"
  | "cancelled"
  | "prepare_failed"
  | "save_failed"
  | "saved"
  | "confirm_failed"
  | "confirmed";

interface PendingPluExport {
  version: 1;
  mode: ExportMode;
  savedAt: string;
  savedPath: string;
  suggestedFilename: string;
  count: number;
  encoding: string;
  targetProductCodes: string[];
  overLimitWarning: boolean;
}

export const PLU_EXPORT_PENDING_STORAGE_KEY = "inventory:plu-export:pending:v1";

const PENDING_PLU_EXPORT_KEYS = [
  "version",
  "mode",
  "savedAt",
  "savedPath",
  "suggestedFilename",
  "count",
  "encoding",
  "targetProductCodes",
  "overLimitWarning",
] as const;

const MODE_OPTIONS = [
  { value: "diff", label: "差分", description: "未反映の商品だけ" },
  { value: "full", label: "全件", description: "廃番を除く全商品" },
] as const;

function decodeBase64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function describeError(error: unknown): string {
  if (isInvokeError(error)) return error.cmdError.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

function isExportMode(value: unknown): value is ExportMode {
  return value === "diff" || value === "full";
}

function hasOnlyPendingPluExportKeys(value: Record<string, unknown>): boolean {
  const allowed = new Set<string>(PENDING_PLU_EXPORT_KEYS);
  return Object.keys(value).every((key) => allowed.has(key));
}

function isPendingPluExport(value: unknown): value is PendingPluExport {
  if (!value || typeof value !== "object") return false;
  if (!hasOnlyPendingPluExportKeys(value as Record<string, unknown>)) return false;
  const pending = value as Partial<PendingPluExport>;
  const uniqueTargetCodes = new Set(pending.targetProductCodes);
  return (
    pending.version === 1 &&
    isExportMode(pending.mode) &&
    typeof pending.savedAt === "string" &&
    typeof pending.savedPath === "string" &&
    typeof pending.suggestedFilename === "string" &&
    typeof pending.count === "number" &&
    Number.isInteger(pending.count) &&
    pending.count >= 0 &&
    typeof pending.encoding === "string" &&
    Array.isArray(pending.targetProductCodes) &&
    pending.targetProductCodes.length > 0 &&
    uniqueTargetCodes.size === pending.targetProductCodes.length &&
    pending.count <= pending.targetProductCodes.length &&
    pending.targetProductCodes.every((code) => typeof code === "string" && code.length > 0) &&
    typeof pending.overLimitWarning === "boolean"
  );
}

function clearPendingPluExport() {
  try {
    window.localStorage.removeItem(PLU_EXPORT_PENDING_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in restricted WebView contexts.
  }
}

function loadPendingPluExport(): PendingPluExport | null {
  try {
    const raw = window.localStorage.getItem(PLU_EXPORT_PENDING_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isPendingPluExport(parsed)) return parsed;
    clearPendingPluExport();
    return null;
  } catch {
    clearPendingPluExport();
    return null;
  }
}

function savePendingPluExport(pending: PendingPluExport) {
  try {
    window.localStorage.setItem(PLU_EXPORT_PENDING_STORAGE_KEY, JSON.stringify(pending));
  } catch {
    // Persistence is a recovery aid. The current in-memory confirmation path still works.
  }
}

function buildPendingPluExport(
  exportMode: ExportMode,
  targetPath: string,
  nextPrepared: PluExportPrepareResponse,
): PendingPluExport {
  return {
    version: 1,
    mode: exportMode,
    savedAt: new Date().toISOString(),
    savedPath: targetPath,
    suggestedFilename: nextPrepared.suggested_filename,
    count: nextPrepared.count,
    encoding: nextPrepared.encoding,
    targetProductCodes: nextPrepared.target_product_codes,
    overLimitWarning: nextPrepared.over_limit_warning,
  };
}

function formatPendingSavedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExcludedReason(reason: string): string {
  switch (reason) {
    case "missing_jan":
      return "JAN未登録";
    case "invalid_jan_format":
      return "JANが13桁ではありません";
    case "invalid_check_digit":
      return "JANのチェックディジットが不正です";
    case "group_price_mismatch":
      return "同じJANの商品で売価または税率が一致していません";
    default:
      return "要修正（詳細不明）";
  }
}

export function PluExportPage() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<ExportMode>("diff");
  const [status, setStatus] = useState<FlowStatus>("idle");
  const [prepared, setPrepared] = useState<PluExportPrepareResponse | null>(null);
  const [pendingExport, setPendingExport] = useState<PendingPluExport | null>(() =>
    loadPendingPluExport(),
  );
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dirtyQuery = useQuery({
    queryKey: queryKeys.pluDirty(),
    queryFn: () =>
      unwrapResult(commands.listPluDirty(), { source: "commands", cmd: "list_plu_dirty" }),
  });

  const isBusy = status === "preparing";
  const dirtyCount = dirtyQuery.data?.length ?? 0;

  async function savePreparedFile(nextPrepared: PluExportPrepareResponse) {
    const targetPath = await save({
      defaultPath: nextPrepared.suggested_filename,
      filters: [{ name: "PLUテキスト", extensions: ["txt"] }],
    });

    if (!targetPath) {
      setStatus("cancelled");
      setSavedPath(null);
      setErrorMessage(null);
      scrollPageToTop();
      return;
    }

    try {
      await writeFile(targetPath, decodeBase64Bytes(nextPrepared.bytes_base64));
      const nextPending = buildPendingPluExport(mode, targetPath, nextPrepared);
      savePendingPluExport(nextPending);
      setPendingExport(nextPending);
      setStatus("saved");
      setSavedPath(targetPath);
      setErrorMessage(null);
      scrollPageToTop();
      toast.success("PLUファイルを保存しました");
    } catch (error) {
      setStatus("save_failed");
      setSavedPath(null);
      setErrorMessage(describeError(error));
      scrollPageToTop();
      toast.error("PLUファイルを保存できませんでした");
    }
  }

  async function handlePrepareAndSave() {
    setStatus("preparing");
    setErrorMessage(null);
    setSavedPath(null);
    try {
      const nextPrepared = await unwrapResult(commands.preparePluExport(mode), {
        source: "commands",
        cmd: "prepare_plu_export",
      });
      setPrepared(nextPrepared);
      await savePreparedFile(nextPrepared);
    } catch (error) {
      setStatus("prepare_failed");
      setErrorMessage(describeError(error));
      scrollPageToTop();
      toast.error("PLU書出しを準備できませんでした");
    }
  }

  async function handleRetrySave() {
    if (!prepared) return;
    setStatus("preparing");
    setErrorMessage(null);
    await savePreparedFile(prepared);
  }

  async function handleConfirm() {
    const targetProductCodes = pendingExport?.targetProductCodes ?? prepared?.target_product_codes;
    if (!targetProductCodes || targetProductCodes.length === 0) return;
    setStatus("preparing");
    setErrorMessage(null);
    try {
      await unwrapResult(commands.confirmPluExportSaved(targetProductCodes), {
        source: "commands",
        cmd: "confirm_plu_export_saved",
      });
      await invalidateByContract(queryClient, invalidationContract.pluExportConfirm());
      clearPendingPluExport();
      setPendingExport(null);
      setStatus("confirmed");
      scrollPageToTop();
      toast.success("PLU未反映を更新しました");
    } catch (error) {
      setStatus("confirm_failed");
      setErrorMessage(describeError(error));
      scrollPageToTop();
      toast.error("未反映から外せませんでした");
    }
  }

  function handleDiscardPending() {
    clearPendingPluExport();
    setPendingExport(null);
    setPrepared(null);
    setSavedPath(null);
    setErrorMessage(null);
    setStatus("idle");
    scrollPageToTop();
  }

  const showFullModeWarning = mode === "full";
  const displayCount = pendingExport?.count ?? prepared?.count;
  const displayEncoding = pendingExport?.encoding ?? prepared?.encoding;
  const displayOverLimitWarning =
    pendingExport?.overLimitWarning ?? prepared?.over_limit_warning ?? false;
  const displaySavedPath = pendingExport?.savedPath ?? savedPath;
  const excludedProducts = prepared?.excluded ?? [];
  const showPendingRecovery =
    pendingExport !== null &&
    status !== "saved" &&
    status !== "confirm_failed" &&
    status !== "confirmed" &&
    status !== "preparing";
  const hasTopStatus =
    displayOverLimitWarning ||
    showPendingRecovery ||
    status === "cancelled" ||
    status === "prepare_failed" ||
    status === "save_failed" ||
    status === "saved" ||
    status === "confirm_failed" ||
    status === "confirmed";
  const hasSavedExportPending =
    pendingExport !== null || status === "saved" || status === "confirm_failed";

  return (
    <div className="space-y-5 p-6">
      <PageHeader title="PLU書出し" />

      <Alert className="border-info bg-info-soft text-info-strong">
        <AlertTitle>PLUファイル保存後に手動確認が必要です</AlertTitle>
        <AlertDescription>
          アプリで確認できるのはPLUファイル保存までです。PCツールへの取込み、SDカード書出し、レジ読込みは手動で確認してください。
        </AlertDescription>
      </Alert>

      {hasTopStatus ? (
        <section aria-label="PLU書出し状態" className="space-y-3">
          {displayOverLimitWarning ? (
            <Alert className="border-warning bg-warning-soft text-warning-strong">
              <AlertTriangle />
              <AlertTitle>スキャニングPLU上限の4,784件を超えています</AlertTitle>
              <AlertDescription>
                SR-S4000のPLU総枠5,000件から通常PLU使用枠を除いた、現在のスキャニングPLU上限を超えています。
              </AlertDescription>
            </Alert>
          ) : null}

          {showPendingRecovery ? (
            <Alert className="border-warning bg-warning-soft text-warning-strong">
              <AlertTriangle />
              <AlertTitle>保存済みで未確認のPLU書出しがあります</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>
                  PCツールでこのPLUファイルを扱う場合だけ、未反映から外してください。
                  違うPLUファイルでやり直す場合は破棄して再書出しします。
                </p>
                <p className="font-medium">
                  PCツールに取り込めなかった場合は、未反映を外さずに全件を書き出し直して取り込んでください。
                </p>
                <div className="grid gap-1">
                  <p>保存先: {pendingExport.savedPath}</p>
                  <p>件数: {pendingExport.count.toLocaleString()} 件</p>
                  <p>文字コード: {pendingExport.encoding}</p>
                  <p>保存日時: {formatPendingSavedAt(pendingExport.savedAt)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" onClick={() => void handleConfirm()}>
                    この書出しを未反映から外す
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleDiscardPending}>
                    破棄して再書出し
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "cancelled" ? (
            <Alert>
              <AlertTitle>保存はキャンセルされました</AlertTitle>
              <AlertDescription>未反映商品は残っています。</AlertDescription>
            </Alert>
          ) : null}

          {status === "save_failed" ? (
            <Alert variant="destructive">
              <AlertTitle>PLUファイルを保存できませんでした</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>PCツールへ進む前に、もう一度保存してください。</p>
                {errorMessage ? <p>{errorMessage}</p> : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRetrySave()}
                >
                  <RotateCcw />
                  もう一度保存する
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "prepare_failed" ? (
            <Alert variant="destructive">
              <AlertTitle>PLU書出しを準備できませんでした</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>商品マスタのJANコードや書出し対象件数を確認してください。</p>
                <p>件数上限はSR-S4000のPLU総枠5,000件から通常PLU使用枠を 除いた値です。</p>
                {errorMessage ? <p>{errorMessage}</p> : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handlePrepareAndSave()}
                >
                  <RotateCcw />
                  もう一度準備する
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "saved" ? (
            <>
              <Alert className="text-success-strong border-success bg-success-soft">
                <Save />
                <AlertTitle>PLUファイルを保存しました</AlertTitle>
                <AlertDescription className="space-y-3">
                  {displaySavedPath ? <p>保存先: {displaySavedPath}</p> : null}
                  <p>
                    アプリで確認できるのはPLUファイル保存までです。PCツールへの取込み、SDカード書出し、レジ読込みは手動で確認してください。
                  </p>
                  <Button type="button" size="sm" onClick={() => void handleConfirm()}>
                    この書出しを未反映から外す
                  </Button>
                </AlertDescription>
              </Alert>
              <Alert className="border-warning bg-warning-soft text-warning-strong">
                <AlertTriangle />
                <AlertTitle>PCツールに取り込めなかった場合の回復手順</AlertTitle>
                <AlertDescription>
                  PCツールに取り込めなかった場合は、未反映を外さずに全件を書き出し直して取り込んでください。
                </AlertDescription>
              </Alert>
            </>
          ) : null}

          {status === "confirm_failed" ? (
            <Alert variant="destructive">
              <AlertTitle>未反映から外せませんでした</AlertTitle>
              <AlertDescription className="space-y-3">
                {displaySavedPath ? <p>保存済みPLUファイル: {displaySavedPath}</p> : null}
                <p>
                  保存済みPLUファイルは残っています。原因を確認してから、もう一度実行してください。
                </p>
                {errorMessage ? <p>{errorMessage}</p> : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleConfirm()}
                >
                  <RotateCcw />
                  もう一度未反映から外す
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          {status === "confirmed" ? (
            <Alert className="text-success-strong border-success bg-success-soft">
              <CheckCircle2 />
              <AlertTitle>未反映から外しました</AlertTitle>
              <AlertDescription>
                保存したPLUファイルに含まれる商品だけをPLU未反映から外しました。
              </AlertDescription>
            </Alert>
          ) : null}
        </section>
      ) : null}

      {excludedProducts.length > 0 ? (
        <section aria-label="書出しに含めなかった商品" className="space-y-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <AlertTriangle className="size-5 text-warning-strong" aria-hidden="true" />
            書出しに含めなかった商品（要修正）
          </h2>
          <p className="text-sm text-muted-foreground">
            これらの商品は今回のPLUファイルに含めていません。
            <span className="font-medium text-foreground">
              商品マスタでJANコード・売価・税率を修正すると、次回の書出しから含まれます。
            </span>
          </p>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 pl-3 font-medium">商品コード</th>
                  <th className="py-2 pr-4 font-medium">JANコード</th>
                  <th className="py-2 pr-4 font-medium">商品名</th>
                  <th className="py-2 pr-3 font-medium">理由</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {excludedProducts.map((product) => (
                  <tr key={product.product_code}>
                    <td className="py-2 pr-4 pl-3 font-mono text-[0.95rem]">
                      {product.product_code}
                    </td>
                    <td className="py-2 pr-4 font-mono text-[0.95rem]">
                      {product.jan_code ?? (
                        <span className="font-sans text-muted-foreground">未登録</span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{product.name}</td>
                    <td className="py-2 pr-3 text-warning-strong">
                      {formatExcludedReason(product.reason)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section
        aria-label="PLU書出し内容"
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]"
      >
        <Card>
          <CardHeader>
            <CardTitle>未反映商品</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dirtyQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">読込み中です。</p>
            ) : null}
            {dirtyQuery.isError ? (
              <p className="text-sm text-destructive">未反映商品を取得できませんでした。</p>
            ) : null}
            {dirtyQuery.isSuccess && dirtyCount === 0 ? (
              <p className="text-sm text-muted-foreground">PLU書出しが必要な商品はありません。</p>
            ) : null}
            {dirtyQuery.isSuccess && dirtyCount > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">商品コード</th>
                      <th className="py-2 pr-4 font-medium">JANコード</th>
                      <th className="py-2 pr-4 font-medium">商品名</th>
                      <th className="py-2 pr-4 text-right font-medium">売価</th>
                      <th className="py-2 text-right font-medium">在庫</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {dirtyQuery.data.map((product) => (
                      <tr key={product.product_code}>
                        <td className="py-2 pr-4 font-mono text-[0.95rem]">
                          {product.product_code}
                        </td>
                        <td className="py-2 pr-4 font-mono text-[0.95rem]">
                          {product.jan_code ?? (
                            <span className="font-sans text-muted-foreground">未登録</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">{product.name}</td>
                        <td className="py-2 pr-4 text-right">
                          {product.selling_price.toLocaleString()} 円
                        </td>
                        <td className="py-2 text-right">
                          {product.stock_quantity.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>書出し設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <SegmentedControl
              ariaLabel="書出しモード"
              value={mode}
              options={MODE_OPTIONS}
              onValueChange={setMode}
            />

            {showFullModeWarning ? (
              <Alert className="border-warning bg-warning-soft text-warning-strong">
                <AlertTriangle />
                <AlertTitle>全件書出し前にレジ側データのバックアップを確認してください</AlertTitle>
                <AlertDescription>
                  PCツール（CV17）に取り込んでよいのは全件書出しのファイルだけです。差分書出しのファイルは取り込まないでください。
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">差分対象</span>
                <strong>{dirtyCount.toLocaleString()} 件</strong>
              </div>
              {displayCount !== undefined && displayEncoding ? (
                <>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">今回の書出し件数</span>
                    <strong>{displayCount.toLocaleString()} 件</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">文字コード</span>
                    <strong>{displayEncoding}</strong>
                  </div>
                </>
              ) : null}
            </div>

            <Button
              type="button"
              variant={hasSavedExportPending ? "outline" : "default"}
              className="w-full"
              disabled={isBusy || (mode === "diff" && dirtyQuery.isSuccess && dirtyCount === 0)}
              onClick={() => void handlePrepareAndSave()}
            >
              <Download />
              {mode === "full" ? "全件を書き出す" : "差分を書き出す"}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
