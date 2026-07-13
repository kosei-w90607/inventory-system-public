import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  FolderOpen,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/patterns/PageHeader";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { commands, type AppSetting, type BackupInfo, type BackupResult } from "@/lib/bindings";
import { isInvokeError, unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import { open } from "@tauri-apps/plugin-dialog";

const BACKUP_SETTING_KEYS = new Set([
  "backup_enabled",
  "backup_time",
  "backup_path",
  "backup_retention_days",
]);

const UNRECOVERABLE_RESTORE_TOKEN = "DB接続の復旧もできませんでした";

function describeError(error: unknown): string {
  if (isInvokeError(error)) return error.cmdError.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

function settingValue(settings: AppSetting[] | undefined, key: string, fallback: string): string {
  return settings?.find((setting) => setting.key === key)?.value ?? fallback;
}

function formatBackupDate(value: string): string {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1);
  const day = String(date.getDate());
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}月${day}日 ${hours}:${minutes}`;
}

function formatBackupSize(sizeBytes: number): string {
  return `${(sizeBytes / 1_000_000).toFixed(1)} MB`;
}

function isUnrecoverableRestoreError(message: string): boolean {
  return message.includes(UNRECOVERABLE_RESTORE_TOKEN) || message.includes("アプリを再起動");
}

interface RestoreState {
  selected: BackupInfo | null;
  preBackupFailed: boolean;
  breakGlassAccepted: boolean;
  confirmOpen: boolean;
}

const initialRestoreState: RestoreState = {
  selected: null,
  preBackupFailed: false,
  breakGlassAccepted: false,
  confirmOpen: false,
};

export function BackupRestorePage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [restoreState, setRestoreState] = useState<RestoreState>(initialRestoreState);
  const [manualBackupResult, setManualBackupResult] = useState<BackupResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isUpdatingSetting, setIsUpdatingSetting] = useState(false);
  const [isRunningPreBackup, setIsRunningPreBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [fatalRestoreMessage, setFatalRestoreMessage] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: queryKeys.backupRestore.settings(),
    queryFn: () =>
      unwrapResult(commands.getSettings(), { source: "commands", cmd: "get_settings" }),
  });

  const backupsQuery = useQuery({
    queryKey: queryKeys.backupRestore.list(),
    queryFn: () =>
      unwrapResult(commands.listBackups(), { source: "commands", cmd: "list_backups" }),
  });

  const effectiveBackupDirQuery = useQuery({
    queryKey: queryKeys.backupRestore.effectiveDir(),
    queryFn: () =>
      unwrapResult(commands.getEffectiveBackupDir(), {
        source: "commands",
        cmd: "get_effective_backup_dir",
      }),
  });

  const settings = settingsQuery.data;
  const backupEnabled = settingValue(settings, "backup_enabled", "1") !== "0";
  const backupTime = settingValue(settings, "backup_time", "23:00");
  const backupPath = settingValue(settings, "backup_path", "");
  const backupRetentionDays = settingValue(settings, "backup_retention_days", "3");
  const backups = useMemo(() => backupsQuery.data ?? [], [backupsQuery.data]);
  const selectedBackupLabel = restoreState.selected
    ? formatBackupDate(restoreState.selected.created_at)
    : "";
  const isFatal = fatalRestoreMessage !== null;
  const isBusy = isCreatingBackup || isUpdatingSetting || isRunningPreBackup || isRestoring;
  const controlsDisabled = isFatal || isBusy;

  const backupRows = useMemo(
    () =>
      backups.map((backup, index) => ({
        backup,
        displayDate: formatBackupDate(backup.created_at),
        displaySize: formatBackupSize(backup.size_bytes),
        isLatest: index === 0,
      })),
    [backups],
  );

  useEffect(() => {
    if (fatalRestoreMessage) return;

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          const created = await unwrapResult(commands.checkAutoBackup(), {
            source: "commands",
            cmd: "check_auto_backup",
          });
          if (created) {
            await queryClient.invalidateQueries({ queryKey: queryKeys.backupRestore.list() });
          }
        } catch {
          toast.error("自動バックアップ確認に失敗しました", { id: "backup-auto-check-error" });
        }
      })();
    }, 60_000);
    return () => {
      window.clearInterval(interval);
    };
  }, [fatalRestoreMessage, queryClient]);

  async function refetchBackupState() {
    await Promise.all([settingsQuery.refetch(), backupsQuery.refetch()]);
  }

  async function updateBackupSetting(key: string, value: string) {
    if (!BACKUP_SETTING_KEYS.has(key)) return;
    setIsUpdatingSetting(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await unwrapResult(commands.updateSetting({ key, value }), {
        source: "commands",
        cmd: "update_setting",
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backupRestore.settings() });
      if (key === "backup_path") {
        await queryClient.invalidateQueries({ queryKey: queryKeys.backupRestore.list() });
        await queryClient.invalidateQueries({ queryKey: queryKeys.backupRestore.effectiveDir() });
      }
      setStatusMessage("設定を保存しました");
      toast.success("バックアップ設定を保存しました");
    } catch (error) {
      setErrorMessage(describeError(error));
      toast.error("バックアップ設定を保存できませんでした");
    } finally {
      setIsUpdatingSetting(false);
    }
  }

  async function handleChooseBackupPath() {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || Array.isArray(selected)) return;
    await updateBackupSetting("backup_path", selected);
  }

  async function handleManualBackup() {
    setIsCreatingBackup(true);
    setManualBackupResult(null);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await unwrapResult(commands.createBackup(), {
        source: "commands",
        cmd: "create_backup",
      });
      setManualBackupResult(result);
      await queryClient.invalidateQueries({ queryKey: queryKeys.backupRestore.list() });
      setStatusMessage("バックアップを作成しました");
      toast.success("バックアップを作成しました");
    } catch (error) {
      setErrorMessage(describeError(error));
      toast.error("バックアップを作成できませんでした");
    } finally {
      setIsCreatingBackup(false);
    }
  }

  function selectRestoreBackup(backup: BackupInfo) {
    setErrorMessage(null);
    setStatusMessage(null);
    setRestoreState({
      selected: backup,
      preBackupFailed: false,
      breakGlassAccepted: false,
      confirmOpen: false,
    });
  }

  async function handleStartRestoreConfirmation() {
    if (!restoreState.selected) return;
    setIsRunningPreBackup(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await unwrapResult(commands.createBackup(), {
        source: "commands",
        cmd: "create_backup",
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.backupRestore.list() });
      setRestoreState((current) => ({ ...current, confirmOpen: true }));
    } catch (error) {
      setErrorMessage(describeError(error));
      setRestoreState((current) => ({
        ...current,
        preBackupFailed: true,
        breakGlassAccepted: false,
        confirmOpen: false,
      }));
    } finally {
      setIsRunningPreBackup(false);
    }
  }

  async function handleRestore() {
    if (!restoreState.selected) return;
    setIsRestoring(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setRestoreState((current) => ({ ...current, confirmOpen: false }));
    try {
      await unwrapResult(commands.restoreBackup({ backup_path: restoreState.selected.file_path }), {
        source: "commands",
        cmd: "restore_backup",
      });
      queryClient.clear();
      toast.success("バックアップから復元しました");
      void navigate({ to: "/" });
    } catch (error) {
      const message = describeError(error);
      if (isUnrecoverableRestoreError(message)) {
        setFatalRestoreMessage(message);
        setErrorMessage(null);
      } else {
        setErrorMessage(
          "バックアップの復元に失敗しました。現在のデータには戻しています。もう一度お試しください。",
        );
        await refetchBackupState();
      }
    } finally {
      setIsRestoring(false);
    }
  }

  const loadError = settingsQuery.isError || backupsQuery.isError;

  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader title="バックアップ・復元" />

      {fatalRestoreMessage ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>再起動が必要です</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>バックアップの復元に失敗し、DB接続の復旧もできませんでした。</p>
            <p className="font-medium">アプリを閉じて、もう一度開いてください</p>
          </AlertDescription>
        </Alert>
      ) : null}

      {statusMessage ? (
        <Alert className="text-success-strong border-success bg-success-soft">
          <CheckCircle2 />
          <AlertTitle>{statusMessage}</AlertTitle>
          <AlertDescription className="space-y-1">
            {manualBackupResult ? (
              <>
                <p>
                  {manualBackupResult.file_name}（{formatBackupSize(manualBackupResult.size_bytes)}
                  ）
                </p>
                <p className="text-sm break-all">保存先: {manualBackupResult.file_path}</p>
              </>
            ) : (
              <p>最新の状態を画面に反映しました。</p>
            )}
          </AlertDescription>
        </Alert>
      ) : null}

      {errorMessage ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>
            {restoreState.preBackupFailed
              ? "復元前のバックアップを作成できませんでした"
              : "操作に失敗しました"}
          </AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>バックアップ情報を取得できませんでした</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>設定とバックアップ一覧をもう一度読み込んでください。</p>
            <Button type="button" variant="outline" onClick={() => void refetchBackupState()}>
              <RotateCcw />
              再読込
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <fieldset disabled={controlsDisabled} className="space-y-6 disabled:opacity-70">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>バックアップ設定</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="backup-enabled"
                  checked={backupEnabled}
                  onCheckedChange={(checked) =>
                    void updateBackupSetting("backup_enabled", checked === true ? "1" : "0")
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="backup-enabled">自動バックアップを使う</Label>
                  <p className="text-sm text-muted-foreground">
                    指定時刻を過ぎたら 60 秒ごとの確認でバックアップを作成します。
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="backup-time">自動バックアップ時刻</Label>
                <Input
                  id="backup-time"
                  type="time"
                  defaultValue={backupTime}
                  onBlur={(event) =>
                    void updateBackupSetting("backup_time", event.currentTarget.value)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="backup-retention-days">保存日数</Label>
                <Input
                  id="backup-retention-days"
                  type="number"
                  min={1}
                  defaultValue={backupRetentionDays}
                  onBlur={(event) =>
                    void updateBackupSetting("backup_retention_days", event.currentTarget.value)
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                {effectiveBackupDirQuery.isSuccess ? (
                  <>
                    <p className="text-sm font-medium">現在の保存先</p>
                    <p className="rounded-md border bg-muted px-3 py-2 text-sm break-all text-muted-foreground">
                      {effectiveBackupDirQuery.data}
                    </p>
                    {backupPath ? null : (
                      <p className="text-xs text-muted-foreground">
                        保存先が未設定のためアプリ既定フォルダに保存されます
                      </p>
                    )}
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleChooseBackupPath()}
                >
                  <FolderOpen />
                  保存先を選ぶ
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>手動バックアップ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                今のデータを控えとして保存します。復元前にも自動で同じバックアップを作成します。
              </p>
              <Button type="button" onClick={() => void handleManualBackup()}>
                {isCreatingBackup ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}
                今すぐバックアップを作成
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <Card>
            <CardHeader>
              <CardTitle>バックアップ一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {settingsQuery.isLoading || backupsQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">読込み中です。</p>
              ) : null}

              {backupsQuery.isSuccess && backupRows.length === 0 ? (
                <div className="space-y-2 rounded-md border border-dashed p-4">
                  <p className="font-medium">まだバックアップはありません</p>
                  <p className="text-sm text-muted-foreground">
                    復元に使う控えを作るには、手動バックアップを実行してください。
                  </p>
                </div>
              ) : null}

              {backupRows.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>日時</TableHead>
                        <TableHead>サイズ</TableHead>
                        <TableHead>ファイル名</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {backupRows.map(({ backup, displayDate, displaySize, isLatest }) => (
                        <TableRow key={backup.file_path}>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{displayDate}</span>
                              {isLatest ? <Badge variant="secondary">最新</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums">{displaySize}</TableCell>
                          <TableCell className="max-w-[18rem] text-sm break-all text-muted-foreground">
                            {backup.file_name}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                selectRestoreBackup(backup);
                              }}
                              disabled={controlsDisabled}
                            >
                              この控えに戻す
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>復元</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {restoreState.selected ? (
                <>
                  <div className="space-y-2">
                    <p className="text-lg font-semibold">{selectedBackupLabel} の控え</p>
                    <p className="text-sm text-muted-foreground">
                      サイズ: {formatBackupSize(restoreState.selected.size_bytes)}
                    </p>
                    <p className="text-sm break-all text-muted-foreground">
                      {restoreState.selected.file_path}
                    </p>
                  </div>
                  <Alert className="border-warning bg-warning-soft text-warning-strong">
                    <AlertTriangle />
                    <AlertTitle>復元すると今の記録は戻せません</AlertTitle>
                    <AlertDescription>
                      この時点の状態に戻ります。この控えより後に記録した内容は消えます
                    </AlertDescription>
                  </Alert>
                  {restoreState.preBackupFailed ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="break-glass-restore"
                          checked={restoreState.breakGlassAccepted}
                          onCheckedChange={(checked) => {
                            setRestoreState((current) => ({
                              ...current,
                              breakGlassAccepted: checked === true,
                            }));
                          }}
                        />
                        <Label htmlFor="break-glass-restore">
                          今の状態は保存できませんが、復元を続けます
                        </Label>
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          setRestoreState((current) => ({ ...current, confirmOpen: true }));
                        }}
                        disabled={!restoreState.breakGlassAccepted || controlsDisabled}
                      >
                        最終確認へ進む
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleStartRestoreConfirmation()}
                      disabled={controlsDisabled}
                    >
                      {isRunningPreBackup ? <Loader2 className="animate-spin" /> : null}
                      復元の確認へ進む
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  一覧から戻したい控えを選ぶと、内容と確認手順を表示します。
                </p>
              )}
            </CardContent>
          </Card>
        </section>
      </fieldset>

      <RestoreConfirmDialog
        open={restoreState.confirmOpen}
        label={selectedBackupLabel}
        onOpenChange={(open) => {
          setRestoreState((current) => ({ ...current, confirmOpen: open }));
        }}
        onRestore={() => void handleRestore()}
      />
    </div>
  );
}

interface RestoreConfirmDialogProps {
  open: boolean;
  label: string;
  onOpenChange: (open: boolean) => void;
  onRestore: () => void;
}

function RestoreConfirmDialog({ open, label, onOpenChange, onRestore }: RestoreConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>元に戻せません</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              {label} の控えに戻します。この控えより後に記録した内容は消えます。
            </span>
            <span className="block">復元後、画面はホームに戻ります。</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(event) => {
              event.preventDefault();
              onRestore();
            }}
          >
            {label} の控えに戻す
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
