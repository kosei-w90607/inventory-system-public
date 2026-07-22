// src/features/stocktake/StocktakePage.test.tsx
//
// REQ-205 / UI-10 Test Design Matrix T1〜T16（UI-10-D10）+ T17（UI-10-D11）+ T18〜T20（契約監査）

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import type { Department, Stocktake, StocktakeItemDetail } from "@/lib/bindings";
import { d052InvalidationOracle, expectExactInvalidations } from "@/test/invalidation-oracle";

import { StocktakePage } from "./StocktakePage";
import type { StocktakeSearch } from "./types";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    listDepartments: vi.fn(),
    getActiveStocktake: vi.fn(),
    getLastCompletedStocktake: vi.fn(),
    startStocktake: vi.fn(),
    getStocktakeItems: vi.fn(),
    findStocktakeItem: vi.fn(),
    updateCount: vi.fn(),
    completeStocktake: vi.fn(),
    searchProducts: vi.fn(),
  },
}));

const mockListDepartments = vi.mocked(commands.listDepartments);
const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockGetActive = vi.mocked(commands.getActiveStocktake);
const mockGetLast = vi.mocked(commands.getLastCompletedStocktake);
const mockStart = vi.mocked(commands.startStocktake);
const mockGetItems = vi.mocked(commands.getStocktakeItems);
const mockFindItem = vi.mocked(commands.findStocktakeItem);
const mockUpdateCount = vi.mocked(commands.updateCount);
const mockComplete = vi.mocked(commands.completeStocktake);

function ok<T>(data: T) {
  return { status: "ok" as const, data };
}

function cmdError(kind: string, message: string) {
  return { status: "error" as const, error: { kind, message, field: null } };
}

function stocktakeItem(overrides: Partial<StocktakeItemDetail> = {}): StocktakeItemDetail {
  return { ...baseStocktakeItem(), ...overrides };
}

function activeStocktake(overrides: Partial<Stocktake> = {}): Stocktake {
  return {
    id: 77,
    started_at: "2026-10-01T09:00:00",
    completed_at: null,
    status: "in_progress",
    total_cost: null,
    ...overrides,
  };
}

function baseStocktakeItem(): StocktakeItemDetail {
  return {
    id: 501,
    stocktake_id: 77,
    product_code: "P-001",
    name: "赤い糸",
    department_name: "毛糸",
    system_stock: 10,
    actual_count: null,
    counted_at: null,
    current_stock: 10,
  };
}

function listResponse(overrides: Partial<Awaited<ReturnType<typeof baseListResponse>>> = {}) {
  return ok({ ...baseListResponse(), ...overrides });
}

function baseListResponse() {
  return {
    items: [baseStocktakeItem(), stocktakeItem({ id: 502, product_code: "P-002", name: "青い糸" })],
    progress: { total_items: 2, counted_items: 1, uncounted_items: 1 },
    total_count: 2,
    page: 1,
    per_page: 200,
  };
}

function renderWithClient(
  ui: ReactNode,
  {
    onSearchChange = vi.fn(),
  }: { onSearchChange?: (updater: (prev: StocktakeSearch) => StocktakeSearch) => void } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
  return {
    queryClient,
    invalidateSpy,
    onSearchChange,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

async function renderPage(search: StocktakeSearch = {}) {
  const onSearchChange = vi.fn();
  const utils = renderWithClient(
    <StocktakePage search={search} onSearchChange={onSearchChange} />,
    {
      onSearchChange,
    },
  );
  await screen.findByRole("heading", { name: "棚卸し" });
  return utils;
}

beforeEach(() => {
  mockListDepartments.mockReset();
  mockGetActive.mockReset();
  mockGetLast.mockReset();
  mockStart.mockReset();
  mockGetItems.mockReset();
  mockFindItem.mockReset();
  mockUpdateCount.mockReset();
  mockComplete.mockReset();
  mockSearchProducts.mockReset();
  mockSearchProducts.mockResolvedValue(ok({ items: [], total_count: 0, page: 1, per_page: 10 }));

  const departments: Department[] = [
    {
      id: 1,
      name: "毛糸",
      z005_name: null,
      code_prefix: null,
      next_seq: 1,
      created_at: "2026-01-01T00:00:00",
    },
  ];
  mockListDepartments.mockResolvedValue(ok(departments));
  mockGetActive.mockResolvedValue(ok(null));
  mockGetLast.mockResolvedValue(
    ok({
      stocktake_id: 10,
      completed_at: "2026-09-30T18:00:00",
      total_cost: 2000,
    }),
  );
  mockStart.mockResolvedValue(ok({ stocktake_id: 77, item_count: 2, auto_filled_count: 0 }));
  mockGetItems.mockResolvedValue(listResponse());
  mockFindItem.mockResolvedValue(ok(baseStocktakeItem()));
  mockUpdateCount.mockResolvedValue(ok({ success: true, current_difference: 2 }));
  mockComplete.mockResolvedValue(
    ok({
      total_cost: 2500,
      adjusted_items: [
        {
          product_code: "P-001",
          product_name: "赤い糸",
          system_stock: 10,
          actual_count: 8,
          difference: 2,
          stock_after: 8,
        },
      ],
      total_items: 2,
      integrity_result: { mismatches: [], mismatch_count: 0, checked_count: 2 },
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("StocktakePage (UI-10)", () => {
  it("T1 not-started shows start CTA and last summary; active CMD state shows counting display", async () => {
    const first = await renderPage();

    expect(await screen.findByRole("button", { name: "棚卸しを開始する" })).toBeInTheDocument();
    expect(
      await screen.findByText("前回の棚卸し（2026-09-30 18:00:00）: 仕入原価総額 ¥2,000"),
    ).toBeInTheDocument();
    first.unmount();

    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();

    expect(await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）")).toBeInTheDocument();
    expect(await screen.findByText("入力済み 1 / 全 2")).toBeInTheDocument();
  });

  it("T2 start CTA calls startStocktake once and enters counting screen", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValueOnce(ok(null)).mockResolvedValue(ok(activeStocktake()));
    const { invalidateSpy } = await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを開始する" }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）")).toBeInTheDocument();
    expect(mockGetItems).toHaveBeenCalledWith(77, null, null, 1, 200);
    expectExactInvalidations(invalidateSpy.mock.calls, d052InvalidationOracle.stocktakeStart());
  });

  it("T3 department filter and uncounted toggle change getStocktakeItems params", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: "毛糸" }));
    await user.click(screen.getByLabelText("未入力のみ表示"));

    await waitFor(() => {
      expect(mockGetItems).toHaveBeenLastCalledWith(77, 1, false, 1, 200);
    });
  });

  it("T4 code/JAN resolve then quantity saves with found item id", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "4900000000001");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));
    await user.clear(await screen.findByLabelText("実際の数"));
    await user.type(screen.getByLabelText("実際の数"), "8");
    await user.click(screen.getByRole("button", { name: "数を保存" }));

    expect(mockFindItem).toHaveBeenCalledWith(77, "4900000000001");
    await waitFor(() => {
      expect(mockUpdateCount).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateCount).toHaveBeenCalledWith(501, 8);
  });

  it("T17 focus moves code→quantity→code across scan cycle for continuous HID scanning (UI-10-D11)", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await waitFor(() => {
      expect(screen.getByLabelText("商品を検索・スキャン")).toHaveFocus();
    });

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "4900000000001{Enter}");
    await screen.findByLabelText("実際の数");

    await waitFor(() => {
      expect(screen.getByLabelText("実際の数")).toHaveFocus();
    });

    await user.clear(screen.getByLabelText("実際の数"));
    await user.type(screen.getByLabelText("実際の数"), "8{Enter}");

    await waitFor(() => {
      expect(mockUpdateCount).toHaveBeenCalledWith(501, 8);
    });
    await waitFor(() => {
      expect(screen.getByLabelText("商品を検索・スキャン")).toHaveFocus();
    });
  });

  it("T5 target none shows recovery text and does not update count", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockFindItem.mockResolvedValueOnce(ok(null));
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "NOPE");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));

    expect(
      await screen.findByText(
        "この商品は棚卸しの対象にありません。商品コードまたはJANを確認してください。新しく登録した商品は自動で追加されます",
      ),
    ).toBeInTheDocument();
    expect(mockUpdateCount).not.toHaveBeenCalled();
  });

  it("T6 counted item can be overwritten without confirmation", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockFindItem.mockResolvedValueOnce(ok(stocktakeItem({ actual_count: 5 })));
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "P-001");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));

    expect(await screen.findByText("入力済みの数を上書きできます")).toBeInTheDocument();
    await user.clear(screen.getByLabelText("実際の数"));
    await user.type(screen.getByLabelText("実際の数"), "6");
    await user.click(screen.getByRole("button", { name: "数を保存" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(mockUpdateCount).toHaveBeenCalledWith(501, 6);
    });
  });

  it("T7 progress display matches progress payload", async () => {
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockGetItems.mockResolvedValueOnce(
      listResponse({ progress: { total_items: 10, counted_items: 7, uncounted_items: 3 } }),
    );
    await renderPage();

    expect(await screen.findByText("入力済み 7 / 全 10")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "棚卸し進捗" })).toHaveAttribute(
      "aria-valuenow",
      "70",
    );
  });

  it("T16 list shows difference and last counted columns, blank for uncounted items (UI-10-D10)", async () => {
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockGetItems.mockResolvedValueOnce(
      listResponse({
        items: [
          stocktakeItem({
            id: 601,
            product_code: "P-901",
            name: "差異あり商品",
            system_stock: 10,
            current_stock: 12,
            actual_count: 9,
            counted_at: "2026-10-01T09:05:00",
          }),
          stocktakeItem({
            id: 602,
            product_code: "P-902",
            name: "未入力商品",
            current_stock: 5,
            actual_count: null,
            counted_at: null,
          }),
        ],
      }),
    );
    await renderPage();

    const table = await screen.findByRole("table");
    const row = within(table).getByText("差異あり商品").closest("tr");
    if (row === null) throw new Error("row not found");
    // 表示される在庫値は差異の計算根拠と同じ current_stock（12）であり、
    // system_stock（10）ではないことを検証する（Codex レビュー P2 是正）。
    expect(within(row).getByText("12")).toBeInTheDocument();
    expect(within(row).queryByText("10")).not.toBeInTheDocument();
    expect(within(row).getByText("+3")).toBeInTheDocument();
    expect(within(row).getByText("2026-10-01 09:05:00")).toBeInTheDocument();

    const uncountedRow = within(table).getByText("未入力商品").closest("tr");
    if (uncountedRow === null) throw new Error("uncounted row not found");
    const dashes = within(uncountedRow).getAllByText("—");
    expect(dashes).toHaveLength(2);
  });

  it("T8 negative actual_count shows FieldError and is not sent", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "P-001");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));
    await user.clear(await screen.findByLabelText("実際の数"));
    await user.type(screen.getByLabelText("実際の数"), "-1");
    await user.click(screen.getByRole("button", { name: "数を保存" }));

    expect(await screen.findByText("0以上の数値を入力してください")).toBeInTheDocument();
    expect(mockUpdateCount).not.toHaveBeenCalled();
  });

  it("T9 complete with no uncounted always confirms and sends force_fill false", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockGetItems.mockResolvedValueOnce(
      listResponse({ progress: { total_items: 2, counted_items: 2, uncounted_items: 0 } }),
    );
    const { invalidateSpy } = await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    expect(await screen.findByRole("heading", { name: "棚卸しの確定" })).toBeInTheDocument();
    const noUncountedAlert = screen.getByRole("alert");
    expect(within(noUncountedAlert).getByText("確定すると取り消せません")).toBeInTheDocument();
    expect(
      within(noUncountedAlert).getByText("入力した内容で棚卸しを確定します。"),
    ).toBeInTheDocument();
    // sr-only description にも不可逆性の警告 title が含まれることを検証（Codex レビュー P2 是正）
    const noUncountedDialog = screen.getByRole("alertdialog");
    const noUncountedDescribedBy = noUncountedDialog.getAttribute("aria-describedby");
    expect(document.getElementById(noUncountedDescribedBy ?? "")).toHaveTextContent(
      "確定すると取り消せません。入力した内容で棚卸しを確定します。",
    );
    await user.click(screen.getByRole("button", { name: "確定する" }));

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith(77, false);
      expectExactInvalidations(
        invalidateSpy.mock.calls,
        d052InvalidationOracle.stocktakeComplete(),
      );
    });
  });

  it("T10 complete with uncounted confirms force_fill true", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    expect(
      await screen.findByRole("heading", { name: "未入力の商品があります" }),
    ).toBeInTheDocument();
    const uncountedAlert = screen.getByRole("alert");
    expect(within(uncountedAlert).getByText("確定すると取り消せません")).toBeInTheDocument();
    expect(
      within(uncountedAlert).getByText(
        "1件が未入力のまま残っています。確定すると、この1件は現在の在庫数で棚卸しされます。",
      ),
    ).toBeInTheDocument();
    // sr-only description にも不可逆性の警告 title が含まれることを検証（Codex レビュー P2 是正）
    const uncountedDialog = screen.getByRole("alertdialog");
    const uncountedDescribedBy = uncountedDialog.getAttribute("aria-describedby");
    expect(document.getElementById(uncountedDescribedBy ?? "")).toHaveTextContent(
      "確定すると取り消せません。1件が未入力のまま残っています。確定すると、この1件は現在の在庫数で棚卸しされます。",
    );
    await user.click(screen.getByRole("button", { name: "確定する" }));

    await waitFor(() => {
      expect(mockComplete).toHaveBeenCalledWith(77, true);
    });
  });

  it("T11 result shows total_cost, adjusted_items, and last comparison", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    await user.click(screen.getByRole("button", { name: "確定する" }));

    expect(await screen.findByRole("heading", { name: "棚卸し結果" })).toBeInTheDocument();
    expect(screen.getByText("仕入原価総額")).toBeInTheDocument();
    expect(screen.getByText("¥2,500")).toBeInTheDocument();
    expect(screen.getByText("赤い糸")).toBeInTheDocument();
    expect(screen.getByText("前回の棚卸し（2026-09-30 18:00:00）")).toBeInTheDocument();
    expect(screen.getByText("仕入原価総額 ¥2,000")).toBeInTheDocument();
  });

  it("T19 result page keeps pre-complete last-stocktake snapshot after lastCompleted invalidation (Codex contract audit P2)", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    // invalidate 前は前回棚卸し、invalidate 後は「今確定した棚卸し自身」が返ってくる状況を再現する
    mockGetLast.mockResolvedValueOnce(
      ok({ stocktake_id: 10, completed_at: "2026-09-30T18:00:00", total_cost: 2000 }),
    );
    mockGetLast.mockResolvedValue(
      ok({ stocktake_id: 77, completed_at: "2026-10-08T10:00:00", total_cost: 2500 }),
    );
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    await user.click(screen.getByRole("button", { name: "確定する" }));

    expect(await screen.findByRole("heading", { name: "棚卸し結果" })).toBeInTheDocument();
    // 確定直前にスナップショットした前回棚卸し（2026-09-30）を表示し続け、
    // invalidate 後の再取得値（今確定した棚卸し自身、2026-10-08）には差し替わらない
    expect(screen.getByText("前回の棚卸し（2026-09-30 18:00:00）")).toBeInTheDocument();
    expect(screen.getByText("仕入原価総額 ¥2,000")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockGetLast).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText("前回の棚卸し（2026-10-08 10:00:00）")).not.toBeInTheDocument();
  });

  it("T12 result shows integrity fallback when integrity_result is null", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockComplete.mockResolvedValueOnce(
      ok({ total_cost: 2500, adjusted_items: [], total_items: 2, integrity_result: null }),
    );
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    await user.click(screen.getByRole("button", { name: "確定する" }));

    expect(await screen.findByText("整合性チェックは実行できませんでした")).toBeInTheDocument();
  });

  it("T13 stocktake error kinds recover with operator-facing messages", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(ok(activeStocktake()));
    mockStart.mockResolvedValueOnce(cmdError("stocktake_in_progress", "進行中の棚卸しがあります"));
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを開始する" }));
    expect(await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）")).toBeInTheDocument();
    expect(mockGetActive).toHaveBeenCalledTimes(2);

    mockGetActive.mockResolvedValue(ok(null));
    mockUpdateCount.mockResolvedValueOnce(
      cmdError("stocktake_not_in_progress", "この棚卸しは既に完了しています"),
    );
    await user.type(screen.getByLabelText("商品を検索・スキャン"), "P-001");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));
    await user.clear(await screen.findByLabelText("実際の数"));
    await user.type(screen.getByLabelText("実際の数"), "8");
    await user.click(screen.getByRole("button", { name: "数を保存" }));

    expect(await screen.findByText("この棚卸しは既に完了しています")).toBeInTheDocument();
    // stocktake_not_in_progress は状態 query を invalidate/再取得し、not_started 表示へ切り替わる（73 §73.9）
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "棚卸しを開始する" })).toBeInTheDocument();
    });
  });

  it("T18 complete_stocktake stocktake_not_in_progress recovers with operator-facing message (73 §73.9 contract audit)", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockGetItems.mockResolvedValueOnce(
      listResponse({ progress: { total_items: 2, counted_items: 2, uncounted_items: 0 } }),
    );
    mockComplete.mockResolvedValueOnce(
      cmdError("stocktake_not_in_progress", "他端末での並行操作による完了済みメッセージ"),
    );
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    mockGetActive.mockResolvedValue(ok(null));
    await user.click(await screen.findByRole("button", { name: "確定する" }));

    expect(await screen.findByText("この棚卸しは既に完了しています")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "棚卸しを開始する" })).toBeInTheDocument();
    });
  });

  it("T20 complete_stocktake validation error (force_fill 未入力超過) invalidates item list for retry", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockGetItems.mockResolvedValueOnce(
      listResponse({ progress: { total_items: 2, counted_items: 2, uncounted_items: 0 } }),
    );
    mockComplete.mockResolvedValueOnce(
      cmdError(
        "validation",
        "未入力の商品が1件あります。全商品のカウントを完了するか、force_fill=true で未入力をシステム在庫と同じとみなしてください",
      ),
    );
    await renderPage();

    const getItemsCallsBeforeConfirm = mockGetItems.mock.calls.length;
    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    await user.click(await screen.findByRole("button", { name: "確定する" }));

    expect(
      await screen.findByText(
        "未入力の商品が1件あります。全商品のカウントを完了するか、force_fill=true で未入力をシステム在庫と同じとみなしてください",
      ),
    ).toBeInTheDocument();
    // 一覧を invalidate/再取得し、次回の確定操作で最新の uncounted_items に基づいた判定ができるようにする
    await waitFor(() => {
      expect(mockGetItems.mock.calls.length).toBeGreaterThan(getItemsCallsBeforeConfirm);
    });
  });

  it("T21 product name search fallback resolves item when a single candidate matches (owner L3 finding)", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockFindItem.mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(ok(baseStocktakeItem()));
    mockSearchProducts.mockResolvedValueOnce(
      ok({
        items: [makeMockProductWithRelations({ product_code: "P-001", name: "新商品テスト" })],
        total_count: 1,
        page: 1,
        per_page: 10,
      }),
    );
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "新商品テスト");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));

    expect(mockFindItem).toHaveBeenNthCalledWith(1, 77, "新商品テスト");
    expect(mockFindItem).toHaveBeenNthCalledWith(2, 77, "P-001");
    await waitFor(() => {
      expect(screen.getByLabelText("実際の数")).toHaveFocus();
    });
  });

  it("T22 product name search fallback shows candidate list when multiple products match", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockFindItem.mockResolvedValueOnce(ok(null)).mockResolvedValueOnce(ok(baseStocktakeItem()));
    mockSearchProducts.mockResolvedValueOnce(
      ok({
        items: [
          makeMockProductWithRelations({ product_code: "P-001", name: "赤い糸セット" }),
          makeMockProductWithRelations({ product_code: "P-002", name: "青い糸セット" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 10,
      }),
    );
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "糸セット");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));

    expect(await screen.findByText("候補から商品を選んでください")).toBeInTheDocument();
    expect(screen.getByText("赤い糸セット")).toBeInTheDocument();
    expect(screen.getByText("青い糸セット")).toBeInTheDocument();

    const targetRow = screen.getByRole("row", { name: /赤い糸セット/ });
    await user.click(within(targetRow).getByRole("button", { name: "選択" }));

    expect(mockFindItem).toHaveBeenNthCalledWith(2, 77, "P-001");
    await waitFor(() => {
      expect(screen.getByLabelText("実際の数")).toHaveFocus();
    });
    expect(screen.queryByText("候補から商品を選んでください")).not.toBeInTheDocument();
  });

  it("T23 IME composition Enter does not trigger search/save (Codex review P2)", async () => {
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    const codeInput = screen.getByLabelText("商品を検索・スキャン");
    fireEvent.change(codeInput, { target: { value: "しんしょうひん" } });
    fireEvent.keyDown(codeInput, { key: "Enter", isComposing: true });

    expect(mockFindItem).not.toHaveBeenCalled();

    fireEvent.change(codeInput, { target: { value: "P-001" } });
    fireEvent.keyDown(codeInput, { key: "Enter" });

    const quantityInput = await screen.findByLabelText("実際の数");
    fireEvent.change(quantityInput, { target: { value: "8" } });
    fireEvent.keyDown(quantityInput, { key: "Enter", isComposing: true });

    expect(mockUpdateCount).not.toHaveBeenCalled();
  });

  it("T14 complete pending shows spinner text and disables operations", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    mockComplete.mockImplementationOnce(() => new Promise(() => undefined));
    await renderPage();

    await user.click(await screen.findByRole("button", { name: "棚卸しを確定する" }));
    await user.click(screen.getByRole("button", { name: "確定する" }));

    expect(await screen.findByText("確定しています")).toBeInTheDocument();
    expect(screen.getByLabelText("商品を検索・スキャン")).toBeDisabled();
    expect(screen.getByRole("button", { name: "棚卸しを確定する" })).toBeDisabled();
  });

  it("T15 update success invalidates list so auto-added item appears without dedicated notification", async () => {
    const user = userEvent.setup();
    mockGetActive.mockResolvedValue(ok(activeStocktake()));
    const { invalidateSpy } = await renderPage();
    await screen.findByText("棚卸し中（開始日: 2026-10-01 09:00:00）");

    await user.type(screen.getByLabelText("商品を検索・スキャン"), "P-001");
    await user.click(screen.getByRole("button", { name: "対象を確認" }));
    await user.clear(await screen.findByLabelText("実際の数"));
    await user.type(screen.getByLabelText("実際の数"), "8");
    await user.click(screen.getByRole("button", { name: "数を保存" }));

    await waitFor(() => {
      expectExactInvalidations(
        invalidateSpy.mock.calls,
        d052InvalidationOracle.stocktakeCountUpdate(),
      );
    });
    expect(screen.queryByText("新しい商品を追加しました")).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("青い糸")).toBeInTheDocument();
  });
});
