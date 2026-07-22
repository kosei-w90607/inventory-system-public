import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import { OperationLogsPage } from "./OperationLogsPage";
import * as operationLogTypes from "./types";
import { normalizeOperationLogsSearch, type OperationLogsSearch } from "./types";

vi.mock("@/lib/bindings", () => ({
  commands: { listLogs: vi.fn(), listLogOperationTypes: vi.fn() },
}));
const listLogs = vi.mocked(commands.listLogs);
const listTypes = vi.mocked(commands.listLogOperationTypes);

type SearchChange = (updater: (previous: OperationLogsSearch) => OperationLogsSearch) => void;

function renderPage(search: OperationLogsSearch = {}, onSearchChange = vi.fn<SearchChange>()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <OperationLogsPage search={search} onSearchChange={onSearchChange} />
    </QueryClientProvider>,
  );
  return onSearchChange;
}

function renderStatefulPage(initialSearch: OperationLogsSearch = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function StatefulPage() {
    const [search, setSearch] = useState(initialSearch);
    return (
      <OperationLogsPage
        search={search}
        onSearchChange={(updater) => {
          setSearch(updater);
        }}
      />
    );
  }
  render(
    <QueryClientProvider client={client}>
      <StatefulPage />
    </QueryClientProvider>,
  );
}
const log = (
  detail_json: string | null = '{"product_code":"SYN-1","unknown_key":"<script>alert(1)</script>"}',
) => ({
  id: 1,
  operation_type: "future_type",
  summary: "合成ログ",
  detail_json,
  created_at: "2026-07-10T12:34:56",
});

beforeEach(() => {
  listLogs.mockReset();
  listTypes.mockReset();
  listTypes.mockResolvedValue({ status: "ok", data: ["backup_create", "future_type"] });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("UI-11c REQ-902", () => {
  it("normalizes the initial search to a JST calendar 30-day default", () => {
    expect(normalizeOperationLogsSearch({}, new Date("2026-07-11T12:00:00+09:00"))).toMatchObject({
      start_date: "2026-06-12",
      end_date: "2026-07-11",
      page: 1,
    });
    expect(
      normalizeOperationLogsSearch(
        { start_date: "2026-01-01", end_date: "2026-02-01", operation_type: "x", page: 3 },
        new Date("2026-07-11"),
      ),
    ).toEqual({ start_date: "2026-01-01", end_date: "2026-02-01", operation_type: "x", page: 3 });
  });

  it("preserves explicit one-sided and fully-cleared date URL states", () => {
    const now = new Date("2026-07-11T12:00:00+09:00");
    expect(normalizeOperationLogsSearch({ start_date: "2026-07-01" }, now)).toEqual({
      start_date: "2026-07-01",
      end_date: undefined,
      page: 1,
    });
    expect(normalizeOperationLogsSearch({ end_date: "2026-07-11" }, now)).toEqual({
      start_date: undefined,
      end_date: "2026-07-11",
      page: 1,
    });
    expect(normalizeOperationLogsSearch({ start_date: "", end_date: "" }, now)).toEqual({
      start_date: undefined,
      end_date: undefined,
      page: 1,
    });
    expect(
      normalizeOperationLogsSearch({ start_date: undefined, end_date: undefined }, now),
    ).toEqual({
      start_date: "2026-06-12",
      end_date: "2026-07-11",
      page: 1,
    });
  });

  it.each([
    [{ start_date: "2026-07-01" }, { start_date: "2026-07-01", end_date: null }],
    [{ end_date: "2026-07-11" }, { start_date: null, end_date: "2026-07-11" }],
  ] as const)(
    "sends one-sided URL bounds to CMD without restoring the missing side",
    async (search, dates) => {
      listLogs.mockResolvedValue({
        status: "ok",
        data: { items: [log()], total_count: 1, page: 1, per_page: 20 },
      });
      renderPage(search);
      await waitFor(() => {
        expect(listLogs).toHaveBeenCalledWith({
          ...dates,
          operation_type: null,
          page: 1,
          per_page: 20,
        });
      });
    },
  );

  it.each([
    [
      "開始日",
      "log-start",
      "2026-07-02",
      { start_date: "2026-07-02", end_date: "2026-07-11", operation_type: "backup_create" },
    ],
    [
      "終了日",
      "log-end",
      "2026-07-12",
      { start_date: "2026-07-01", end_date: "2026-07-12", operation_type: "backup_create" },
    ],
  ] as const)(
    "resets page and preserves other filters when %s changes",
    async (_label, id, value, expected) => {
      listLogs.mockResolvedValue({
        status: "ok",
        data: { items: [log()], total_count: 1, page: 3, per_page: 20 },
      });
      renderStatefulPage({
        start_date: "2026-07-01",
        end_date: "2026-07-11",
        operation_type: "backup_create",
        page: 3,
      });
      await waitFor(() => {
        expect(listLogs).toHaveBeenCalledWith({
          start_date: "2026-07-01",
          end_date: "2026-07-11",
          operation_type: "backup_create",
          page: 3,
          per_page: 20,
        });
      });
      fireEvent.change(document.getElementById(id) as HTMLInputElement, { target: { value } });
      await waitFor(() => {
        expect(listLogs).toHaveBeenLastCalledWith({ ...expected, page: 1, per_page: 20 });
      });
    },
  );

  it("resets page and preserves date filters when operation type changes", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 3, per_page: 20 },
    });
    renderStatefulPage({ start_date: "2026-07-01", end_date: "2026-07-11", page: 3 });
    await screen.findByRole("option", { name: "その他（future_type）" });
    await userEvent.setup().selectOptions(screen.getByLabelText("種別"), "future_type");
    await waitFor(() => {
      expect(listLogs).toHaveBeenLastCalledWith({
        start_date: "2026-07-01",
        end_date: "2026-07-11",
        operation_type: "future_type",
        page: 1,
        per_page: 20,
      });
    });
  });

  it("keeps one-sided bounds when a date input is cleared", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 3, per_page: 20 },
    });
    renderStatefulPage({ start_date: "2026-07-01", end_date: "2026-07-11", page: 3 });
    await screen.findByText("合成ログ");
    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "" } });
    await waitFor(() => {
      expect(listLogs).toHaveBeenLastCalledWith({
        start_date: null,
        end_date: "2026-07-11",
        operation_type: null,
        page: 1,
        per_page: 20,
      });
    });
  });

  it("keeps the start-only bound when the end date is cleared", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 3, per_page: 20 },
    });
    renderStatefulPage({ start_date: "2026-07-01", end_date: "2026-07-11", page: 3 });
    await screen.findByText("合成ログ");
    fireEvent.change(screen.getByLabelText("終了日"), { target: { value: "" } });
    await waitFor(() => {
      expect(listLogs).toHaveBeenLastCalledWith({
        start_date: "2026-07-01",
        end_date: null,
        operation_type: null,
        page: 1,
        per_page: 20,
      });
    });
  });

  it("keeps the last valid list and expanded row while an inverted range is corrected", async () => {
    listLogs
      .mockResolvedValueOnce({
        status: "ok",
        data: { items: [log()], total_count: 45, page: 3, per_page: 20 },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          items: [{ ...log(), summary: "修正後の合成ログ" }],
          total_count: 1,
          page: 1,
          per_page: 20,
        },
      });
    renderStatefulPage({ start_date: "2026-07-01", end_date: "2026-07-10", page: 3 });
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));
    expect(screen.getByText("商品コード")).toBeInTheDocument();
    expect(screen.getByText("45 件中 3 / 3 ページ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();
    expect(listLogs).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-07-11" } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "開始日は終了日と同じ日か、それより前の日付にしてください",
    );
    expect(listLogs).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("合成ログ")).toHaveLength(2);
    expect(screen.getByText("商品コード")).toBeInTheDocument();
    expect(screen.getByText("45 件中 3 / 3 ページ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "前のページ" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "次のページ" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("開始日"), { target: { value: "2026-07-02" } });
    expect(await screen.findByText("修正後の合成ログ")).toBeInTheDocument();
    expect(listLogs).toHaveBeenCalledTimes(2);
    expect(listLogs).toHaveBeenLastCalledWith({
      start_date: "2026-07-02",
      end_date: "2026-07-10",
      operation_type: null,
      page: 1,
      per_page: 20,
    });
  });

  it("gets type options independently and shows unknown raw fallback", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 1, per_page: 20 },
    });
    renderPage();
    expect((await screen.findAllByText("その他（future_type）")).length).toBeGreaterThanOrEqual(2);
    expect(listTypes).toHaveBeenCalledTimes(1);
  });

  it("conveys known and unknown operation types with visible badge text, not color alone", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          { ...log(), id: 1, operation_type: "backup_create" },
          { ...log(), id: 2, operation_type: "synthetic_unregistered_type" },
        ],
        total_count: 2,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();

    const knownBadge = (await screen.findAllByText("バックアップ作成")).find(
      (element) => element.dataset.slot === "badge",
    );
    expect(knownBadge).toBeVisible();
    expect(screen.getByText("その他（synthetic_unregistered_type）")).toBeVisible();
  });

  it("orders operation type groups and options by the canonical registry, with unknown values last", async () => {
    listTypes.mockResolvedValue({
      status: "ok",
      data: ["backup_create", "future_type", "csv_import", "product_update", "product_create"],
    });
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 1, per_page: 20 },
    });
    renderPage();
    const select = await screen.findByLabelText<HTMLSelectElement>("種別");
    await waitFor(() => {
      expect(Array.from(select.options).map((option) => option.value)).toEqual([
        "",
        "product_create",
        "product_update",
        "csv_import",
        "backup_create",
        "future_type",
      ]);
    });
    expect(Array.from(select.querySelectorAll("optgroup")).map((group) => group.label)).toEqual([
      "商品管理",
      "売上データ取込み",
      "システム管理",
      "その他",
    ]);
  });

  it("does not derive operation type options from the current page", async () => {
    listTypes.mockResolvedValue({ status: "ok", data: ["backup_create"] });
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 1, per_page: 20 },
    });
    renderPage();
    expect(await screen.findByText("その他（future_type）")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "その他（future_type）" })).not.toBeInTheDocument();
  });

  it("keeps the log list and selected unknown type usable when the type registry fails", async () => {
    listTypes.mockResolvedValue({
      status: "error",
      error: { kind: "internal", message: "registry unavailable", field: null },
    });
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 1, per_page: 20 },
    });
    renderPage({ operation_type: "future_type" });
    expect(await screen.findByText("合成ログ")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "その他（future_type）" })).toBeInTheDocument();
  });

  it("expands one row, labels known fields, and renders hostile JSON as text", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 1, per_page: 20 },
    });
    renderPage();
    const trigger = await screen.findByRole("button", { name: "詳細を表示" });
    await userEvent.setup().click(trigger);
    expect(await screen.findByText("商品コード")).toBeInTheDocument();
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(screen.getByText("技術情報（JSON）")).toBeInTheDocument();
  });

  it("test_operation_logs_req902_t9_renders_integrity_adjustments_as_scoped_plain_text", async () => {
    const detail = {
      fixed_count: 2,
      skipped_count: 0,
      adjustments: [
        { product_code: "SYN-DOWN", old_stock: 10, new_stock: 7, adjustment: -3 },
        {
          product_code: "<script>synthetic</script>",
          old_stock: 3,
          new_stock: 8,
          adjustment: 5,
        },
      ],
    };
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [{ ...log(JSON.stringify(detail)), operation_type: "integrity_fix" }],
        total_count: 1,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));

    const region = screen.getByRole("region", { name: "整合性補正の内容" });
    const rows = within(region).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("SYN-DOWN");
    expect(rows[0]).toHaveTextContent("旧在庫 10 → 新在庫 7");
    expect(rows[0]).toHaveTextContent("差分 -3");
    expect(rows[1]).toHaveTextContent("<script>synthetic</script>");
    expect(rows[1]).toHaveTextContent("旧在庫 3 → 新在庫 8");
    expect(rows[1]).toHaveTextContent("差分 +5");
    expect(document.querySelector("script")).toBeNull();
    const summary = screen.getByRole("group", { name: "ログ詳細の要約" });
    expect(within(summary).queryByText(JSON.stringify(detail.adjustments))).toBeNull();
  });

  it("test_operation_logs_req902_t10_keeps_raw_integrity_json_in_technical_details", async () => {
    const detail = {
      fixed_count: 1,
      adjustments: [{ product_code: "SYN-RAW", old_stock: 10, new_stock: 7, adjustment: -3 }],
    };
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [{ ...log(JSON.stringify(detail)), operation_type: "integrity_fix" }],
        total_count: 1,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));

    const technical = screen.getByText("技術情報（JSON）").closest("details");
    expect(technical).not.toBeNull();
    expect(
      within(technical as HTMLElement).getByText(/"product_code": "SYN-RAW"/),
    ).toBeInTheDocument();
  });

  it("test_operation_logs_req902_t11_keeps_generic_detail_for_other_operation_types", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            ...log('{"product_code":"SYN-GENERIC","count":3}'),
            operation_type: "csv_import",
          },
        ],
        total_count: 1,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));

    expect(screen.queryByRole("region", { name: "整合性補正の内容" })).toBeNull();
    const summary = screen.getByRole("group", { name: "ログ詳細の要約" });
    expect(within(summary).getByText("商品コード")).toBeVisible();
    expect(within(summary).getByText("SYN-GENERIC")).toBeVisible();
    expect(within(summary).getByText("件数")).toBeVisible();
    expect(within(summary).getByText("3")).toBeVisible();
  });

  it.each([
    ["missing", { fixed_count: 1 }],
    ["empty", { adjustments: [] }],
    ["not array", { adjustments: "invalid" }],
    ["missing field", { adjustments: [{ product_code: "SYN", old_stock: 1, new_stock: 2 }] }],
    [
      "null field",
      { adjustments: [{ product_code: "SYN", old_stock: null, new_stock: 2, adjustment: 1 }] },
    ],
    [
      "wrong type",
      { adjustments: [{ product_code: "SYN", old_stock: "1", new_stock: 2, adjustment: 1 }] },
    ],
    [
      "mixed valid and invalid",
      {
        adjustments: [
          { product_code: "SYN-OK", old_stock: 1, new_stock: 2, adjustment: 1 },
          { product_code: "SYN-BAD", old_stock: 1, new_stock: 2 },
        ],
      },
    ],
    [
      "unsafe integer",
      {
        adjustments: [
          {
            product_code: "SYN-UNSAFE",
            old_stock: Number.MAX_SAFE_INTEGER + 1,
            new_stock: 2,
            adjustment: 1,
          },
        ],
      },
    ],
  ])("test_operation_logs_req902_t12_degrades_malformed_adjustments_%s", async (_name, detail) => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [{ ...log(JSON.stringify(detail)), operation_type: "integrity_fix" }],
        total_count: 1,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));

    expect(screen.queryByRole("region", { name: "整合性補正の内容" })).toBeNull();
    expect(screen.getByText("技術情報（JSON）")).toBeInTheDocument();
  });

  it.each([
    [20, null],
    [21, "他 1 件は技術情報（JSON）で確認"],
  ])("test_operation_logs_req902_t13_limits_adjustments_to_twenty_%s", async (count, remainder) => {
    const adjustments = Array.from({ length: count }, (_, index) => ({
      product_code: `SYN-${String(index).padStart(2, "0")}`,
      old_stock: index + 10,
      new_stock: index,
      adjustment: -10,
    }));
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            ...log(JSON.stringify({ adjustments })),
            operation_type: "integrity_fix",
          },
        ],
        total_count: 1,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));

    const region = screen.getByRole("region", { name: "整合性補正の内容" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(20);
    expect(within(region).getByText("SYN-19")).toBeVisible();
    expect(within(region).queryByText("SYN-20")).toBeNull();
    if (remainder) {
      expect(within(region).getByText(remainder)).toBeVisible();
    } else {
      expect(within(region).queryByText(/他 \d+ 件は技術情報/)).toBeNull();
    }
  });

  it("toggles detail exactly once through native Enter and Space keyboard paths", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log()], total_count: 1, page: 1, per_page: 20 },
    });
    renderPage();
    const trigger = await screen.findByRole("button", { name: "詳細を表示" });
    expect(trigger).toHaveTextContent("詳細を表示");
    trigger.focus();
    const user = userEvent.setup();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAccessibleName("詳細を閉じる");
    expect(trigger).toHaveTextContent("詳細を閉じる");
    expect(screen.getByText("商品コード")).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAccessibleName("詳細を表示");
    expect(trigger).toHaveTextContent("詳細を表示");
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveTextContent("詳細を閉じる");
  });

  it("keeps only one row expanded and does not toggle it when its related-record link is clicked", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          log('{"record_type":"receiving_record","record_id":7}'),
          { ...log('{"record_type":"return_record","record_id":8}'), id: 2 },
        ],
        total_count: 2,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    const user = userEvent.setup();
    const triggers = await screen.findAllByRole("button", { name: "詳細を表示" });

    await user.click(triggers[0]);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(screen.getByRole("link", { name: "関連記録を見る" }));
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");

    await user.click(triggers[1]);
    expect(triggers[0]).toHaveAttribute("aria-expanded", "false");
    expect(triggers[1]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("関連記録ID")).toHaveLength(1);
  });

  it("handles null and invalid detail JSON safely", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [log(null), { ...log("not-json"), id: 2 }],
        total_count: 2,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    const triggers = await screen.findAllByRole("button", { name: "詳細を表示" });
    await userEvent.setup().click(triggers[0]);
    expect(screen.getByText("詳細情報はありません")).toBeInTheDocument();
    expect(screen.queryByText("技術情報（JSON）")).not.toBeInTheDocument();
    await userEvent.setup().click(triggers[1]);
    expect(screen.getByText("詳細情報を解析できませんでした")).toBeInTheDocument();
  });

  it("truncates oversized technical JSON and only links explicit typed records", async () => {
    const fields = Object.fromEntries(
      Array.from({ length: 22 }, (_, index) => [`field_${String(index)}`, "x".repeat(2500)]),
    );
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [log(JSON.stringify({ ...fields, record_type: "receiving_record", record_id: 7 }))],
        total_count: 1,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));
    expect(screen.getByText(/他 4 件のフィールド/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "関連記録を見る" })).toHaveAttribute(
      "href",
      "/inventory/receiving/records/7",
    );
    await userEvent.setup().click(screen.getByText("技術情報（JSON）"));
    expect(screen.getByText(/以降は長すぎるため省略しました/)).toBeInTheDocument();
  });

  it.each([
    ["zero", { record_type: "receiving_record", record_id: 0 }],
    ["negative", { record_type: "receiving_record", record_id: -1 }],
    ["fractional", { record_type: "receiving_record", record_id: 1.5 }],
    ["numeric string", { record_type: "receiving_record", record_id: "7" }],
    ["unsafe integer", { record_type: "receiving_record", record_id: Number.MAX_SAFE_INTEGER + 1 }],
    ["unknown record_type", { record_type: "csv_import", record_id: 7 }],
    ["missing record_type", { record_id: 7 }],
    ["missing record_id", { record_type: "receiving_record" }],
  ])("hides the related-record link for %s", async (_caseName, detail) => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [log(JSON.stringify(detail))], total_count: 1, page: 1, per_page: 20 },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));
    expect(screen.queryByRole("link", { name: "関連記録を見る" })).not.toBeInTheDocument();
  });

  it("shows the related-record link for a positive safe integer and typed allowlist value", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: {
        items: [log('{"record_type":"receiving_record","record_id":1}')],
        total_count: 1,
        page: 1,
        per_page: 20,
      },
    });
    renderPage();
    await userEvent.setup().click(await screen.findByRole("button", { name: "詳細を表示" }));
    expect(screen.getByRole("link", { name: "関連記録を見る" })).toHaveAttribute(
      "href",
      "/inventory/receiving/records/1",
    );
  });

  it("uses the 30-day empty copy for the default search", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });
    const today = new Date();
    const end = `${String(today.getFullYear())}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 29);
    const start = `${String(startDate.getFullYear())}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;
    renderPage({ start_date: start, end_date: end });
    expect(await screen.findByText("この30日間の操作ログはありません")).toBeInTheDocument();
  });

  it("uses one captured today for the backend query and default empty-state decision", async () => {
    const RealDate = Date;
    const fixedNow = new RealDate("2026-07-11T23:59:59.999+09:00");
    const BoundaryDate = function (value?: string | number | Date) {
      if (arguments.length > 0) return new RealDate(value as string);
      return new RealDate(fixedNow);
    } as unknown as DateConstructor;
    Object.setPrototypeOf(BoundaryDate, RealDate);
    vi.stubGlobal("Date", BoundaryDate);
    const normalizeSpy = vi.spyOn(operationLogTypes, "normalizeOperationLogsSearch");
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });

    renderPage();

    await waitFor(() => {
      expect(listLogs).toHaveBeenCalledWith(
        expect.objectContaining({ start_date: "2026-06-12", end_date: "2026-07-11" }),
      );
    });
    expect(await screen.findByText("この30日間の操作ログはありません")).toBeInTheDocument();
    const [queryNormalization, defaultFilterNormalization] = normalizeSpy.mock.calls;
    expect(queryNormalization[1]).toBeInstanceOf(RealDate);
    expect(defaultFilterNormalization[1]).toBe(queryNormalization[1]);
  });

  it("uses the filtered empty copy when an operation type is selected", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 20 },
    });
    renderPage({ operation_type: "backup_create" });
    expect(await screen.findByText("該当する操作ログがありません")).toBeInTheDocument();
  });

  it("distinguishes out-of-range and recovers to page 1", async () => {
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 21, page: 4, per_page: 20 },
    });
    const change = renderPage({ page: 4 });
    await userEvent.setup().click(await screen.findByRole("button", { name: "先頭ページに戻る" }));
    const updater = change.mock.calls[change.mock.calls.length - 1]?.[0];
    expect(updater({ page: 4 })).toMatchObject({ page: 1 });
  });

  it("requests the largest positive u32 page and presents out-of-range recovery", async () => {
    const maxPage = 0xffff_ffff;
    listLogs.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 1, page: maxPage, per_page: 20 },
    });

    renderPage({ page: maxPage });

    expect(await screen.findByRole("button", { name: "先頭ページに戻る" })).toBeInTheDocument();
    expect(listLogs).toHaveBeenCalledWith(expect.objectContaining({ page: maxPage, per_page: 20 }));
  });

  it("shows an error and retries the same query", async () => {
    listLogs
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "synthetic failure", field: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: { items: [], total_count: 0, page: 1, per_page: 20 },
      });
    renderPage({ operation_type: "future_type" });
    await userEvent.setup().click(await screen.findByRole("button", { name: "再試行" }));
    await waitFor(() => {
      expect(listLogs).toHaveBeenCalledTimes(2);
    });
    expect(listLogs.mock.calls[1]?.[0].operation_type).toBe("future_type");
  });
});
