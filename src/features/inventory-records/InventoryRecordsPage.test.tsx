import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import type { InventoryRecordSummary } from "@/lib/bindings";
import { InventoryRecordsPage } from "./InventoryRecordsPage";

vi.mock("@/lib/bindings", () => ({
  commands: {
    listDepartments: vi.fn(),
    listInventoryRecords: vi.fn(),
  },
}));

const mockListDepartments = vi.mocked(commands.listDepartments);
const mockListInventoryRecords = vi.mocked(commands.listInventoryRecords);

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

function makeRecord(overrides: Partial<InventoryRecordSummary> = {}): InventoryRecordSummary {
  return {
    record_type: "disposal_record",
    record_id: 7,
    business_date: "2026-06-27",
    representative_item: "ボタン #02",
    item_count: 2,
    status: "active",
    created_at: "2026-06-27T10:30:00",
    detail_route: "/inventory/disposal/records/7",
    ...overrides,
  };
}

beforeEach(() => {
  mockListDepartments.mockReset();
  mockListInventoryRecords.mockReset();
  mockListDepartments.mockResolvedValue({
    status: "ok",
    data: [
      {
        id: 2,
        name: "ボタン",
        z005_name: "ボタン",
        code_prefix: "BT",
        next_seq: 1,
        created_at: "2026-06-27T10:00:00",
      },
    ],
  });
});

describe("InventoryRecordsPage (REQ-206)", () => {
  it("REQ-206: 記録種別フィルターで4種の業務記録を選べる", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });

    renderWithClient(<InventoryRecordsPage search={{}} onSearchChange={vi.fn()} />);

    const recordType = await screen.findByLabelText("記録種別");
    expect(recordType).toHaveTextContent("入庫");
    expect(recordType).toHaveTextContent("返品・交換");
    expect(recordType).toHaveTextContent("手動販売出庫");
    expect(recordType).toHaveTextContent("廃棄・破損");
  });

  it("REQ-206: search stateからlistInventoryRecords queryを作り廃棄詳細へリンクする", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [makeRecord()], total_count: 1, page: 2, per_page: 20 },
    });

    renderWithClient(
      <InventoryRecordsPage
        search={{
          recordType: "disposal_record",
          dateFrom: "2026-06-01",
          dateTo: "2026-06-30",
          q: "ボタン",
          recordId: 7,
          departmentId: 2,
          status: "active",
          page: 2,
        }}
        onSearchChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(mockListInventoryRecords).toHaveBeenCalledWith({
        record_type: "disposal_record",
        date_from: "2026-06-01",
        date_to: "2026-06-30",
        record_id: 7,
        product_keyword: "ボタン",
        department_id: 2,
        status: "active",
        page: 2,
        per_page: 20,
      });
    });
    expect(await screen.findByText("入出庫履歴")).toBeInTheDocument();
    expect(await screen.findByLabelText("部門")).toHaveValue("2");
    expect(screen.getByLabelText("記録ID")).toHaveValue(7);
    expect(screen.getByLabelText("状態")).toHaveValue("active");
    expect(screen.getAllByText("廃棄・破損").length).toBeGreaterThan(0);
    expect(screen.getByText("ボタン #02")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/disposal/records/7?returnTo=%2Finventory%2Frecords%3FrecordType%3Ddisposal_record%26dateFrom%3D2026-06-01%26dateTo%3D2026-06-30%26q%3D%25E3%2583%259C%25E3%2582%25BF%25E3%2583%25B3%26recordId%3D7%26departmentId%3D2%26status%3Dactive%26page%3D2",
    );
  });

  it("REQ-206: filter変更時はpageを1に戻す", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 3, per_page: 20 },
    });
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    renderWithClient(
      <InventoryRecordsPage
        search={{ recordType: "disposal_record", page: 3 }}
        onSearchChange={onSearchChange}
      />,
    );

    await user.selectOptions(await screen.findByLabelText("記録種別"), "all");

    const lastCall = onSearchChange.mock.calls[onSearchChange.mock.calls.length - 1] as [
      (prev: { recordType?: string; page?: number }) => { recordType?: string; page?: number },
    ];
    const updater = lastCall[0];
    expect(updater({ recordType: "disposal_record", page: 3 })).toEqual({
      recordType: "all",
      page: 1,
    });
  });

  it("REQ-206: 商品検索はIME合成中にURL検索条件を更新せず確定後に反映する", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 2, per_page: 20 },
    });
    const onSearchChange = vi.fn();

    renderWithClient(
      <InventoryRecordsPage
        search={{ recordType: "disposal_record", page: 2 }}
        onSearchChange={onSearchChange}
      />,
    );

    const keywordInput = await screen.findByLabelText("商品検索");
    fireEvent.compositionStart(keywordInput);
    fireEvent.change(keywordInput, { target: { value: "ボタン" } });

    expect(onSearchChange).not.toHaveBeenCalled();

    fireEvent.compositionEnd(keywordInput);

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    const lastCall = onSearchChange.mock.calls[0] as [
      (prev: { recordType?: string; q?: string; page?: number }) => {
        recordType?: string;
        q?: string;
        page?: number;
      },
    ];
    expect(lastCall[0]({ recordType: "disposal_record", page: 2 })).toEqual({
      recordType: "disposal_record",
      q: "ボタン",
      page: 1,
    });
  });
});
