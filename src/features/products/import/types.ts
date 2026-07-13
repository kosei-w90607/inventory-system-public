import type { ImportPreview, ImportRow, ProductImportResult } from "@/lib/bindings";
import type { InvokeError } from "@/lib/invoke";

export type ProductImportRecoverTo = "idle" | "preview";

export type ProductImportState =
  | { status: "idle" }
  | { status: "previewing"; filename: string }
  | {
      status: "preview";
      filename: string;
      preview: ImportPreview;
      overwriteCodes: string[];
    }
  | {
      status: "committing";
      filename: string;
      preview: ImportPreview;
      overwriteCodes: string[];
      targetRows: ImportRow[];
    }
  | { status: "result"; result: ProductImportResult }
  | {
      status: "error";
      error: InvokeError;
      recoverTo: ProductImportRecoverTo;
      previousState: ProductImportState;
    };

export type ProductImportAction =
  | { type: "select_file"; filename: string }
  | { type: "preview_succeeded"; preview: ImportPreview }
  | { type: "preview_failed"; error: InvokeError }
  | { type: "toggle_overwrite"; productCode: string; checked: boolean }
  | { type: "commit_requested"; targetRows: ImportRow[] }
  | { type: "commit_succeeded"; result: ProductImportResult }
  | { type: "commit_failed"; error: InvokeError; recoverTo: ProductImportRecoverTo }
  | { type: "dismiss_error" }
  | { type: "reset" };
