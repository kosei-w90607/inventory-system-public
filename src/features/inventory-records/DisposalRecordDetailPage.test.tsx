import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import type { DisposalRecordDetail } from "@/lib/bindings";
import { DisposalRecordDetailPage } from "./DisposalRecordDetailPage";

vi.mock("@/lib/bindings", () => ({
  commands: {
    getDisposalRecord: vi.fn(),
  },
}));

const mockGetDisposalRecord = vi.mocked(commands.getDisposalRecord);

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function makeDetail(overrides: Partial<DisposalRecordDetail> = {}): DisposalRecordDetail {
  return {
    id: 7,
    disposal_date: "2026-06-27",
    status: "active",
    created_at: "2026-06-27T10:30:00",
    total_loss_cost: 480,
    items: [
      {
        id: 1,
        product_code: "DP-001",
        product_name: "破損ボタン",
        department_name: "ボタン",
        stock_unit: "pcs",
        disposal_type: "damage",
        quantity: 2,
        cost_price: 120,
        reason: "袋破れ",
        line_loss_cost: 240,
      },
      {
        id: 2,
        product_code: "DP-002",
        product_name: "期限切れ接着剤",
        department_name: "手芸等材料",
        stock_unit: "pcs",
        disposal_type: "disposal",
        quantity: 3,
        cost_price: 80,
        reason: "期限切れ",
        line_loss_cost: 240,
      },
    ],
    movements: [
      {
        id: 11,
        product_code: "DP-001",
        movement_type: "disposal",
        quantity: -2,
        stock_after: 8,
        reference_type: "disposal_record",
        reference_id: 7,
        source: { label: "廃棄・破損 #7", route: "/inventory/disposal/records/7" },
        note: "袋破れ",
        created_at: "2026-06-27T10:31:00",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  mockGetDisposalRecord.mockReset();
});

describe("DisposalRecordDetailPage (REQ-204 / REQ-206)", () => {
  it("REQ-204: 廃棄・破損詳細に明細、ロス原価合計、関連movementを表示する", async () => {
    mockGetDisposalRecord.mockResolvedValue({ status: "ok", data: makeDetail() });

    renderWithClient(<DisposalRecordDetailPage recordId={7} />);

    expect(await screen.findByRole("heading", { name: "廃棄・破損 #7" })).toBeInTheDocument();
    expect(screen.getByText("有効")).toBeInTheDocument();
    expect(screen.getByText("¥480")).toBeInTheDocument();
    expect(screen.getByText("破損ボタン")).toBeInTheDocument();
    expect(screen.getAllByText("袋破れ").length).toBeGreaterThan(0);
    expect(screen.getByText("期限切れ接着剤")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DP-001 の在庫変動履歴" })).toHaveAttribute(
      "href",
      "/stock/DP-001/movements",
    );
    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(screen.getByText("減少")).toBeInTheDocument();
  });

  it("REQ-206: 存在しない廃棄・破損詳細は戻り導線付きで表示する", async () => {
    mockGetDisposalRecord.mockResolvedValue({
      status: "error",
      error: { kind: "not_found", message: "廃棄・破損記録が見つかりません", field: null },
    });

    renderWithClient(<DisposalRecordDetailPage recordId={404} />);

    expect(await screen.findByText("廃棄・破損記録が見つかりません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前の画面へ戻る" })).toHaveAttribute(
      "href",
      "/inventory/records",
    );
  });

  it("REQ-207: returnToがある場合はmovement検索状態へ戻れる", async () => {
    mockGetDisposalRecord.mockResolvedValue({ status: "ok", data: makeDetail() });

    renderWithClient(
      <DisposalRecordDetailPage
        recordId={7}
        returnTo="/stock/DP-001/movements?type=disposal&page=2"
      />,
    );

    expect(await screen.findByRole("heading", { name: "廃棄・破損 #7" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "前の画面へ戻る" })).toHaveAttribute(
      "href",
      "/stock/DP-001/movements?type=disposal&page=2",
    );
  });
});
