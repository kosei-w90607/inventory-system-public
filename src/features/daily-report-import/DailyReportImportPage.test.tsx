import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DailyReportImportResult, DailyReportPreviewData } from "@/lib/bindings";
import { DailyReportImportPage } from "./DailyReportImportPage";
import { useDailyReportImportFlow } from "./hooks/useDailyReportImportFlow";
import type { DailyReportImportState } from "./types";

vi.mock("./hooks/useDailyReportImportFlow", () => ({
  useDailyReportImportFlow: vi.fn(),
}));

const mockUseFlow = vi.mocked(useDailyReportImportFlow);
const selectFiles = vi.fn();
const chooseFiles = vi.fn();
const confirmImport = vi.fn();
const rollback = vi.fn();
const dismissError = vi.fn();
const reset = vi.fn();

function makePreview(
  status: DailyReportPreviewData["duplicate_check"]["status"],
): DailyReportPreviewData {
  return {
    file_info: {
      report_date: "2026-03-21",
      bundle_hash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      source_files: [
        { source: "Z001", filename: "Z001_260321.CSV", file_hash: "1".repeat(64), size_bytes: 10 },
        { source: "Z002", filename: "Z002_260321.CSV", file_hash: "2".repeat(64), size_bytes: 10 },
        { source: "Z005", filename: "Z005_260321.CSV", file_hash: "3".repeat(64), size_bytes: 10 },
      ],
    },
    totals: { gross_amount: 12000, net_amount: 11000 },
    payment_summary: [
      { payment_key: "cash", label: "現金", amount: 11000, count: 7, sort_order: 1 },
    ],
    department_summary: [
      {
        department_id: null,
        raw_department_name: "未対応部門",
        normalized_department_name: null,
        amount: 8000,
        quantity: 5,
        count: 3,
        sort_order: 1,
      },
    ],
    warnings: [
      {
        code: "unmatched_department",
        message: "未対応部門は部門マスタにありません",
        source_file: "Z005",
        line_no: 12,
      },
    ],
    duplicate_check: { status, existing_import_id: status === "OverwriteRequired" ? 100 : null },
    preview_created_at: "2026-03-21T10:00:00",
  };
}

function makeResult(): DailyReportImportResult {
  return {
    daily_report_import_id: 501,
    status: "completed",
    report_date: "2026-03-21",
    gross_amount: 12000,
    net_amount: 11000,
    warning_count: 1,
  };
}

function setFlow(state: DailyReportImportState) {
  mockUseFlow.mockReturnValue({
    state: { ...state, lastSelectionError: null },
    selectFiles,
    chooseFiles,
    confirmImport,
    rollback,
    dismissError,
    reset,
    isParsing: false,
    isImporting: false,
    isRollingBack: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.style.pointerEvents = "";
});

describe("DailyReportImportPage_req401", () => {
  it("REQ-401: preview shows target date, totals, payment, department, and unmatched warning", () => {
    setFlow({
      status: "preview",
      preview: makePreview("NoDuplicate"),
      previewToken: "preview-token-req401",
      filenames: ["Z001_260321.CSV", "Z002_260321.CSV", "Z005_260321.CSV"],
    });

    render(<DailyReportImportPage />);

    expect(screen.getByText("取込み内容")).toBeInTheDocument();
    expect(screen.getByText("2026-03-21")).toBeInTheDocument();
    expect(screen.getByText("¥12,000")).toBeInTheDocument();
    expect(screen.getAllByText("¥11,000").length).toBeGreaterThan(0);
    expect(screen.getByText("現金")).toBeInTheDocument();
    expect(screen.getByText("未対応部門")).toBeInTheDocument();
    expect(screen.getByText("未対応部門は部門マスタにありません")).toBeInTheDocument();
  });

  it("REQ-401: overwrite preview requires explicit confirmation before import", async () => {
    const user = userEvent.setup();
    setFlow({
      status: "preview",
      preview: makePreview("OverwriteRequired"),
      previewToken: "preview-token-req401",
      filenames: ["Z001_260321.CSV", "Z002_260321.CSV", "Z005_260321.CSV"],
    });

    render(<DailyReportImportPage />);

    const importButton = screen.getByRole("button", { name: "取り込む" });
    expect(importButton).toBeDisabled();

    await user.click(screen.getByLabelText("同じ対象日の既存日報を取り消して上書きします"));
    expect(importButton).toBeEnabled();

    await user.click(importButton);
    expect(confirmImport).toHaveBeenCalledWith(true);
  });

  it("REQ-401: already imported preview shows a page-level alert and opens native reselect dialog", async () => {
    const user = userEvent.setup();
    setFlow({
      status: "preview",
      preview: makePreview("AlreadyImported"),
      previewToken: "preview-token-req401",
      filenames: ["Z001_260321.CSV", "Z002_260321.CSV", "Z005_260321.CSV"],
    });

    render(<DailyReportImportPage />);

    expect(
      screen.getByText("この日報は取込み済みです。二重取込みはできません。"),
    ).toBeInTheDocument();
    expect(screen.getByText("別の日報ファイルを選び直してください。")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "ファイルを選び直す" }));
    expect(chooseFiles).toHaveBeenCalledTimes(1);
    expect(selectFiles).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Z001 Z002 Z005 ファイルを選び直す")).not.toBeInTheDocument();
  });

  it("REQ-401: overwrite required preview shows a page-level warning alert", () => {
    setFlow({
      status: "preview",
      preview: makePreview("OverwriteRequired"),
      previewToken: "preview-token-req401",
      filenames: ["Z001_260321.CSV", "Z002_260321.CSV", "Z005_260321.CSV"],
    });

    render(<DailyReportImportPage />);

    expect(screen.getByText("同じ対象日の日報があります")).toBeInTheDocument();
    expect(screen.getByText("取り込むには上書き確認にチェックしてください。")).toBeInTheDocument();
  });

  it("REQ-401: result rollback cancel does not call rollback and states stock is unchanged", async () => {
    const user = userEvent.setup();
    setFlow({
      status: "result",
      result: makeResult(),
      reportDate: "2026-03-21",
    });

    render(<DailyReportImportPage />);

    expect(screen.getByText("日報取込み完了")).toBeInTheDocument();
    expect(screen.getByText("在庫数は変わりません")).toBeInTheDocument();
    expect(screen.getByText("取消しても在庫数は変わりません。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "日次売上を見る" })).toHaveAttribute(
      "href",
      "/reports/daily?date=2026-03-21",
    );

    await user.click(screen.getByRole("button", { name: "取り消す" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("日報取込みを取り消しますか？")).toBeInTheDocument();
    expect(
      screen.getByText("ID 501 の日報取込みを取り消します。取消しても在庫数は変わりません。"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(rollback).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });

  it("REQ-401: result rollback confirm calls rollback only from the dialog action", async () => {
    const user = userEvent.setup();
    setFlow({
      status: "result",
      result: makeResult(),
      reportDate: "2026-03-21",
    });

    render(<DailyReportImportPage />);
    await user.click(screen.getByRole("button", { name: "取り消す" }));
    await waitFor(() => {
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
    const dialog = screen.getByRole("alertdialog");
    const action = dialog.querySelector('[data-slot="alert-dialog-action"]');
    expect(action).not.toBeNull();
    fireEvent.click(action as HTMLElement);
    expect(rollback).toHaveBeenCalledWith(501);
  });

  it("test_daily_report_result_cta_daily_sales_date_req501", () => {
    setFlow({
      status: "result",
      result: makeResult(),
      reportDate: "2026-03-21",
    });

    render(<DailyReportImportPage />);

    expect(screen.getByRole("link", { name: "日次売上を見る" })).toHaveAttribute(
      "href",
      "/reports/daily?date=2026-03-21",
    );
  });
});
