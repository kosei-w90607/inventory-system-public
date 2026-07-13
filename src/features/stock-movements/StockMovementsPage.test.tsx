import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { commands } from "@/lib/bindings";
import type { MovementRecord, StockDetail } from "@/lib/bindings";
import { StockMovementsPage } from "./StockMovementsPage";

vi.mock("@/lib/bindings", () => ({
  commands: {
    getStockDetail: vi.fn(),
    listMovements: vi.fn(),
  },
}));

const mockGetStockDetail = vi.mocked(commands.getStockDetail);
const mockListMovements = vi.mocked(commands.listMovements);

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

function makeStockDetail(overrides: Partial<StockDetail> = {}): StockDetail {
  return {
    product: {
      product_code: "BT0002",
      jan_code: "4901234567890",
      name: "ボタン #02",
      department_id: 1,
      supplier_id: null,
      selling_price: 120,
      cost_price: 80,
      tax_rate: "10",
      maker_code: null,
      stock_quantity: 3,
      stock_unit: "pcs",
      is_discontinued: false,
      plu_dirty: false,
      plu_exported_at: null,
      plu_target: false,
      pos_stock_sync: true,
      created_at: "2026-01-01T10:00:00",
      updated_at: "2026-01-01T10:00:00",
      department_name: "ボタン",
      supplier_name: null,
    },
    last_receiving_date: "2026-06-01",
    last_sale_date: "2026-06-20",
    ...overrides,
  };
}

function makeMovement(overrides: Partial<MovementRecord> = {}): MovementRecord {
  return {
    id: 10,
    product_code: "BT0002",
    movement_type: "disposal",
    quantity: -1,
    stock_after: 3,
    reference_type: "disposal",
    reference_id: 7,
    source: { label: "廃棄・破損 #7", route: "/inventory/disposal/records/7" },
    note: "破損",
    created_at: "2026-06-27T10:11:12",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetStockDetail.mockReset();
  mockListMovements.mockReset();
});

describe("StockMovementsPage (UI-06c)", () => {
  it("REQ-303: URL searchからMovementQueryを作りlistMovementsを呼ぶ", async () => {
    mockGetStockDetail.mockResolvedValue({ status: "ok", data: makeStockDetail() });
    mockListMovements.mockResolvedValue({
      status: "ok",
      data: { items: [makeMovement()], total_count: 1, page: 2, per_page: 20 },
    });

    renderWithClient(
      <StockMovementsPage
        productCode="BT0002"
        search={{
          dateFrom: "2026-06-01",
          dateTo: "2026-06-30",
          type: "disposal",
          page: 2,
        }}
        onSearchChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockListMovements).toHaveBeenCalledWith({
        product_code: "BT0002",
        date_from: "2026-06-01",
        date_to: "2026-06-30",
        movement_type: "disposal",
        page: 2,
        per_page: 20,
      });
    });
    expect(await screen.findByText("ボタン #02")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "廃棄・破損 #7" })).toHaveAttribute(
      "href",
      "/inventory/disposal/records/7?returnTo=%2Fstock%2FBT0002%2Fmovements%3FdateFrom%3D2026-06-01%26dateTo%3D2026-06-30%26type%3Ddisposal%26page%3D2",
    );
  });

  it("REQ-303: 商品情報取得失敗でもmovement listを表示する", async () => {
    mockGetStockDetail.mockResolvedValue({
      status: "error",
      error: { kind: "not_found", message: "商品が見つかりません", field: null },
    });
    mockListMovements.mockResolvedValue({
      status: "ok",
      data: { items: [makeMovement()], total_count: 1, page: 1, per_page: 20 },
    });

    renderWithClient(
      <StockMovementsPage productCode="BT0002" search={{}} onSearchChange={vi.fn()} />,
    );

    await waitFor(
      () => {
        expect(screen.getByText("商品情報の取得に失敗しました")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText("廃棄・破損 #7")).toBeInTheDocument();
  });

  it("REQ-303: filter変更時はpageを1に戻す", async () => {
    mockGetStockDetail.mockResolvedValue({ status: "ok", data: makeStockDetail() });
    mockListMovements.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 3, per_page: 20 },
    });
    const onSearchChange = vi.fn();
    const user = userEvent.setup();

    renderWithClient(
      <StockMovementsPage
        productCode="BT0002"
        search={{ type: "all", page: 3 }}
        onSearchChange={onSearchChange}
      />,
    );

    await user.selectOptions(await screen.findByLabelText("種別"), "receiving");

    const lastCall = onSearchChange.mock.calls[onSearchChange.mock.calls.length - 1];
    const updater = lastCall[0] as (prev: { type?: string; page?: number }) => {
      type?: string;
      page?: number;
    };
    expect(updater({ type: "all", page: 3 })).toEqual({ type: "receiving", page: 1 });
  });
});
