// UI-00 / UI-00-D11: HomePage から実 useHomeSummary までのmain wiring contract。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { commands } from "@/lib/bindings";
import type {
  CmdError,
  CsvImport,
  DailySalesReport,
  PaginatedResult,
  ProductResponse,
  ProductWithRelations,
} from "@/lib/bindings";
import { HomePage } from "./HomePage";

vi.mock("./components/QuickActionGrid", () => ({ QuickActionGrid: () => null }));
vi.mock("./components/InventoryActionGrid", () => ({ InventoryActionGrid: () => null }));
vi.mock("./components/MiscActionRow", () => ({ MiscActionRow: () => null }));
vi.mock("./components/PluNotificationBar", () => ({ PluNotificationBar: () => null }));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    getDailySales: vi.fn(),
    listLowStock: vi.fn(),
    listPluDirty: vi.fn(),
    listCsvImports: vi.fn(),
  },
}));

const mockGetDailySales = vi.mocked(commands.getDailySales);
const mockListLowStock = vi.mocked(commands.listLowStock);
const mockListPluDirty = vi.mocked(commands.listPluDirty);
const mockListCsvImports = vi.mocked(commands.listCsvImports);
const mockToastError = vi.mocked(toast.error);

const syntheticError: CmdError = {
  kind: "internal",
  message: "synthetic query failure",
  field: null,
  error_id: "E-SYNTHETIC",
};

function makeDailySales(): DailySalesReport {
  return {
    date: "2026-07-28",
    items: [],
    department_subtotals: [],
    grand_total: { quantity: 4, amount: 12000 },
    official_daily_report: null,
  };
}

function makeProduct(productCode: string, stockQuantity: number): ProductWithRelations {
  return {
    product_code: productCode,
    jan_code: null,
    name: `synthetic-${productCode}`,
    department_id: 1,
    supplier_id: null,
    selling_price: 100,
    cost_price: 50,
    tax_rate: "10",
    maker_code: null,
    stock_quantity: stockQuantity,
    stock_unit: "pcs",
    is_discontinued: false,
    plu_dirty: false,
    plu_exported_at: null,
    plu_target: false,
    pos_stock_sync: true,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    department_name: "synthetic-department",
    supplier_name: null,
  };
}

function makePluDirty(): ProductResponse {
  return {
    product_code: "PLU-1",
    jan_code: null,
    name: "synthetic-PLU-1",
    department_id: 1,
    selling_price: 100,
    cost_price: 50,
    stock_quantity: 1,
    plu_dirty: true,
    plu_exported_at: null,
  };
}

function makeCsvImport(settlementDate: string): CsvImport {
  return {
    id: 1,
    filename: "synthetic.csv",
    settlement_date: settlementDate,
    file_hash: "b".repeat(64),
    total_items: 1,
    total_amount: 100,
    skipped_count: 0,
    status: "completed",
    imported_at: "2026-01-01T00:00:00",
  };
}

function csvPage(items: CsvImport[]): PaginatedResult<CsvImport> {
  return { items, total_count: items.length, page: 1, per_page: 1 };
}

function installSuccessfulCommands() {
  mockGetDailySales.mockResolvedValue({ status: "ok", data: makeDailySales() });
  mockListLowStock.mockResolvedValue({
    status: "ok",
    data: [makeProduct("OUT", 0), makeProduct("LOW", 3)],
  });
  mockListPluDirty.mockResolvedValue({ status: "ok", data: [makePluDirty()] });
  mockListCsvImports.mockResolvedValue({
    status: "ok",
    data: csvPage([makeCsvImport("2000-01-01")]),
  });
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <HomePage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  installSuccessfulCommands();
});

describe("HomePage UI-00 orchestration wiring", () => {
  it("renders the stale-import warning and healthy summary from real query results", async () => {
    renderPage();

    expect(await screen.findByText("前日分が未取込みです")).toBeInTheDocument();
    expect(screen.getByText("最後の取込み精算日: 2000-01-01")).toBeInTheDocument();
    expect(screen.getByText(/昨日の売上/)).toBeInTheDocument();
    expect(screen.getAllByText("1 件")).toHaveLength(2);
    expect(screen.getByText(/12[,，]?000/)).toBeInTheDocument();
  });

  it("reports a PLU failure without hiding healthy summary results", async () => {
    mockListPluDirty.mockResolvedValue({ status: "error", error: syntheticError });
    renderPage();

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("PLU 通知の取得に失敗しました", {
        id: "plu-dirty-error",
      });
    });
    expect(mockToastError).not.toHaveBeenCalledWith(
      "取込み履歴の取得に失敗しました",
      expect.anything(),
    );
    expect(await screen.findByText(/昨日の売上/)).toBeInTheDocument();
    expect(screen.getByText("在庫切れ")).toBeInTheDocument();
  });

  it("reports an import-history failure independently and keeps healthy summaries", async () => {
    mockListCsvImports.mockResolvedValue({ status: "error", error: syntheticError });
    renderPage();

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("取込み履歴の取得に失敗しました", {
        id: "csv-imports-error",
      });
    });
    expect(mockToastError).not.toHaveBeenCalledWith(
      "PLU 通知の取得に失敗しました",
      expect.anything(),
    );
    expect(screen.queryByText("前日分が未取込みです")).not.toBeInTheDocument();
    expect(await screen.findByText(/昨日の売上/)).toBeInTheDocument();
    expect(screen.getByText("在庫少")).toBeInTheDocument();
  });
});
