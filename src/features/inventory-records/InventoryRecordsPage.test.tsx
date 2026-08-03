import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import type { InventoryRecordSummary } from "@/lib/bindings";
import { renderWithRouter } from "@/test/render-with-router";
import { InventoryRecordsPage } from "./InventoryRecordsPage";
import type { InventoryRecordsSearch } from "./types";

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
  return renderWithRouter(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
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

afterEach(() => {
  vi.useRealTimers();
});

describe("InventoryRecordsPage (REQ-206)", () => {
  it("REQ-206: 記録種別フィルターで4種の業務記録を選べる", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });

    renderWithClient(<InventoryRecordsPage search={{}} onSearchChange={vi.fn()} />);

    const recordType = await screen.findByLabelText("記録種別");
    expect(
      Array.from(recordType.querySelectorAll("option"), (option) => ({
        value: option.value,
        label: option.textContent,
      })),
    ).toEqual([
      { value: "all", label: "すべて" },
      { value: "receiving_record", label: "入庫" },
      { value: "return_record", label: "返品・交換" },
      { value: "manual_sale", label: "手動販売出庫" },
      { value: "disposal_record", label: "廃棄・破損" },
    ]);
    const status = screen.getByLabelText("状態");
    expect(
      Array.from(status.querySelectorAll("option"), (option) => ({
        value: option.value,
        label: option.textContent,
      })),
    ).toEqual([
      { value: "all", label: "すべて" },
      { value: "active", label: "有効" },
    ]);
  });

  it("REQ-206: search stateからlistInventoryRecords queryを作り廃棄詳細へリンクする", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [makeRecord()], total_count: 1, page: 2, per_page: 20 },
    });
    const user = userEvent.setup();

    const { router } = renderWithClient(
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
    const detailLink = screen.getByRole("link", { name: "詳細を見る" });
    expect(detailLink).toHaveAttribute(
      "href",
      "/inventory/disposal/records/7?returnTo=%2Finventory%2Frecords%3FrecordType%3Ddisposal_record%26dateFrom%3D2026-06-01%26dateTo%3D2026-06-30%26q%3D%25E3%2583%259C%25E3%2582%25BF%25E3%2583%25B3%26recordId%3D7%26departmentId%3D2%26status%3Dactive%26page%3D2",
    );

    // C3/C4: href assertion だけでなく click による実 SPA 遷移を証明する
    // (X3 mutation: static/runtime 代表を生 <a> に戻した場合に red 化する)。
    await user.click(detailLink);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/inventory/disposal/records/7");
    });
    expect(router.state.location.search).toEqual({
      returnTo:
        "/inventory/records?recordType=disposal_record&dateFrom=2026-06-01&dateTo=2026-06-30&q=%E3%83%9C%E3%82%BF%E3%83%B3&recordId=7&departmentId=2&status=active&page=2",
    });
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

  it("REQ-206 / TRACE-D12: 商品検索を200ms後に反映しpageを1へ戻す", async () => {
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
    vi.useFakeTimers();
    fireEvent.change(keywordInput, { target: { value: "ボタン" } });

    expect(onSearchChange).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(onSearchChange).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    const updater = onSearchChange.mock.calls[0]?.[0] as (prev: {
      recordType?: string;
      q?: string;
      page?: number;
    }) => { recordType?: string; q?: string; page?: number };
    expect(updater({ recordType: "disposal_record", page: 2 })).toEqual({
      recordType: "disposal_record",
      q: "ボタン",
      page: 1,
    });
  });

  it("REQ-206 / TRACE-D12: Enterはdebounceを待たず商品検索を即時反映する", async () => {
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
    fireEvent.change(keywordInput, { target: { value: "ボタン" } });
    expect(onSearchChange).not.toHaveBeenCalled();

    fireEvent.keyDown(keywordInput, { key: "Enter" });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    const updater = onSearchChange.mock.calls[0]?.[0] as (prev: {
      recordType?: string;
      q?: string;
      page?: number;
    }) => { recordType?: string; q?: string; page?: number };
    expect(updater({ recordType: "disposal_record", page: 2 })).toEqual({
      recordType: "disposal_record",
      q: "ボタン",
      page: 1,
    });
  });

  it("REQ-206 / TRACE-D12: 商品検索のクリアでqを外しpageを1へ戻す", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 3, per_page: 20 },
    });
    const onSearchChange = vi.fn();

    renderWithClient(
      <InventoryRecordsPage search={{ q: "ボタン", page: 3 }} onSearchChange={onSearchChange} />,
    );

    const keywordInput = await screen.findByLabelText("商品検索");
    vi.useFakeTimers();
    fireEvent.change(keywordInput, { target: { value: "" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    const updater = onSearchChange.mock.calls[0]?.[0] as (
      prev: InventoryRecordsSearch,
    ) => InventoryRecordsSearch;
    expect(updater({ q: "ボタン", page: 3 })).toEqual({ q: undefined, page: 1 });
  });

  it("REQ-206 / TRACE-D12: IME変換確定Enterはflushせず確定後の最終文字列を反映する", async () => {
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
    vi.useFakeTimers();
    fireEvent.compositionStart(keywordInput);
    fireEvent.change(keywordInput, { target: { value: "ボタ" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    const intermediateUpdater = onSearchChange.mock.calls[0]?.[0] as (prev: {
      recordType?: string;
      q?: string;
      page?: number;
    }) => { recordType?: string; q?: string; page?: number };
    expect(intermediateUpdater({ recordType: "disposal_record", page: 2 }).q).toBe("ボタ");

    fireEvent.change(keywordInput, { target: { value: "ボタン" } });
    const composingEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(composingEnter, "isComposing", { value: true, configurable: true });
    keywordInput.dispatchEvent(composingEnter);

    expect(onSearchChange).toHaveBeenCalledTimes(1);
    fireEvent.compositionEnd(keywordInput);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(199);
    });
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(onSearchChange).toHaveBeenCalledTimes(2);
    const finalUpdater = onSearchChange.mock.calls[1]?.[0] as (prev: {
      recordType?: string;
      q?: string;
      page?: number;
    }) => { recordType?: string; q?: string; page?: number };
    expect(finalUpdater({ recordType: "disposal_record", page: 2 })).toEqual({
      recordType: "disposal_record",
      q: "ボタン",
      page: 1,
    });
  });

  it("REQ-206 / TRACE-D12: raw qの前後空白を入力表示に保持しqueryだけtrimする", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 2, per_page: 20 },
    });

    function Harness() {
      const [search, setSearch] = useState<InventoryRecordsSearch>({ page: 2 });
      return <InventoryRecordsPage search={search} onSearchChange={setSearch} />;
    }

    renderWithClient(<Harness />);
    const keywordInput = await screen.findByLabelText("商品検索");
    fireEvent.change(keywordInput, { target: { value: "  ボタン  " } });
    fireEvent.keyDown(keywordInput, { key: "Enter" });

    await waitFor(() => {
      expect(keywordInput).toHaveValue("  ボタン  ");
    });
    await waitFor(() => {
      expect(mockListInventoryRecords.mock.calls.map(([query]) => query.product_keyword)).toContain(
        "ボタン",
      );
    });
    expect(
      mockListInventoryRecords.mock.calls.map(([query]) => query.product_keyword),
    ).not.toContain("  ボタン  ");
  });

  it("REQ-206 / SPEC-UICB-6: live型既定の名前・placeholderを使い外付けlabelを持たない", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });

    renderWithClient(<InventoryRecordsPage search={{}} onSearchChange={vi.fn()} />);

    const keywordInput = await screen.findByLabelText("商品検索");
    expect(keywordInput).toHaveAttribute("type", "search");
    expect(keywordInput).toHaveAttribute("placeholder", "商品コード・商品名・JANで検索");
    expect(screen.queryByText("商品検索", { selector: "label" })).not.toBeInTheDocument();
    expect(keywordInput).not.toHaveAttribute("id");
  });
});

describe("InventoryRecordsPage SPEC-UIBB-1/2（filter-empty reset action、65 §65.8.1）", () => {
  it("SPEC-UIBB-1 絞り込み該当なしで解除ボタンを表示する", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });
    renderWithClient(<InventoryRecordsPage search={{ q: "該当なし" }} onSearchChange={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "絞り込みを解除" })).toBeInTheDocument();
  });

  it("SPEC-UIBB-1 既定条件の0件では解除ボタンを出さない", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });
    renderWithClient(<InventoryRecordsPage search={{}} onSearchChange={vi.fn()} />);
    expect(await screen.findByText("入出庫履歴がありません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "絞り込みを解除" })).not.toBeInTheDocument();
  });

  it("SPEC-UIBB-2 解除で全検索条件とpageが既定値に戻る", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 3, per_page: 20 },
    });
    const onSearchChange = vi.fn();
    renderWithClient(
      <InventoryRecordsPage
        search={{
          recordType: "disposal_record",
          dateFrom: "2026-07-01",
          dateTo: "2026-07-31",
          q: "ボタン",
          recordId: 7,
          departmentId: 2,
          status: "active",
          page: 3,
        }}
        onSearchChange={onSearchChange}
      />,
    );
    const resetButton = await screen.findByRole("button", { name: "絞り込みを解除" });
    await userEvent.setup().click(resetButton);

    const updater = onSearchChange.mock.calls[onSearchChange.mock.calls.length - 1]?.[0] as (
      prev: Record<string, unknown>,
    ) => Record<string, unknown>;
    const result = updater({
      recordType: "disposal_record",
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      q: "ボタン",
      recordId: 7,
      departmentId: 2,
      status: "active",
      page: 3,
    });
    expect(result).toEqual({
      recordType: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      q: undefined,
      recordId: undefined,
      departmentId: undefined,
      status: undefined,
      page: undefined,
    });
  });
});
