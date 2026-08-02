import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import type { CsvImportRecordDetail, MovementRecord } from "@/lib/bindings";
import { routeTree } from "@/routeTree.gen";
import { renderWithRouter } from "@/test/render-with-router";
import { CsvImportRecordDetailPage } from "./CsvImportRecordDetailPage";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ setTitle: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@/features/stock-movements/StockMovementsPage", async () => {
  const { MovementTable } = await vi.importActual<
    typeof import("@/features/stock-movements/components/MovementTable")
  >("@/features/stock-movements/components/MovementTable");
  return {
    StockMovementsPage: () => <MovementTable movements={[makeMovement()]} />,
  };
});

vi.mock("@/features/daily-report-import/DailyReportImportPage", () => ({
  DailyReportImportPage: () => <div>日報取込み初期画面</div>,
}));

vi.mock("@/features/csv-import/hooks/useCsvImportFlow", () => ({
  useCsvImportFlow: () => ({
    state: { status: "idle" },
    selectFile: vi.fn(),
    confirmImport: vi.fn(),
    rollback: vi.fn(),
    dismissError: vi.fn(),
    isParsing: false,
    isImporting: false,
    isRollingBack: false,
  }),
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    getCsvImportRecord: vi.fn(),
  },
}));

const mockGetCsvImportRecord = vi.mocked(commands.getCsvImportRecord);

function makeMovement(): MovementRecord {
  return {
    id: 501,
    product_code: "Z004",
    movement_type: "sale_auto",
    quantity: -2,
    stock_after: 8,
    reference_type: "csv_import",
    reference_id: 41,
    source: { label: "CSV取込み #41", route: "/csv-import/records/41" },
    note: null,
    created_at: "2026-08-03T10:11:12",
  };
}

function makeDetail(overrides: Partial<CsvImportRecordDetail> = {}): CsvImportRecordDetail {
  return {
    id: 41,
    filename: "synthetic-z004.csv",
    settlement_date: "2026-08-02",
    total_items: 1,
    total_amount: 880,
    skipped_count: 0,
    status: "completed",
    imported_at: "2026-08-03T10:11:12",
    items: [
      {
        id: 601,
        product_code: "Z004",
        product_name: "合成テスト商品",
        department_name: "テスト部門",
        stock_unit: "pcs",
        quantity: 2,
        amount: 880,
        is_voided: false,
      },
    ],
    error_rows: [],
    movements: [makeMovement()],
    ...overrides,
  };
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
}

function renderWithClient(ui: ReactNode, initialPath = "/") {
  return renderWithRouter(
    <QueryClientProvider client={makeQueryClient()}>{ui}</QueryClientProvider>,
    initialPath,
  );
}

beforeEach(() => {
  mockGetCsvImportRecord.mockReset();
});

describe("CsvImportRecordDetailPage (REQ-206 / REQ-207)", () => {
  it("REQ-401: /csv-import 直接進入で既存の取込み画面を描画する", async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/csv-import"] }),
    });
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "売上データ取込み" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "日報取込み" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("tab", { name: "商品別CSV取込み（Z004）" })).toBeInTheDocument();
  });

  it("REQ-206: completed のヘッダ・明細・movement・商品リンクを表示する", async () => {
    mockGetCsvImportRecord.mockResolvedValue({ status: "ok", data: makeDetail() });

    renderWithClient(<CsvImportRecordDetailPage importId={41} />);

    expect(await screen.findByRole("heading", { name: "CSV取込み #41" })).toBeInTheDocument();
    expect(screen.getByText("synthetic-z004.csv")).toBeInTheDocument();
    expect(screen.getByText("2026-08-02")).toBeInTheDocument();
    expect(screen.getByText("成功")).toBeInTheDocument();
    expect(screen.getAllByText("¥880")).toHaveLength(2);
    expect(screen.getAllByText("2026-08-03 10:11:12")).toHaveLength(2);

    const itemRow = screen.getByRole("row", { name: /Z004 合成テスト商品/ });
    expect(within(itemRow).getByText("テスト部門")).toBeInTheDocument();
    expect(within(itemRow).getByText("2 pcs")).toBeInTheDocument();
    expect(within(itemRow).getByText("有効")).toBeInTheDocument();
    expect(within(itemRow).getByRole("link", { name: "Z004 の在庫変動履歴" })).toHaveAttribute(
      "href",
      "/stock/Z004/movements",
    );
    expect(screen.getByRole("link", { name: "CSV取込み #41" })).toHaveAttribute(
      "href",
      "/csv-import/records/41",
    );
    expect(screen.getByText("取込みエラーはありません")).toBeInTheDocument();
  });

  it("REQ-206: completed_partial を正規化しエラー行を表示する", async () => {
    mockGetCsvImportRecord.mockResolvedValue({
      status: "ok",
      data: makeDetail({
        status: "completed_partial",
        skipped_count: 1,
        error_rows: [
          {
            line_no: 7,
            normalized_jan: "4900000000004",
            name: "合成エラー商品",
            raw_quantity: "abc",
            raw_amount: "440",
            error_type: "invalid_number",
            error_message: "数量を数値として解釈できません",
          },
        ],
      }),
    });

    renderWithClient(<CsvImportRecordDetailPage importId={41} />);

    expect(await screen.findByText("部分成功")).toBeInTheDocument();
    const errorRow = screen.getByRole("row", { name: /合成エラー商品/ });
    expect(within(errorRow).getByText("7")).toBeInTheDocument();
    expect(within(errorRow).getByText("4900000000004")).toBeInTheDocument();
    expect(within(errorRow).getByText("数値エラー")).toBeInTheDocument();
    expect(within(errorRow).getByText("数量を数値として解釈できません")).toBeInTheDocument();
  });

  it("REQ-207: movement の元記録をクリックすると詳細 route を描画する", async () => {
    mockGetCsvImportRecord.mockResolvedValue({ status: "ok", data: makeDetail() });
    const user = userEvent.setup();
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/stock/Z004/movements"] }),
    });
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    await user.click(await screen.findByRole("link", { name: "CSV取込み #41" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/csv-import/records/41");
    });
    await waitFor(() => {
      expect(mockGetCsvImportRecord).toHaveBeenCalledWith(41);
    });
    expect(await screen.findByRole("heading", { name: "CSV取込み #41" })).toBeInTheDocument();
  });

  it("REQ-206: NotFound を利用者向け日本語で表示する", async () => {
    mockGetCsvImportRecord.mockResolvedValue({
      status: "error",
      error: {
        kind: "not_found",
        message: "CSV取込み記録が見つかりません: 404",
        field: null,
        error_id: null,
      },
    });

    renderWithClient(<CsvImportRecordDetailPage importId={404} />);

    expect(await screen.findByText("CSV取込み記録が見つかりません: 404")).toBeInTheDocument();
    expect(
      screen.getByText("記録IDを確認するか、在庫変動履歴から開き直してください。"),
    ).toBeInTheDocument();
  });

  it("REQ-206: rolled_back は取消済み明細と movement 0 件を正常表示する", async () => {
    mockGetCsvImportRecord.mockResolvedValue({
      status: "ok",
      data: makeDetail({
        status: "rolled_back",
        items: makeDetail().items.map((item) => ({ ...item, is_voided: true })),
        movements: [],
      }),
    });

    renderWithClient(<CsvImportRecordDetailPage importId={41} />);

    expect(await screen.findByText("この取込みは取消済みです")).toBeInTheDocument();
    expect(screen.getByText("取消済み")).toBeInTheDocument();
    expect(screen.getByText("明細取消済み")).toBeInTheDocument();
    expect(screen.getByText("合成テスト商品")).toBeInTheDocument();
    expect(screen.getByText("関連する在庫変動がありません")).toBeInTheDocument();
  });

  it.each([
    ["/stock/Z004/movements?type=sale_pos&page=2", "/stock/Z004/movements?type=sale_pos&page=2"],
    ["https://example.invalid/escape", "/inventory/records"],
    ["//example.invalid/escape", "/inventory/records"],
  ])("REQ-207: returnTo %s の戻り先を安全に %s へ正規化する", async (returnTo, expected) => {
    mockGetCsvImportRecord.mockResolvedValue({ status: "ok", data: makeDetail() });

    renderWithClient(<CsvImportRecordDetailPage importId={41} returnTo={returnTo} />);

    expect(await screen.findByRole("link", { name: "前の画面へ戻る" })).toHaveAttribute(
      "href",
      expected,
    );
  });
});
