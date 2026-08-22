import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import type { ProductWithRelations } from "@/lib/bindings";
import {
  makeMockDepartment,
  makeMockProductWithRelations,
  makeMockSupplier,
} from "./lib/test-fixtures";
import { PriceRevisionPage } from "./PriceRevisionPage";
import type { PriceRevisionSearch } from "./priceRevisionSearch";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    searchProducts: vi.fn(),
    listSuppliers: vi.fn(),
    listDepartments: vi.fn(),
    listPriceHistory: vi.fn(),
    reviseProductPrice: vi.fn(),
    createSupplier: vi.fn(),
  },
}));

const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockListSuppliers = vi.mocked(commands.listSuppliers);
const mockListDepartments = vi.mocked(commands.listDepartments);
const mockListPriceHistory = vi.mocked(commands.listPriceHistory);
const mockReviseProductPrice = vi.mocked(commands.reviseProductPrice);
const mockCreateSupplier = vi.mocked(commands.createSupplier);

const DEFAULT_PRODUCTS = [
  makeMockProductWithRelations({
    product_code: "P-001",
    name: "価格商品A",
    maker_code: "MK-A",
    selling_price: 1000,
    cost_price: 700,
  }),
  makeMockProductWithRelations({
    product_code: "P-002",
    name: "価格商品B",
    selling_price: 0,
    cost_price: 300,
  }),
];

function arrangeList(items: ProductWithRelations[] = DEFAULT_PRODUCTS) {
  mockSearchProducts.mockResolvedValue({
    status: "ok",
    data: { items, total_count: items.length, page: 1, per_page: 50 },
  });
  mockListSuppliers.mockResolvedValue({
    status: "ok",
    data: [
      makeMockSupplier({ id: 7, name: "取引先A" }),
      makeMockSupplier({ id: 8, name: "取引先B" }),
    ],
  });
  mockListDepartments.mockResolvedValue({
    status: "ok",
    data: [makeMockDepartment({ id: 1, name: "毛糸" })],
  });
  mockListPriceHistory.mockImplementation((code) =>
    Promise.resolve({
      status: "ok",
      data:
        code === "P-001"
          ? [
              {
                id: 1,
                old_selling_price: 900,
                new_selling_price: 1000,
                old_cost_price: 630,
                new_cost_price: 700,
                changed_at: "2026-08-23T09:15:00",
              },
            ]
          : code === "P-002"
            ? [
                {
                  id: 2,
                  old_selling_price: 1,
                  new_selling_price: 0,
                  old_cost_price: 300,
                  new_cost_price: 300,
                  changed_at: "2026-08-22T23:59:59",
                },
              ]
            : [],
    }),
  );
  mockReviseProductPrice.mockResolvedValue({
    status: "ok",
    data: { product_code: "P-001", changed: true, plu_dirty_set: true, supplier_assigned: false },
  });
}

function renderStateful(initialSearch: PriceRevisionSearch = {}, queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
  function Harness() {
    const [search, setSearch] = useState<PriceRevisionSearch>(initialSearch);
    return (
      <PriceRevisionPage
        search={search}
        onSearchChange={(updater) => {
          setSearch(updater);
        }}
      />
    );
  }
  return {
    ...render(
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>,
    ),
    queryClient: client,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  arrangeList();
  vi.spyOn(Date.prototype, "toLocaleDateString").mockReturnValue("2026-08-23");
});

describe("PriceRevisionPage UI-14 / REQ-105", () => {
  it("取引先を選ぶと「取引先未設定の商品も含める」が既定 on で表示され off にすると include_unassigned=false で再検索する", async () => {
    const user = userEvent.setup();
    renderStateful();
    await screen.findByText("P-001");
    await user.selectOptions(screen.getByLabelText("取引先"), "7");
    const toggle = await screen.findByRole("checkbox", { name: "取引先未設定の商品も含める" });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenLastCalledWith(
        expect.objectContaining({ supplier_id: 7, include_unassigned: false }),
      );
    });
  });

  it("「未設定の商品にこの取引先を設定する」は取引先選択中だけ表示され既定 on で supplier 変更時に on へ戻る", async () => {
    const user = userEvent.setup();
    renderStateful();
    await screen.findByText("P-001");
    expect(
      screen.queryByRole("checkbox", { name: "未設定の商品にこの取引先を設定する" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("取引先"), "7");
    const assign = await screen.findByRole("checkbox", {
      name: "未設定の商品にこの取引先を設定する",
    });
    expect(assign).toBeChecked();
    await user.click(assign);
    expect(assign).not.toBeChecked();
    await user.selectOptions(screen.getByLabelText("取引先"), "8");
    expect(
      await screen.findByRole("checkbox", { name: "未設定の商品にこの取引先を設定する" }),
    ).toBeChecked();
  });

  it("browser 履歴で supplier search が変わった場合も取引先設定 toggle を既定 on に戻す", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    const onSearchChange = vi.fn();
    const view = render(
      <QueryClientProvider client={client}>
        <PriceRevisionPage search={{ supplier: 7 }} onSearchChange={onSearchChange} />
      </QueryClientProvider>,
    );
    const assign = await screen.findByRole("checkbox", {
      name: "未設定の商品にこの取引先を設定する",
    });
    await user.click(assign);
    expect(assign).not.toBeChecked();

    view.rerender(
      <QueryClientProvider client={client}>
        <PriceRevisionPage search={{ supplier: 8 }} onSearchChange={onSearchChange} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("checkbox", { name: "未設定の商品にこの取引先を設定する" }),
    ).toBeChecked();
  });

  it("新売価入力で新原価（案）が導出され現売価 0 の行は掛率「—」と現原価 fallback になり新売価は空から始まる", async () => {
    const user = userEvent.setup();
    renderStateful();
    const rowA = await screen.findByTestId("price-row-P-001");
    const rowB = screen.getByTestId("price-row-P-002");
    expect(within(rowA).getByLabelText("P-001 新売価")).toHaveValue(null);
    expect(within(rowB).getAllByText("—")).toHaveLength(2);
    await user.type(within(rowA).getByLabelText("P-001 新売価"), "1200");
    expect(within(rowA).getByLabelText("P-001 新原価（案）")).toHaveValue(840);
    await user.type(within(rowB).getByLabelText("P-002 新売価"), "1200");
    expect(within(rowB).getByLabelText("P-002 新原価（案）")).toHaveValue(300);
  });

  it("新原価（案）を手で編集した後は新売価変更で上書きせず未編集なら追従する", async () => {
    const user = userEvent.setup();
    renderStateful();
    const row = await screen.findByTestId("price-row-P-001");
    const selling = within(row).getByLabelText("P-001 新売価");
    const cost = within(row).getByLabelText("P-001 新原価（案）");
    await user.type(selling, "1200");
    expect(cost).toHaveValue(840);
    await user.clear(selling);
    await user.type(selling, "1300");
    expect(cost).toHaveValue(910);
    await user.clear(cost);
    await user.type(cost, "800");
    await user.clear(selling);
    await user.type(selling, "1400");
    expect(cost).toHaveValue(800);
  });

  it("確定は該当行 1 商品だけを reviseProductPrice に送り assign_supplier_id は取引先選択 + toggle on のとき supplier_id、それ以外 null", async () => {
    const user = userEvent.setup();
    renderStateful({ supplier: 7 });
    const row = await screen.findByTestId("price-row-P-001");
    await user.type(within(row).getByLabelText("P-001 新売価"), "1200");
    await user.click(within(row).getByRole("button", { name: "P-001 を確定" }));
    await waitFor(() => {
      expect(mockReviseProductPrice).toHaveBeenCalledTimes(1);
    });
    expect(mockReviseProductPrice).toHaveBeenCalledWith({
      product_code: "P-001",
      new_selling_price: 1200,
      new_cost_price: 840,
      assign_supplier_id: 7,
    });
    await user.click(screen.getByRole("checkbox", { name: "未設定の商品にこの取引先を設定する" }));
    const secondRow = screen.getByTestId("price-row-P-002");
    await user.type(within(secondRow).getByLabelText("P-002 新売価"), "500");
    await user.click(within(secondRow).getByRole("button", { name: "P-002 を確定" }));
    await waitFor(() => {
      expect(mockReviseProductPrice).toHaveBeenCalledTimes(2);
    });
    expect(mockReviseProductPrice).toHaveBeenLastCalledWith({
      product_code: "P-002",
      new_selling_price: 500,
      new_cost_price: 300,
      assign_supplier_id: null,
    });
  });

  it("確定成功後に D-052-C20 の独立 oracle 集合を invalidate し再取得した新価格を表示して行入力を消す", async () => {
    const user = userEvent.setup();
    const revised = makeMockProductWithRelations({
      product_code: "P-001",
      name: "価格商品A",
      selling_price: 1200,
      cost_price: 840,
    });
    mockSearchProducts
      .mockResolvedValueOnce({
        status: "ok",
        data: { items: [DEFAULT_PRODUCTS[0]], total_count: 1, page: 1, per_page: 50 },
      })
      .mockResolvedValue({
        status: "ok",
        data: { items: [revised], total_count: 1, page: 1, per_page: 50 },
      });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    renderStateful({}, queryClient);
    const row = await screen.findByTestId("price-row-P-001");
    const input = within(row).getByLabelText("P-001 新売価");
    await user.type(input, "1200");
    await user.click(within(row).getByRole("button", { name: "P-001 を確定" }));
    await waitFor(() => {
      expect(input).toHaveValue(null);
    });
    await waitFor(() => {
      expect(within(row).getByText("¥1,200")).toBeInTheDocument();
    });
    const actual = invalidateSpy.mock.calls
      .map(([filters]) => JSON.stringify(filters?.queryKey))
      .sort();
    const expected = [
      ["product-list"],
      ["product-form", "product", { productCode: "P-001" }],
      ["plu-dirty"],
      ["price-revision"],
    ]
      .map((key) => JSON.stringify(key))
      .sort();
    expect(actual).toEqual(expected);
  });

  it("確定失敗時は該当行だけ「確定できませんでした」と再試行を出し入力を保持し他行は変わらない", async () => {
    mockReviseProductPrice
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "synthetic failure", field: null, error_id: null },
      })
      .mockResolvedValueOnce({
        status: "ok",
        data: {
          product_code: "P-001",
          changed: true,
          plu_dirty_set: true,
          supplier_assigned: false,
        },
      });
    const user = userEvent.setup();
    renderStateful();
    const rowA = await screen.findByTestId("price-row-P-001");
    const rowB = screen.getByTestId("price-row-P-002");
    await user.type(within(rowA).getByLabelText("P-001 新売価"), "1200");
    await user.type(within(rowB).getByLabelText("P-002 新売価"), "500");
    await user.click(within(rowA).getByRole("button", { name: "P-001 を確定" }));
    expect(await within(rowA).findByText("確定できませんでした")).toBeInTheDocument();
    expect(within(rowA).getByLabelText("P-001 新売価")).toHaveValue(1200);
    expect(within(rowB).getByLabelText("P-002 新売価")).toHaveValue(500);
    await user.click(within(rowA).getByRole("button", { name: "P-001 を再試行" }));
    await waitFor(() => {
      expect(mockReviseProductPrice).toHaveBeenCalledTimes(2);
    });
  });

  it("確定の送信中は同じ行の入力と確定が無効化され他行は操作できる", async () => {
    let resolveMutation!: (value: Awaited<ReturnType<typeof commands.reviseProductPrice>>) => void;
    mockReviseProductPrice.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = resolve;
        }),
    );
    const user = userEvent.setup();
    renderStateful();
    const rowA = await screen.findByTestId("price-row-P-001");
    const rowB = screen.getByTestId("price-row-P-002");
    await user.type(within(rowA).getByLabelText("P-001 新売価"), "1200");
    await user.click(within(rowA).getByRole("button", { name: "P-001 を確定" }));
    expect(within(rowA).getByLabelText("P-001 新売価")).toBeDisabled();
    expect(within(rowA).getByRole("button", { name: "P-001 を確定中" })).toBeDisabled();
    expect(within(rowB).getByLabelText("P-002 新売価")).not.toBeDisabled();
    resolveMutation({
      status: "ok",
      data: { product_code: "P-001", changed: true, plu_dirty_set: true, supplier_assigned: false },
    });
  });

  it("新売価が負値または非整数なら field error を出し reviseProductPrice を呼ばない", async () => {
    const user = userEvent.setup();
    renderStateful();
    const row = await screen.findByTestId("price-row-P-001");
    const input = within(row).getByLabelText("P-001 新売価");
    await user.type(input, "-1");
    expect(within(row).getByText("0以上の整数で入力してください")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "P-001 を確定" })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "12.5");
    expect(within(row).getByText("0以上の整数で入力してください")).toBeInTheDocument();
    expect(mockReviseProductPrice).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, "0");
    expect(within(row).getByRole("button", { name: "P-001 を確定" })).toBeEnabled();
  });

  it("本日の changed_at を持つ行だけ「最近改定」badge を icon + text で表示する", async () => {
    arrangeList([
      ...DEFAULT_PRODUCTS,
      makeMockProductWithRelations({ product_code: "P-003", name: "履歴失敗" }),
      makeMockProductWithRelations({ product_code: "P-004", name: "履歴なし" }),
    ]);
    mockListPriceHistory.mockImplementation((code) => {
      if (code === "P-003") {
        return Promise.resolve({
          status: "error",
          error: { kind: "internal", message: "履歴失敗", field: null, error_id: null },
        });
      }
      const changedAt =
        code === "P-001"
          ? "2026-08-23T09:15:00"
          : code === "P-002"
            ? "2026-08-22T23:59:59"
            : undefined;
      return Promise.resolve({
        status: "ok",
        data:
          changedAt === undefined
            ? []
            : [
                {
                  id: 1,
                  old_selling_price: 1,
                  new_selling_price: 2,
                  old_cost_price: 1,
                  new_cost_price: 2,
                  changed_at: changedAt,
                },
              ],
      });
    });
    renderStateful();
    const rowA = await screen.findByTestId("price-row-P-001");
    const rowB = screen.getByTestId("price-row-P-002");
    const badge = await within(rowA).findByText("最近改定");
    expect(
      badge.closest("[data-slot=badge]")?.querySelector("svg[aria-hidden=true]"),
    ).not.toBeNull();
    expect(within(rowB).queryByText("最近改定")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("price-row-P-003")).queryByText("最近改定"),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("price-row-P-004")).queryByText("最近改定"),
    ).not.toBeInTheDocument();
  });

  it("再読み込みで確定前の入力が失われる旨の文言を常時表示する", async () => {
    renderStateful();
    expect(
      await screen.findByText(
        "画面を再読み込みすると、確定前に入力した新売価・新原価は失われます。1行ずつ確定してください。",
      ),
    ).toBeInTheDocument();
  });

  it("新しい取引先を追加すると createSupplier 後に listSuppliers を再取得し追加した取引先が filter で選択状態になる", async () => {
    mockCreateSupplier.mockResolvedValue({
      status: "ok",
      data: makeMockSupplier({ id: 44, name: "新規取引先" }),
    });
    mockListSuppliers
      .mockResolvedValueOnce({ status: "ok", data: [makeMockSupplier({ id: 7, name: "取引先A" })] })
      .mockResolvedValue({
        status: "ok",
        data: [
          makeMockSupplier({ id: 7, name: "取引先A" }),
          makeMockSupplier({ id: 44, name: "新規取引先" }),
        ],
      });
    const user = userEvent.setup();
    renderStateful();
    await screen.findByText("P-001");
    await user.click(screen.getByRole("button", { name: "新しい取引先を追加" }));
    await user.type(screen.getByLabelText("取引先名"), "  新規取引先  ");
    await user.click(screen.getByRole("button", { name: "追加する" }));
    await waitFor(() => {
      expect(mockListSuppliers).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateSupplier).toHaveBeenCalledWith("新規取引先");
    expect(screen.getByLabelText("取引先")).toHaveValue("44");
    expect(screen.getByRole("checkbox", { name: "取引先未設定の商品も含める" })).toBeChecked();
  });

  it("取引先名が空白のみなら createSupplier を呼ばず field error を出し失敗時は入力を保持する", async () => {
    const user = userEvent.setup();
    renderStateful();
    await screen.findByText("P-001");
    await user.click(screen.getByRole("button", { name: "新しい取引先を追加" }));
    const input = screen.getByLabelText("取引先名");
    await user.type(input, "   ");
    await user.click(screen.getByRole("button", { name: "追加する" }));
    expect(screen.getByRole("alert")).toHaveTextContent("取引先名を入力してください");
    expect(mockCreateSupplier).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, "保持する取引先");
    mockCreateSupplier.mockResolvedValue({
      status: "error",
      error: { kind: "internal", message: "追加失敗", field: null, error_id: null },
    });
    await user.click(screen.getByRole("button", { name: "追加する" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("追加失敗");
    expect(input).toHaveValue("保持する取引先");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "再試行" })).toBeInTheDocument();
  });

  it("部門候補の取得失敗は商品一覧を隠さず再試行できる", async () => {
    mockListDepartments
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "部門失敗", field: null, error_id: null },
      })
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "部門失敗", field: null, error_id: null },
      })
      .mockResolvedValue({
        status: "ok",
        data: [makeMockDepartment({ id: 1, name: "毛糸" })],
      });
    const user = userEvent.setup();
    renderStateful();

    expect(await screen.findByText("P-001")).toBeInTheDocument();
    const alert = await screen.findByRole("alert", {}, { timeout: 2500 });
    expect(alert).toHaveTextContent("部門一覧を取得できませんでした");
    await user.click(within(alert).getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(mockListDepartments).toHaveBeenCalledTimes(3);
    });
  });

  it("filter なしの 0 件は商品一覧への導線、filter ありの 0 件は「条件に一致する商品がありません」と「絞り込みを解除」を出す", async () => {
    arrangeList([]);
    const first = renderStateful();
    expect(await screen.findByText("該当する商品がありません")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品一覧を開く" })).toHaveAttribute(
      "href",
      "/products",
    );
    first.unmount();
    renderStateful({
      q: "該当なし",
      supplier: 7,
      includeUnassigned: false,
      dept: 1,
      discontinued: true,
      sort: "name",
      page: 2,
      perPage: 100,
    });
    expect(await screen.findByText("条件に一致する商品がありません")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "絞り込みを解除" }));
    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenLastCalledWith({
        keyword: null,
        department_id: null,
        supplier_id: null,
        include_unassigned: false,
        is_discontinued: false,
        plu: "all",
        sort_key: "ProductCode",
        sort_order: "Asc",
        page: 1,
        per_page: 50,
      });
    });
  });

  it("一覧取得失敗で Alert と再試行を出し再試行で再取得する", async () => {
    mockSearchProducts
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一覧失敗", field: null, error_id: null },
      })
      .mockResolvedValueOnce({
        status: "error",
        error: { kind: "internal", message: "一覧失敗", field: null, error_id: null },
      })
      .mockResolvedValue({
        status: "ok",
        data: { items: [], total_count: 0, page: 1, per_page: 50 },
      });
    const user = userEvent.setup();
    renderStateful();
    expect(await screen.findByRole("alert", {}, { timeout: 2500 })).toHaveTextContent(
      "商品一覧を取得できませんでした",
    );
    await user.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => {
      expect(mockSearchProducts).toHaveBeenCalledTimes(3);
    });
  });
});
