import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useReducer, useState } from "react";
import { toast } from "sonner";
import { commands } from "@/lib/bindings";
import { CMD_ERROR_KIND, InvokeError, isInvokeError, unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { dailyReportImportReducer } from "../reducer";
import type { DailyReportErrorRecoverTo, DailyReportImportState } from "../types";

const INITIAL_STATE: DailyReportImportState = { status: "idle" };
const FILE_SIZE_LIMIT_BYTES = 20 * 1024 * 1024;

interface DailyReportClientFile {
  filename: string;
  size: number;
  readBytes: () => Promise<Uint8Array>;
}

function ensureInvokeError(error: unknown, cmd: string): InvokeError {
  if (isInvokeError(error)) return error;
  return new InvokeError(
    {
      kind: CMD_ERROR_KIND.INTERNAL,
      message: error instanceof Error ? error.message : String(error),
      field: null,
    },
    { source: "commands", cmd },
  );
}

function decideRecoverTo(error: InvokeError): DailyReportErrorRecoverTo {
  if (error.cmdError.kind === CMD_ERROR_KIND.IMPORT_ERROR) return "idle";
  return "preview";
}

function filenameFromPath(path: string) {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}

export const DAILY_REPORT_LAST_DIR_STORAGE_KEY = "inventory:daily-report-import:last-dir:v1";

function dirnameFromPath(path: string): string | null {
  const index = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  if (index <= 0) return null;
  return path.slice(0, index);
}

function readLastSelectedDir(): string | null {
  try {
    // localStorage can be unavailable in restricted WebView contexts.
    return window.localStorage.getItem(DAILY_REPORT_LAST_DIR_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveLastSelectedDir(path: string) {
  const dir = dirnameFromPath(path);
  if (dir === null) return;
  try {
    window.localStorage.setItem(DAILY_REPORT_LAST_DIR_STORAGE_KEY, dir);
  } catch {
    // 記憶できなくても選択フロー本体は継続する。
  }
}

function selectionCountError(count: number) {
  return `Z001/Z002/Z005 の3ファイルを選択してください（選択されたのは${String(count)}ファイルです）`;
}

export function useDailyReportImportFlow() {
  const [state, dispatch] = useReducer(dailyReportImportReducer, INITIAL_STATE);
  const [lastSelectionError, setLastSelectionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useBlocker({
    shouldBlockFn: () => state.status === "importing",
    enableBeforeUnload: () => state.status === "importing",
  });

  const parseMutation = useMutation({
    mutationFn: (files: { filename: string; file_bytes: number[] }[]) =>
      unwrapResult(commands.parseAndValidateDailyReport(files), {
        source: "commands",
        cmd: "parse_and_validate_daily_report",
      }),
    retry: 0,
    onSuccess: (data) => {
      dispatch({
        type: "parse_succeeded",
        preview: data.preview_data,
        previewToken: data.preview_token,
      });
    },
    onError: (error: unknown) => {
      dispatch({
        type: "parse_failed",
        error: ensureInvokeError(error, "parse_and_validate_daily_report"),
      });
    },
  });

  const commitMutation = useMutation({
    mutationFn: (args: { previewToken: string; overwriteConfirmed: boolean; reportDate: string }) =>
      unwrapResult(commands.commitDailyReportImport(args.previewToken, args.overwriteConfirmed), {
        source: "commands",
        cmd: "commit_daily_report_import",
      }),
    retry: 0,
    onSuccess: async (result, vars) => {
      dispatch({ type: "import_succeeded", result, reportDate: vars.reportDate });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyReportImportLists() }),
        queryClient.invalidateQueries({ queryKey: ["daily-sales"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.monthlySalesRoot() }),
      ]);
    },
    onError: (error: unknown) => {
      const e = ensureInvokeError(error, "commit_daily_report_import");
      dispatch({ type: "import_failed", error: e, recoverTo: decideRecoverTo(e) });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (dailyReportImportId: number) =>
      unwrapResult(commands.rollbackDailyReportImport(dailyReportImportId), {
        source: "commands",
        cmd: "rollback_daily_report_import",
      }),
    retry: 0,
    onSuccess: async () => {
      dispatch({ type: "rollback_succeeded" });
      toast.success("日報取込みを取り消しました");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dailyReportImportLists() }),
        queryClient.invalidateQueries({ queryKey: ["daily-sales"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.monthlySalesRoot() }),
      ]);
    },
    onError: () => {
      toast.error("取り消しに失敗しました。もう一度お試しください");
    },
  });

  const selectClientFiles = useCallback(
    async (files: DailyReportClientFile[]) => {
      if (files.length !== 3) {
        setLastSelectionError(selectionCountError(files.length));
        toast.error("Z001/Z002/Z005 の3ファイルを選択してください");
        return;
      }
      if (files.some((file) => file.size > FILE_SIZE_LIMIT_BYTES)) {
        setLastSelectionError("ファイルサイズが上限(20MB)を超えています");
        toast.error("ファイルサイズが上限(20MB)を超えています");
        return;
      }
      const filenames = files.map((file) => file.filename);
      setLastSelectionError(null);
      dispatch({ type: "select_files", filenames });
      const payload = await Promise.all(
        files.map(async (file) => ({
          filename: file.filename,
          file_bytes: Array.from(await file.readBytes()),
        })),
      );
      parseMutation.mutate(payload);
    },
    [parseMutation],
  );

  const selectFiles = useCallback(
    async (files: File[]) => {
      await selectClientFiles(
        files.map((file) => ({
          filename: file.name,
          size: file.size,
          readBytes: async () => new Uint8Array(await file.arrayBuffer()),
        })),
      );
    },
    [selectClientFiles],
  );

  const chooseFiles = useCallback(async () => {
    setLastSelectionError(null);
    try {
      const selected = await open({
        multiple: true,
        defaultPath: readLastSelectedDir() ?? undefined,
        filters: [{ name: "CSV", extensions: ["csv", "CSV"] }],
      });
      if (selected === null) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      // 件数チェックより先に記憶する（選び直しでも直前フォルダから開けるように）。
      if (paths.length > 0) saveLastSelectedDir(paths[0]);
      if (paths.length !== 3) {
        setLastSelectionError(selectionCountError(paths.length));
        toast.error("Z001/Z002/Z005 の3ファイルを選択してください");
        return;
      }
      const files = await Promise.all(
        paths.map(async (path) => {
          const bytes = await readFile(path);
          return {
            filename: filenameFromPath(path),
            size: bytes.byteLength,
            readBytes: () => Promise.resolve(bytes),
          };
        }),
      );
      await selectClientFiles(files);
    } catch {
      setLastSelectionError("日報ファイルの選択または読み取りに失敗しました");
      toast.error("日報ファイルの選択または読み取りに失敗しました");
    }
  }, [selectClientFiles]);

  const confirmImport = useCallback(
    (overwriteConfirmed: boolean) => {
      if (state.status !== "preview") return;
      dispatch({ type: "confirm_import", overwriteConfirmed });
      commitMutation.mutate({
        previewToken: state.previewToken,
        overwriteConfirmed,
        reportDate: state.preview.file_info.report_date,
      });
    },
    [state, commitMutation],
  );

  const rollback = useCallback(
    (dailyReportImportId: number) => {
      if (state.status !== "result") return;
      rollbackMutation.mutate(dailyReportImportId);
    },
    [state, rollbackMutation],
  );

  const dismissError = useCallback(() => {
    dispatch({ type: "dismiss_error" });
  }, []);

  return {
    state: { ...state, lastSelectionError },
    selectFiles,
    chooseFiles,
    confirmImport,
    rollback,
    dismissError,
    reset: () => {
      dispatch({ type: "reset" });
    },
    isParsing: parseMutation.isPending,
    isImporting: commitMutation.isPending,
    isRollingBack: rollbackMutation.isPending,
  };
}
