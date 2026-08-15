// src/features/csv-import/hooks/useCsvImportFlow.ts
//
// UI-07 CSV取込み画面の reducer + 3 useMutation + useBlocker の中核 hook。
// 設計: docs/function-design/55-ui-csv-import.md §55.2 / §55.3 / §55.7

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useBlocker } from "@tanstack/react-router";
import { useCallback, useReducer } from "react";
import { toast } from "sonner";
import type { PickedFile } from "@/components/FilePicker";
import { commands, CSV_IMPORT_FILE_SIZE_LIMIT } from "@/lib/bindings";
import { invalidateByContract, invalidationContract } from "@/lib/invalidation-contract";
import { CMD_ERROR_KIND, InvokeError, isInvokeError, unwrapResult } from "@/lib/invoke";
import { csvImportReducer } from "../reducer";
import type { CsvImportState, ErrorRecoverTo } from "../types";

const INITIAL_STATE: CsvImportState = { status: "idle" };

/// CMD-07 と同じ防御的サイズ上限 (20MB)。
/// IPC ラウンドトリップ前に UI 側で早期 reject する (§55.2 File → Vec<u8> 変換)。
/// import_error 系は preview cache が消失している前提で idle に戻し、
/// それ以外 (validation / internal) は呼び元 state の文脈で preview に戻る。
/// 設計: 55-ui-csv-import.md §55.9 decideRecoverTo
function decideRecoverTo(error: InvokeError): ErrorRecoverTo {
  if (error.cmdError.kind === CMD_ERROR_KIND.IMPORT_ERROR) return "idle";
  return "preview";
}

/// 任意 error を InvokeError に正規化する (mutation onError は throw を受け取るので、
/// useMutation 経路で確実に InvokeError 化されているが、型システム上は unknown のため防御)。
function ensureInvokeError(error: unknown, cmd: string): InvokeError {
  if (isInvokeError(error)) return error;
  return new InvokeError(
    {
      kind: CMD_ERROR_KIND.INTERNAL,
      message: error instanceof Error ? error.message : String(error),
      field: null,
      error_id: null,
    },
    { source: "commands", cmd },
  );
}

export interface UseCsvImportFlowResult {
  state: CsvImportState;
  /// ファイル選択 / drag&drop からの取込み開始。20MB 超過時は Sonner トーストで reject。
  selectFile: (file: PickedFile) => void;
  /// プレビュー確認後の commit 実行。state.status === "preview" 前提。
  confirmImport: (additionalImportConfirmed: boolean) => void;
  /// 完了後の rollback 実行。state.status === "result" 前提。
  rollback: (csvImportId: number) => void;
  /// error variant からの復帰 (recoverTo に従い idle or preview に遷移)。
  dismissError: () => void;
  /// 任意 state からの強制初期化 (navigation 抜け道、ResultStep の「ホームに戻る」CTA 等)。
  reset: () => void;
  isParsing: boolean;
  isImporting: boolean;
  isRollingBack: boolean;
}

export function useCsvImportFlow(): UseCsvImportFlowResult {
  const [state, dispatch] = useReducer(csvImportReducer, INITIAL_STATE);
  const queryClient = useQueryClient();

  // §55.7 importing 中の常時 block + Tauri webview beforeunload 連動
  useBlocker({
    shouldBlockFn: () => state.status === "importing",
    enableBeforeUnload: () => state.status === "importing",
  });

  const parseAndValidate = useMutation({
    mutationFn: (args: { fileBytes: number[]; filename: string }) =>
      unwrapResult(commands.parseAndValidateCsv(args.fileBytes, args.filename), {
        source: "commands",
        cmd: "parse_and_validate_csv",
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
        error: ensureInvokeError(error, "parse_and_validate_csv"),
      });
    },
  });

  const commitImport = useMutation({
    mutationFn: (args: {
      previewToken: string;
      additionalImportConfirmed: boolean;
      // settlementDate は preview から拾って onSuccess の invalidation に渡す (§55.3)
      settlementDate: string;
    }) =>
      unwrapResult(commands.commitCsvImport(args.previewToken, args.additionalImportConfirmed), {
        source: "commands",
        cmd: "commit_csv_import",
      }),
    retry: 0,
    onSuccess: async (result, vars) => {
      dispatch({
        type: "import_succeeded",
        result,
        settlementDate: vars.settlementDate,
      });
      await invalidateByContract(queryClient, invalidationContract.csvImportCommit());
    },
    onError: (error: unknown) => {
      const e = ensureInvokeError(error, "commit_csv_import");
      dispatch({ type: "import_failed", error: e, recoverTo: decideRecoverTo(e) });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (args: { csvImportId: number; settlementDate: string }) =>
      unwrapResult(commands.rollbackCsvImport(args.csvImportId), {
        source: "commands",
        cmd: "rollback_csv_import",
      }),
    retry: 0,
    onSuccess: async () => {
      dispatch({ type: "rollback_succeeded" });
      toast.success("取込みを取り消しました");
      await invalidateByContract(queryClient, invalidationContract.csvImportRollback());
    },
    onError: () => {
      // §55.9 rollback 失敗の UX: トーストのみ + state 据え置き (result variant 維持して再試行可能)
      toast.error("取り消しに失敗しました。もう一度お試しください");
    },
  });

  const selectFile = useCallback(
    (file: PickedFile) => {
      if (file.size > CSV_IMPORT_FILE_SIZE_LIMIT) {
        toast.error("ファイルサイズが上限(20MB)を超えています");
        return;
      }
      const fileBytes = Array.from(file.bytes);
      dispatch({ type: "select_file", filename: file.filename });
      parseAndValidate.mutate({ fileBytes, filename: file.filename });
    },
    [parseAndValidate],
  );

  const confirmImport = useCallback(
    (additionalImportConfirmed: boolean) => {
      // §55.2 設計: confirm_import は preview state からのみ valid
      if (state.status !== "preview") return;
      const settlementDate = state.preview.file_info.settlement_date;
      dispatch({ type: "confirm_import", additionalImportConfirmed });
      commitImport.mutate({
        previewToken: state.previewToken,
        additionalImportConfirmed,
        settlementDate,
      });
    },
    [state, commitImport],
  );

  const rollback = useCallback(
    (csvImportId: number) => {
      // §55.2 設計: rollback は result state からのみ valid (settlementDate を pre-capture)
      if (state.status !== "result") return;
      rollbackMutation.mutate({
        csvImportId,
        settlementDate: state.settlementDate,
      });
    },
    [state, rollbackMutation],
  );

  const dismissError = useCallback(() => {
    dispatch({ type: "dismiss_error" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  return {
    state,
    selectFile,
    confirmImport,
    rollback,
    dismissError,
    reset,
    isParsing: parseAndValidate.isPending,
    isImporting: commitImport.isPending,
    isRollingBack: rollbackMutation.isPending,
  };
}
