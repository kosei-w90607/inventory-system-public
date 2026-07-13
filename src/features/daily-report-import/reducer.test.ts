import { describe, expect, it } from "vitest";
import type { DailyReportImportResult, DailyReportPreviewData } from "@/lib/bindings";
import type { InvokeError } from "@/lib/invoke";
import { dailyReportImportReducer } from "./reducer";
import type { DailyReportImportState } from "./types";

const preview = {} as DailyReportPreviewData;
const result = {} as DailyReportImportResult;
const error = {} as InvokeError;

describe("dailyReportImportReducer REQ-401", () => {
  it("test_daily_report_ui_req401_preview_to_importing_carries_snapshot", () => {
    const state: DailyReportImportState = {
      status: "preview",
      preview,
      previewToken: "token",
      filenames: ["Z001.csv", "Z002.csv", "Z005.csv"],
    };

    const next = dailyReportImportReducer(state, {
      type: "confirm_import",
      overwriteConfirmed: true,
    });

    expect(next).toEqual({
      status: "importing",
      preview,
      previewToken: "token",
      overwriteConfirmed: true,
      filenames: ["Z001.csv", "Z002.csv", "Z005.csv"],
    });
  });

  it("test_daily_report_ui_req401_import_failed_recovers_to_preview", () => {
    const state: DailyReportImportState = {
      status: "importing",
      preview,
      previewToken: "token",
      overwriteConfirmed: false,
      filenames: ["Z001.csv", "Z002.csv", "Z005.csv"],
    };

    const failed = dailyReportImportReducer(state, {
      type: "import_failed",
      error,
      recoverTo: "preview",
    });
    const recovered = dailyReportImportReducer(failed, { type: "dismiss_error" });

    expect(recovered.status).toBe("preview");
    if (recovered.status === "preview") {
      expect(recovered.preview).toBe(preview);
      expect(recovered.previewToken).toBe("token");
    }
  });

  it("test_daily_report_ui_req401_result_rollback_returns_idle", () => {
    const state: DailyReportImportState = {
      status: "result",
      result,
      reportDate: "2026-03-21",
    };
    expect(dailyReportImportReducer(state, { type: "rollback_succeeded" })).toEqual({
      status: "idle",
    });
  });

  it("test_daily_report_ui_req401_invalid_actions_keep_current_state", () => {
    const idle: DailyReportImportState = { status: "idle" };
    expect(
      dailyReportImportReducer(idle, {
        type: "confirm_import",
        overwriteConfirmed: false,
      }),
    ).toBe(idle);

    const previewState: DailyReportImportState = {
      status: "preview",
      preview,
      previewToken: "token",
      filenames: ["Z001.csv", "Z002.csv", "Z005.csv"],
    };
    expect(
      dailyReportImportReducer(previewState, {
        type: "rollback_succeeded",
      }),
    ).toBe(previewState);
  });
});
