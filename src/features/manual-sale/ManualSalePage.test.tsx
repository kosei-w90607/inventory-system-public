import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { commands } from "@/lib/bindings";
import { d052InvalidationOracle, expectExactInvalidations } from "@/test/invalidation-oracle";
import { ManualSalePage } from "./ManualSalePage";

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    params,
    search,
    children,
  }: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    children: ReactNode;
  }) => {
    const path =
      params === undefined
        ? to
        : Object.entries(params).reduce((path, [key, value]) => {
            return path.replace(`$${key}`, value);
          }, to);
    const query = search === undefined ? "" : `?${new URLSearchParams(search).toString()}`;
    const href = `${path}${query}`;
    return <a href={href}>{children}</a>;
  },
  useNavigate: () => mockNavigate,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    searchProducts: vi.fn(),
    createManualSale: vi.fn(),
    listInventoryRecords: vi.fn(),
  },
}));

const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockCreateManualSale = vi.mocked(commands.createManualSale);
const mockListInventoryRecords = vi.mocked(commands.listInventoryRecords);
const mockScrollTo = vi.fn();

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return {
    queryClient,
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("deferred promise is not initialized");
  };
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function addSingleProduct(user: ReturnType<typeof userEvent.setup>) {
  mockSearchProducts.mockResolvedValue({
    status: "ok",
    data: {
      items: [
        makeMockProductWithRelations({
          product_code: "MS-001",
          name: "L3確認 新商品",
          selling_price: 120,
          stock_quantity: 3,
        }),
      ],
      total_count: 1,
      page: 1,
      per_page: 10,
    },
  });

  await user.type(await screen.findByLabelText("手動販売商品検索"), "MS-001{enter}");
  expect(await screen.findByText("MS-001")).toBeInTheDocument();
}

beforeEach(() => {
  mockScrollTo.mockReset();
  vi.stubGlobal("scrollTo", mockScrollTo);
  mockNavigate.mockReset();
  mockSearchProducts.mockReset();
  mockCreateManualSale.mockReset();
  mockListInventoryRecords.mockResolvedValue({
    status: "ok",
    data: {
      items: [],
      total_count: 0,
      page: 1,
      per_page: 5,
    },
  });
});

describe("ManualSalePage (UI-04 / REQ-203)", () => {
  it("REQ-203/REQ-206: recent list exposes all-history and detail links", async () => {
    mockListInventoryRecords.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          {
            record_type: "manual_sale",
            record_id: 2,
            business_date: "2026-06-28",
            representative_item: "ボタン #04",
            item_count: 1,
            status: "active",
            created_at: "2026-06-28T02:59:48",
            detail_route: "/inventory/manual-sale/records/2",
          },
        ],
        total_count: 1,
        page: 1,
        per_page: 5,
      },
    });

    renderWithClient(<ManualSalePage />);

    expect(await screen.findByText("直近の手動販売出庫")).toBeInTheDocument();
    expect(mockListInventoryRecords).toHaveBeenCalledWith({
      record_type: "manual_sale",
      date_from: null,
      date_to: null,
      record_id: null,
      product_keyword: null,
      department_id: null,
      status: null,
      page: 1,
      per_page: 5,
    });
    expect(await screen.findByText("ボタン #04")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "すべての履歴を見る" })).toHaveAttribute(
      "href",
      "/inventory/records?recordType=manual_sale",
    );
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/manual-sale/records/2",
    );
  });

  it("REQ-203/REQ-206: recent list shows empty state without blocking form", async () => {
    renderWithClient(<ManualSalePage />);

    expect(await screen.findByText("直近の手動販売出庫はありません")).toBeInTheDocument();
    expect(screen.getByLabelText("手動販売商品検索")).toBeEnabled();
  });

  it("REQ-203/REQ-206: recent list error stays section-local", async () => {
    mockListInventoryRecords.mockRejectedValue(new Error("recent failed"));

    renderWithClient(<ManualSalePage />);

    expect(await screen.findByText("直近の手動販売出庫を取得できませんでした")).toBeInTheDocument();
    expect(screen.getByLabelText("手動販売商品検索")).toBeEnabled();
  });

  it("REQ-203 adds a single matching product and restores focus", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManualSalePage />);

    await addSingleProduct(user);

    expect(screen.getByText("L3確認 新商品")).toBeInTheDocument();
    expect(screen.getByLabelText("MS-001 の数量")).toHaveValue(1);
    await waitFor(() => {
      expect(screen.getByLabelText("手動販売商品検索")).toHaveFocus();
    });
  });

  it("REQ-203 requires explicit selection when multiple products match", async () => {
    const user = userEvent.setup();
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          makeMockProductWithRelations({ product_code: "MS-001", name: "布A" }),
          makeMockProductWithRelations({ product_code: "MS-002", name: "布B" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 10,
      },
    });

    renderWithClient(<ManualSalePage />);
    await user.type(await screen.findByLabelText("手動販売商品検索"), "布{enter}");

    expect(await screen.findByText("候補から手動販売する商品を選んでください")).toBeInTheDocument();
    expect(screen.queryByLabelText("MS-001 の数量")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "手動販売に追加" })[1]);

    expect(await screen.findByLabelText("MS-002 の数量")).toBeInTheDocument();
  });

  it("REQ-203 shows product registration guidance for no match and unsaved rows", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManualSalePage />);
    await addSingleProduct(user);
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 10 },
    });

    await user.type(screen.getByLabelText("手動販売商品検索"), "missing{enter}");

    expect(await screen.findByText("該当する商品がありません")).toBeInTheDocument();
    expect(
      screen.getByText("未登録商品の場合は、商品マスタに登録してから手動販売へ戻って追加します。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "未保存の手動販売内容があります。商品登録へ進むとこの画面の入力は残りません。",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品登録へ進む" })).toHaveAttribute(
      "href",
      "/products/new",
    );
  });

  it("REQ-203 merges duplicate product codes into one row", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManualSalePage />);

    await addSingleProduct(user);
    await user.type(screen.getByLabelText("手動販売商品検索"), "MS-001{enter}");

    expect(screen.getAllByText("MS-001")).toHaveLength(1);
    expect(screen.getByLabelText("MS-001 の数量")).toHaveValue(2);
    expect(screen.getByLabelText("MS-001 の販売金額")).toHaveValue(240);
  });

  it("REQ-203 blocks invalid quantity and amount before submit", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManualSalePage />);
    await addSingleProduct(user);

    fireEvent.change(screen.getByLabelText("MS-001 の数量"), { target: { value: "1.5" } });
    fireEvent.change(screen.getByLabelText("MS-001 の販売金額"), { target: { value: "-1" } });
    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));

    expect(
      await screen.findByText(
        "MS-001: 数量は1以上の整数で入力してください / 販売金額は0以上の整数で入力してください",
      ),
    ).toBeInTheDocument();
    expect(mockScrollTo).not.toHaveBeenCalled();
    expect(mockCreateManualSale).not.toHaveBeenCalled();
  });

  it("REQ-203 scrolls to the top when manual sale create fails", async () => {
    const user = userEvent.setup();
    mockCreateManualSale.mockResolvedValueOnce({
      status: "error",
      error: { kind: "internal", message: "一時的なエラー", field: null },
    });

    renderWithClient(<ManualSalePage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));

    expect(await screen.findByText("一時的なエラー")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
  });

  it("REQ-203 clears row validation errors when an invalid row is removed and re-added", async () => {
    const user = userEvent.setup();
    renderWithClient(<ManualSalePage />);
    await addSingleProduct(user);

    fireEvent.change(screen.getByLabelText("MS-001 の数量"), { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));

    expect(
      await screen.findByText("MS-001: 数量は1以上の整数で入力してください"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "MS-001 を削除" }));
    await user.type(screen.getByLabelText("手動販売商品検索"), "MS-001{enter}");

    expect(
      screen.queryByText("MS-001: 数量は1以上の整数で入力してください"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("MS-001 の数量")).toHaveAttribute("aria-invalid", "false");
  });

  it("REQ-203 keeps validation errors for unchanged rows when another row changes", async () => {
    const user = userEvent.setup();
    mockSearchProducts
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          items: [makeMockProductWithRelations({ product_code: "MS-001", name: "商品A" })],
          total_count: 1,
          page: 1,
          per_page: 10,
        },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          items: [makeMockProductWithRelations({ product_code: "MS-002", name: "商品B" })],
          total_count: 1,
          page: 1,
          per_page: 10,
        },
      });

    renderWithClient(<ManualSalePage />);
    await user.type(await screen.findByLabelText("手動販売商品検索"), "MS-001{enter}");
    await user.type(screen.getByLabelText("手動販売商品検索"), "MS-002{enter}");
    fireEvent.change(screen.getByLabelText("MS-001 の数量"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("MS-002 の数量"), { target: { value: "0" } });
    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));

    expect(
      await screen.findByText("MS-001: 数量は1以上の整数で入力してください"),
    ).toBeInTheDocument();
    expect(screen.getByText("MS-002: 数量は1以上の整数で入力してください")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "MS-001 を削除" }));

    expect(
      screen.queryByText("MS-001: 数量は1以上の整数で入力してください"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("MS-002: 数量は1以上の整数で入力してください")).toBeInTheDocument();
  });

  it("REQ-203 shows PLU confirmation without result and resubmits with the same key and token", async () => {
    const user = userEvent.setup();
    mockCreateManualSale
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          sale_id: null,
          created: false,
          idempotent_replay: false,
          plu_warnings: ["MS-001: この商品はレジで打てます（PLU登録済み）"],
          stock_warnings: [],
          needs_confirmation: true,
          confirmation_token: "confirm-token-1",
        },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          sale_id: 31,
          created: true,
          idempotent_replay: false,
          plu_warnings: ["MS-001: この商品はレジで打てます（PLU登録済み）"],
          stock_warnings: [],
          needs_confirmation: false,
          confirmation_token: null,
        },
      });

    const { queryClient } = renderWithClient(<ManualSalePage />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));

    expect(await screen.findByText("PLU登録済みの商品があります")).toBeInTheDocument();
    // 警告明細は AlertDescription（data-slot="alert-description"）内に描画されること。
    // Alert 直下の生要素は grid の幅0px列に落ちて縦一文字表示になる（2026-07-07 実機報告の退行防止）
    const warningItem = screen.getByText("MS-001: この商品はレジで打てます（PLU登録済み）");
    expect(warningItem.closest('[data-slot="alert-description"]')).not.toBeNull();
    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    expect(screen.queryByText("手動販売を保存しました")).not.toBeInTheDocument();
    expect(invalidateSpy).not.toHaveBeenCalled();
    const firstKey = mockCreateManualSale.mock.calls[0][0].idempotency_key;

    await user.click(screen.getByRole("button", { name: "確認して保存" }));

    await waitFor(() => {
      expect(mockCreateManualSale).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateManualSale.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        idempotency_key: firstKey,
        confirmation_token: "confirm-token-1",
      }),
    );
    expect(await screen.findByText("手動販売を保存しました")).toBeInTheDocument();
  });

  it("REQ-203 clears PLU confirmation after editing sale contents", async () => {
    const user = userEvent.setup();
    mockCreateManualSale.mockResolvedValue({
      status: "ok",
      data: {
        sale_id: null,
        created: false,
        idempotent_replay: false,
        plu_warnings: ["MS-001: この商品はレジで打てます（PLU登録済み）"],
        stock_warnings: [],
        needs_confirmation: true,
        confirmation_token: "confirm-token-1",
      },
    });

    renderWithClient(<ManualSalePage />);
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));
    expect(await screen.findByText("PLU登録済みの商品があります")).toBeInTheDocument();

    await user.type(screen.getByLabelText("備考"), "確認後に修正");

    expect(screen.queryByText("PLU登録済みの商品があります")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手動販売を保存" })).toBeInTheDocument();
  });

  it("REQ-203 displays manual sale result and invalidates inventory and sales queries", async () => {
    const user = userEvent.setup();
    mockCreateManualSale.mockResolvedValue({
      status: "ok",
      data: {
        sale_id: 41,
        created: true,
        idempotent_replay: true,
        plu_warnings: [],
        stock_warnings: ["MS-001: 在庫がマイナスになりました（-1）"],
        needs_confirmation: false,
        confirmation_token: null,
      },
    });

    const { queryClient } = renderWithClient(<ManualSalePage />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await addSingleProduct(user);
    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));
    const saleDate = mockCreateManualSale.mock.calls[0][0].sale_date;

    await waitFor(() => {
      expect(mockScrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
    expect(await screen.findByText("手動販売を保存しました")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getByText("再送結果")).toBeInTheDocument();
    expect(screen.getByText("MS-001: 在庫がマイナスになりました（-1）")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "詳細を見る" })).toHaveAttribute(
      "href",
      "/inventory/manual-sale/records/41",
    );
    expect(screen.getByRole("button", { name: "手動販売を保存" })).toBeDisabled();
    await waitFor(() => {
      expectExactInvalidations(
        invalidateSpy.mock.calls,
        d052InvalidationOracle.manualSale(saleDate),
      );
    });

    await user.click(screen.getByRole("button", { name: "日次売上へ" }));
    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/reports/daily",
      search: { date: saleDate },
    });
  });

  it("REQ-203 disables return and editing while saving", async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<{
      status: "ok";
      data: {
        sale_id: number;
        created: boolean;
        idempotent_replay: boolean;
        plu_warnings: string[];
        stock_warnings: string[];
        needs_confirmation: boolean;
        confirmation_token: string | null;
      };
    }>();
    mockCreateManualSale.mockReturnValue(deferred.promise);

    renderWithClient(<ManualSalePage />);
    await addSingleProduct(user);
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 10 },
    });
    await user.type(screen.getByLabelText("手動販売商品検索"), "missing{enter}");
    expect(await screen.findByRole("link", { name: "商品登録へ進む" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "手動販売を保存" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
      expect(screen.getByRole("button", { name: "リセット" })).toBeDisabled();
      expect(screen.getByLabelText("MS-001 の数量")).toBeDisabled();
      expect(screen.getByLabelText("手動販売商品検索")).toBeDisabled();
      expect(screen.queryByRole("link", { name: "在庫照会へ戻る" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "商品登録へ進む" })).not.toBeInTheDocument();
    });

    deferred.resolve({
      status: "ok",
      data: {
        sale_id: 51,
        created: true,
        idempotent_replay: false,
        plu_warnings: [],
        stock_warnings: [],
        needs_confirmation: false,
        confirmation_token: null,
      },
    });
  });
});
