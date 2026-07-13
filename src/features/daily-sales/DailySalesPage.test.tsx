// src/features/daily-sales/DailySalesPage.test.tsx

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import type { DailySalesReport } from "@/lib/bindings";

import { DailySalesPage } from "./DailySalesPage";

vi.mock("@/components/sales/TabsHeader", () => ({
  TabsHeader: () => null,
}));

vi.mock("./hooks/useExportDailySalesCsv", () => ({
  useExportDailySalesCsv: () => ({ exportCsv: vi.fn(), isExporting: false }),
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    getDailySales: vi.fn(),
  },
}));

const mockGetDailySales = vi.mocked(commands.getDailySales);

function buildReport(overrides: Partial<DailySalesReport> = {}): DailySalesReport {
  return {
    date: "2026-03-21",
    items: [],
    department_subtotals: [],
    grand_total: { quantity: 0, amount: 0 },
    official_daily_report: null,
    ...overrides,
  };
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <DailySalesPage search={{ date: "2026-03-21" }} onSearchChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetDailySales.mockResolvedValue({ status: "ok", data: buildReport() });
});

describe("DailySalesPage REQ-501 official daily report", () => {
  it("test_daily_sales_page_official_without_items_req501", async () => {
    mockGetDailySales.mockResolvedValue({
      status: "ok",
      data: buildReport({
        official_daily_report: {
          daily_report_import_id: 501,
          report_date: "2026-03-21",
          gross_amount: 12000,
          net_amount: 11000,
          payment_lines: [{ payment_key: "cash", label: "現金", amount: 11000, count: 7 }],
          department_lines: [
            {
              department_id: 1,
              raw_department_name: "その他小物",
              normalized_department_name: "その他小物",
              amount: 11000,
              quantity: 7,
              count: 3,
            },
          ],
          warnings: [],
        },
      }),
    });

    renderPage();

    expect(await screen.findByRole("heading", { name: "レジ日報（公式）" })).toBeInTheDocument();
    expect(await screen.findByText("総売上")).toBeInTheDocument();
    expect(screen.getAllByText("¥11,000").length).toBeGreaterThan(0);
    expect(screen.getByText("支払集計")).toBeInTheDocument();
    expect(screen.getByText("部門別集計")).toBeInTheDocument();
    expect(screen.getByText("商品別明細は未取込み")).toBeInTheDocument();
    expect(screen.queryByText("売上なし")).not.toBeInTheDocument();
  });

  it("test_daily_sales_page_no_official_note_req501", async () => {
    renderPage();

    expect(await screen.findByText("この日付のレジ日報は未取込みです。")).toBeInTheDocument();
    expect(screen.getByText("該当する売上明細がありません")).toBeInTheDocument();
  });

  it("test_daily_sales_page_official_warnings_note_req501", async () => {
    mockGetDailySales.mockResolvedValue({
      status: "ok",
      data: buildReport({
        official_daily_report: {
          daily_report_import_id: 501,
          report_date: "2026-03-21",
          gross_amount: 12000,
          net_amount: 11000,
          payment_lines: [],
          department_lines: [],
          warnings: ["部門マスタと対応していない部門が 1 件あります（部門名のまま表示しています）"],
        },
      }),
    });

    renderPage();

    expect(await screen.findByText("日報の部門確認が必要です")).toBeInTheDocument();
    expect(
      screen.getByText(
        "部門マスタと対応していない部門が 1 件あります（部門名のまま表示しています）",
      ),
    ).toBeInTheDocument();
  });
});
