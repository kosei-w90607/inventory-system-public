import type { DailyReportImportResult, DailyReportPreviewData } from "@/lib/bindings";
import type { InvokeError } from "@/lib/invoke";

export type DailyReportErrorRecoverTo = "idle" | "preview";

export type DailyReportImportState =
  | { status: "idle" }
  | { status: "parsing"; filenames: string[] }
  | {
      status: "preview";
      preview: DailyReportPreviewData;
      previewToken: string;
      filenames: string[];
    }
  | {
      status: "importing";
      preview: DailyReportPreviewData;
      previewToken: string;
      overwriteConfirmed: boolean;
      filenames: string[];
    }
  | { status: "result"; result: DailyReportImportResult; reportDate: string }
  | {
      status: "error";
      error: InvokeError;
      recoverTo: DailyReportErrorRecoverTo;
      previousState: DailyReportImportState;
    };

export type DailyReportImportAction =
  | { type: "select_files"; filenames: string[] }
  | { type: "parse_succeeded"; preview: DailyReportPreviewData; previewToken: string }
  | { type: "parse_failed"; error: InvokeError }
  | { type: "confirm_import"; overwriteConfirmed: boolean }
  | { type: "import_succeeded"; result: DailyReportImportResult; reportDate: string }
  | { type: "import_failed"; error: InvokeError; recoverTo: DailyReportErrorRecoverTo }
  | { type: "dismiss_error" }
  | { type: "rollback_succeeded" }
  | { type: "reset" };
