import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import type {
  ManualSaleRecordDetail,
  ReceivingRecordDetail,
  ReturnRecordDetail,
} from "@/lib/bindings";
import { ManualSaleRecordDetailPage } from "./ManualSaleRecordDetailPage";
import { ReceivingRecordDetailPage } from "./ReceivingRecordDetailPage";
import { ReturnRecordDetailPage } from "./ReturnRecordDetailPage";

vi.mock("@/lib/bindings", () => ({
  commands: {
    getReceivingRecord: vi.fn(),
    getReturnRecord: vi.fn(),
    getManualSaleRecord: vi.fn(),
  },
}));

const mockGetReceivingRecord = vi.mocked(commands.getReceivingRecord);
const mockGetReturnRecord = vi.mocked(commands.getReturnRecord);
const mockGetManualSaleRecord = vi.mocked(commands.getManualSaleRecord);

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function makeReceivingDetail(): ReceivingRecordDetail {
  return {
    id: 12,
    receiving_date: "2026-06-27",
    supplier_id: 1,
    supplier_name: "テスト商事",
    note: "午前便",
    status: "active",
    created_at: "2026-06-27T09:00:00",
    total_cost: 1221,
    items: [
      {
        id: 1,
        product_code: "RCV-001",
        product_name: "入庫テスト商品 A",
        department_name: "毛糸",
        stock_unit: "個",
        quantity: 2,
        cost_price: 111,
        line_cost: 222,
      },
      {
        id: 2,
        product_code: "RCV-002",
        product_name: "入庫テスト商品 B",
        department_name: "ボタン",
        stock_unit: "個",
        quantity: 3,
        cost_price: 333,
        line_cost: 999,
      },
    ],
    movements: [
      {
        id: 101,
        product_code: "RCV-001",
        movement_type: "receiving",
        quantity: 2,
        stock_after: 12,
        reference_type: "receiving_record",
        reference_id: 12,
        source: { label: "入庫 #12", route: "/inventory/receiving/records/12" },
        note: null,
        created_at: "2026-06-27T09:00:00",
      },
    ],
  };
}

function makeReturnDetail(): ReturnRecordDetail {
  return {
    id: 22,
    return_type: "exchange",
    return_date: "2026-06-27",
    register_processed: false,
    receipt_image_path: "receipts/20260627.png",
    note: "サイズ交換",
    status: "active",
    created_at: "2026-06-27T10:00:00",
    items: [
      {
        id: 1,
        product_code: "RTN-001",
        product_name: "返品テスト商品",
        department_name: "ボタン",
        stock_unit: "個",
        direction: "in",
        quantity: 1,
      },
    ],
    movements: [
      {
        id: 201,
        product_code: "RTN-001",
        movement_type: "return",
        quantity: 1,
        stock_after: 6,
        reference_type: "return_record",
        reference_id: 22,
        source: { label: "返品・交換 #22", route: "/inventory/return/records/22" },
        note: null,
        created_at: "2026-06-27T10:00:00",
      },
    ],
  };
}

function makeManualSaleDetail(): ManualSaleRecordDetail {
  return {
    id: 32,
    sale_date: "2026-06-27",
    reason: "plu_unregistered",
    note: "店頭販売",
    status: "active",
    created_at: "2026-06-27T11:00:00",
    total_amount: 980,
    items: [
      {
        id: 1,
        product_code: "MS-001",
        product_name: "手動販売テスト商品",
        department_name: "布",
        stock_unit: "個",
        quantity: 1,
        amount: 980,
      },
    ],
    movements: [
      {
        id: 301,
        product_code: "MS-001",
        movement_type: "manual_sale",
        quantity: -1,
        stock_after: 4,
        reference_type: "manual_sale",
        reference_id: 32,
        source: { label: "手動販売 #32", route: "/inventory/manual-sale/records/32" },
        note: null,
        created_at: "2026-06-27T11:00:00",
      },
    ],
  };
}

beforeEach(() => {
  mockGetReceivingRecord.mockReset();
  mockGetReturnRecord.mockReset();
  mockGetManualSaleRecord.mockReset();
});

describe("other inventory record detail pages (REQ-201 / REQ-202 / REQ-203 / REQ-206)", () => {
  it("REQ-201: 入庫記録詳細に明細、原価合計、関連movementを表示する", async () => {
    mockGetReceivingRecord.mockResolvedValue({ status: "ok", data: makeReceivingDetail() });

    renderWithClient(
      <ReceivingRecordDetailPage
        recordId={12}
        returnTo="/inventory/records?recordType=receiving_record"
      />,
    );

    expect(await screen.findByRole("heading", { name: "入庫記録 #12" })).toBeInTheDocument();
    expect(screen.getByText("テスト商事")).toBeInTheDocument();
    expect(screen.getByText("¥1,221")).toBeInTheDocument();
    const firstItem = screen.getByRole("row", { name: /RCV-001/ });
    expect(within(firstItem).getByText("入庫テスト商品 A")).toBeInTheDocument();
    expect(within(firstItem).getByText("¥111")).toBeInTheDocument();
    expect(within(firstItem).getByText("¥222")).toBeInTheDocument();
    const secondItem = screen.getByRole("row", { name: /RCV-002/ });
    expect(within(secondItem).getByText("入庫テスト商品 B")).toBeInTheDocument();
    expect(within(secondItem).getByText("¥333")).toBeInTheDocument();
    expect(within(secondItem).getByText("¥999")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "RCV-001 の在庫変動履歴" })).toHaveAttribute(
      "href",
      "/stock/RCV-001/movements",
    );
    expect(screen.getByRole("link", { name: "前の画面へ戻る" })).toHaveAttribute(
      "href",
      "/inventory/records?recordType=receiving_record",
    );
  });

  it("REQ-202: 返品・交換詳細にレジ戻し状態、レシート有無、方向付き明細を表示する", async () => {
    mockGetReturnRecord.mockResolvedValue({ status: "ok", data: makeReturnDetail() });

    renderWithClient(<ReturnRecordDetailPage recordId={22} />);

    expect(await screen.findByRole("heading", { name: "返品・交換 #22" })).toBeInTheDocument();
    expect(screen.getByText("交換")).toBeInTheDocument();
    expect(screen.getByText("レジ未処理（この保存で反映）")).toBeInTheDocument();
    expect(screen.getByText("レシート画像")).toBeInTheDocument();
    expect(screen.getByText("添付あり")).toBeInTheDocument();
    const noteRegion = screen.getByRole("region", { name: "備考" });
    expect(within(noteRegion).getByText("サイズ交換")).toBeInTheDocument();
    expect(screen.getByText("戻り（在庫+）")).toBeInTheDocument();
    expect(screen.getByText("返品テスト商品")).toBeInTheDocument();
  });

  it("REQ-202/UI-03-D19: 返品・交換詳細は備考なしを独立表示する", async () => {
    mockGetReturnRecord.mockResolvedValue({
      status: "ok",
      data: { ...makeReturnDetail(), note: null },
    });

    renderWithClient(<ReturnRecordDetailPage recordId={22} />);

    expect(await screen.findByRole("heading", { name: "返品・交換 #22" })).toBeInTheDocument();
    const noteRegion = screen.getByRole("region", { name: "備考" });
    expect(within(noteRegion).getByText("備考なし")).toBeInTheDocument();
  });

  it("REQ-203: 手動販売詳細に販売金額合計、日次売上リンク、関連movementを表示する", async () => {
    mockGetManualSaleRecord.mockResolvedValue({ status: "ok", data: makeManualSaleDetail() });

    renderWithClient(<ManualSaleRecordDetailPage recordId={32} />);

    expect(await screen.findByRole("heading", { name: "手動販売出庫 #32" })).toBeInTheDocument();
    expect(screen.getByText("PLU未登録商品の販売")).toBeInTheDocument();
    expect(screen.getAllByText("¥980").length).toBeGreaterThan(0);
    expect(screen.getByText("手動販売テスト商品")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "日次売上で確認" })).toHaveAttribute(
      "href",
      "/reports/daily?date=2026-06-27",
    );
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText("減少")).toBeInTheDocument();
  });
});
