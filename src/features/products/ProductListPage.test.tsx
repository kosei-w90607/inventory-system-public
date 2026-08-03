// src/features/products/ProductListPage.test.tsx
//
// UI-01a: 商品検索・一覧 page integration。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import { makeMockDepartment, makeMockProductWithRelations } from "./lib/test-fixtures";
import { ProductListPage } from "./ProductListPage";
import type { ProductListSearch } from "./search";

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
    const resolvedTo = params?.code !== undefined ? to.replace("$code", params.code) : to;
    const query =
      search?.returnTo !== undefined ? `?returnTo=${encodeURIComponent(search.returnTo)}` : "";
    return <a href={`${resolvedTo}${query}`}>{children}</a>;
  },
}));

vi.mock("@/lib/bindings", () => ({
  commands: {
    searchProducts: vi.fn(),
    listDepartments: vi.fn(),
    listSuppliers: vi.fn(),
  },
}));

const mockSearchProducts = vi.mocked(commands.searchProducts);
const mockListDepartments = vi.mocked(commands.listDepartments);

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockSearchProducts.mockReset();
  mockListDepartments.mockReset();
});

describe("ProductListPage (UI-01a)", () => {
  it("renders active product list with department master options", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
    mockListDepartments.mockResolvedValue({
      status: "ok",
      data: [
        makeMockDepartment({ id: 1, name: "毛糸" }),
        makeMockDepartment({ id: 2, name: "布" }),
      ],
    });

    renderWithClient(<ProductListPage search={{}} onSearchChange={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "商品検索・一覧" })).toBeInTheDocument();
    expect(await screen.findByText("P-001")).toBeInTheDocument();
    expect(screen.getByText("はさみ")).toBeInTheDocument();
    // UI-01a-D9（2026-08-03 gated amendment）: live 型化により明示 id 契約（旧 PR #98 Codex R2 P2）は
    // 廃止。live 型は Label htmlFor 結線を持たず aria-label で識別する。
    expect(screen.getByLabelText("商品検索")).toHaveAttribute("type", "search");
    expect(
      Array.from(
        screen.getByRole("group", { name: "廃番表示" }).querySelectorAll("button"),
        (button) => button.textContent,
      ),
    ).toEqual(["表示中", "すべて", "廃番のみ"]);
    expect(screen.getByRole("link", { name: "商品登録" })).toHaveAttribute(
      "href",
      "/products/new?returnTo=%2Fproducts%3Fdiscontinued%3Dactive%26sort%3Dproduct_code%26dir%3Dasc%26page%3D1%26perPage%3D50",
    );
    expect(screen.getByRole("link", { name: "修正" })).toHaveAttribute(
      "href",
      "/products/P-001/edit?returnTo=%2Fproducts%3Fdiscontinued%3Dactive%26sort%3Dproduct_code%26dir%3Dasc%26page%3D1%26perPage%3D50",
    );
    await waitFor(() => {
      expect(mockListDepartments).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps controls visible when product query fails", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "error",
      error: { kind: "internal", message: "取得に失敗しました", field: null, error_id: null },
    });
    mockListDepartments.mockResolvedValue({ status: "ok", data: [makeMockDepartment()] });

    renderWithClient(<ProductListPage search={{ q: "はさみ" }} onSearchChange={vi.fn()} />);

    expect(screen.getByLabelText("商品検索")).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.getByText("商品一覧の取得に失敗しました")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  // B0 characterization: 空結果の EmptyState DOM 固定（意図的差分③）
  // bare div → EmptyState 標準 UI に置換。title(h3) + description の 2 要素に分割される。
  it("B0-products-empty: products query が items 空を返したとき EmptyState の title と description が表示される", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [],
        total_count: 0,
        page: 1,
        per_page: 50,
      },
    });
    mockListDepartments.mockResolvedValue({ status: "ok", data: [] });

    renderWithClient(<ProductListPage search={{}} onSearchChange={vi.fn()} />);

    expect(
      await screen.findByRole("heading", { name: "該当する商品がありません" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("検索条件を変更するか、新しい商品を登録してください"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品を登録する" })).toBeInTheDocument();
  });

  it("shows department loading failure without breaking product search controls", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "P-002", name: "布地" })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
    mockListDepartments.mockResolvedValue({
      status: "error",
      error: {
        kind: "internal",
        message: "部門取得に失敗しました",
        field: null,
        error_id: null,
      },
    });

    renderWithClient(<ProductListPage search={{}} onSearchChange={vi.fn()} />);

    expect(screen.getByLabelText("商品検索")).toBeInTheDocument();
    expect(await screen.findByText("P-002")).toBeInTheDocument();
    // departmentsQuery は production 設計で retry: 1 を持つ（QueryClient default を上書き）ため、
    // 失敗確定まで retry delay 約 1s を要する。既定 timeout 1000ms は並列負荷で同着 flake する
    // （batch B L1 で実測）ので延長する。
    expect(
      await screen.findByText("部門一覧の取得に失敗しました", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});

describe("ProductListPage SPEC-UIBB-1/2（filter-empty reset action、既存「商品を登録する」と共存）", () => {
  beforeEach(() => {
    mockListDepartments.mockResolvedValue({
      status: "ok",
      data: [
        makeMockDepartment({ id: 1, name: "毛糸" }),
        makeMockDepartment({ id: 2, name: "布" }),
      ],
    });
  });

  it("SPEC-UIBB-1 絞り込み該当なしで解除ボタンを表示する", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 50 },
    });
    renderWithClient(
      <ProductListPage search={{ q: "該当なし", dept: 1 }} onSearchChange={vi.fn()} />,
    );
    expect(await screen.findByRole("button", { name: "絞り込みを解除" })).toBeInTheDocument();
  });

  it("SPEC-UIBB-1 既定条件の0件では解除ボタンを出さない（登録のみ表示）", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 50 },
    });
    renderWithClient(<ProductListPage search={{}} onSearchChange={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "商品を登録する" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "絞り込みを解除" })).not.toBeInTheDocument();
  });

  it("SPEC-UIBB-1 既定0件は登録のみ・非既定0件は登録と解除の2ボタン", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 50 },
    });
    const defaultRender = renderWithClient(
      <ProductListPage search={{}} onSearchChange={vi.fn()} />,
    );
    expect(await screen.findByRole("link", { name: "商品を登録する" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "絞り込みを解除" })).not.toBeInTheDocument();
    defaultRender.unmount();

    renderWithClient(<ProductListPage search={{ q: "毛糸" }} onSearchChange={vi.fn()} />);
    expect(await screen.findByRole("link", { name: "商品を登録する" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "絞り込みを解除" })).toBeInTheDocument();
  });

  it("SPEC-UIBB-2 解除で全条件が既定値に戻り、sort/dir/perPageは変更しない", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 50 },
    });
    const onSearchChange = vi.fn();
    renderWithClient(
      <ProductListPage
        search={{
          q: "毛糸",
          dept: 2,
          discontinued: "discontinued",
          page: 3,
          sort: "name",
          dir: "desc",
          perPage: 100,
        }}
        onSearchChange={onSearchChange}
      />,
    );
    const resetButton = await screen.findByRole("button", { name: "絞り込みを解除" });
    await userEvent.setup().click(resetButton);

    const updater = onSearchChange.mock.calls[onSearchChange.mock.calls.length - 1]?.[0] as (
      prev: ProductListSearch,
    ) => ProductListSearch;
    const result = updater({
      q: "毛糸",
      dept: 2,
      discontinued: "discontinued",
      page: 3,
      sort: "name",
      dir: "desc",
      perPage: 100,
    });
    expect(result.q).toBeUndefined();
    expect(result.dept).toBeUndefined();
    expect(result.discontinued).toBeUndefined();
    expect(result.page).toBe(1);
    // sort / dir / perPage は絞り込み条件ではないため reset で変更しない
    expect(result.sort).toBe("name");
    expect(result.dir).toBe("desc");
    expect(result.perPage).toBe(100);
  });
});

describe("ProductListPage SPEC-UIBB-10/11（live 型検索 + 複数ボタン中央揃え、UI-01a-D9）", () => {
  beforeEach(() => {
    mockListDepartments.mockResolvedValue({
      status: "ok",
      data: [makeMockDepartment({ id: 1, name: "毛糸" })],
    });
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
  });

  it("SPEC-UIBB-10 検索入力が200msデバウンスでqに反映される", async () => {
    const onSearchChange = vi.fn();
    renderWithClient(<ProductListPage search={{ page: 2 }} onSearchChange={onSearchChange} />);
    const input = screen.getByLabelText("商品検索");
    await userEvent.setup().type(input, "はさみ");
    await waitFor(
      () => {
        const call = onSearchChange.mock.calls.find((c) => {
          const updater = c[0] as (prev: ProductListSearch) => ProductListSearch;
          return updater({ page: 2 }).q === "はさみ";
        });
        expect(call).toBeDefined();
      },
      { timeout: 3000 },
    );
    const call = onSearchChange.mock.calls.find((c) => {
      const updater = c[0] as (prev: ProductListSearch) => ProductListSearch;
      return updater({ page: 2 }).q === "はさみ";
    });
    const updater = call?.[0] as (prev: ProductListSearch) => ProductListSearch;
    // q 変更（page 以外の変更）は pageOnlyChange 機構で page=1 に戻る
    expect(updater({ page: 2 }).page).toBe(1);
  });

  it("SPEC-UIBB-10 検索ボタンとLabelを表示しない", () => {
    renderWithClient(<ProductListPage search={{}} onSearchChange={vi.fn()} />);
    const input = screen.getByLabelText("商品検索");
    expect(input).toHaveAttribute("type", "search");
    expect(screen.queryByRole("button", { name: "検索" })).not.toBeInTheDocument();
    expect(screen.queryByText("検索", { selector: "label" })).not.toBeInTheDocument();
  });

  it("SPEC-UIBB-10 Enterで即時flushしIME変換確定Enterでは発火しない", () => {
    const onSearchChange = vi.fn();
    renderWithClient(<ProductListPage search={{}} onSearchChange={onSearchChange} />);
    const input = screen.getByLabelText("商品検索");

    // IME 変換確定の Enter は発火しない
    fireEvent.change(input, { target: { value: "はさみ" } });
    const composingEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(composingEnter, "isComposing", { value: true, configurable: true });
    input.dispatchEvent(composingEnter);
    expect(onSearchChange).not.toHaveBeenCalled();

    // 通常の Enter は debounce を待たず即時 flush
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSearchChange).toHaveBeenCalled();
    const updater = onSearchChange.mock.calls[0]?.[0] as (
      prev: ProductListSearch,
    ) => ProductListSearch;
    expect(updater({}).q).toBe("はさみ");
  });

  it("SPEC-UIBB-10 クリアでqが外れpageが既定に戻る", async () => {
    const onSearchChange = vi.fn();
    renderWithClient(
      <ProductListPage search={{ q: "はさみ", page: 3 }} onSearchChange={onSearchChange} />,
    );
    const input = screen.getByLabelText("商品検索");
    await userEvent.setup().clear(input);
    await waitFor(
      () => {
        const call = onSearchChange.mock.calls.find((c) => {
          const updater = c[0] as (prev: ProductListSearch) => ProductListSearch;
          return updater({ q: "はさみ", page: 3 }).q === undefined;
        });
        expect(call).toBeDefined();
      },
      { timeout: 3000 },
    );
    const call = onSearchChange.mock.calls.find((c) => {
      const updater = c[0] as (prev: ProductListSearch) => ProductListSearch;
      return updater({ q: "はさみ", page: 3 }).q === undefined;
    });
    const updater = call?.[0] as (prev: ProductListSearch) => ProductListSearch;
    expect(updater({ q: "はさみ", page: 3 }).page).toBe(1);
    expect(input).toHaveValue("");
  });

  it("SPEC-UIBB-10 空白込み入力が表示保持されCMDのkeywordだけがtrimされる", async () => {
    // controlled harness: updater の結果を search prop に反映して再描画する
    function Harness() {
      const [search, setSearch] = useState<ProductListSearch>({});
      return (
        <ProductListPage
          search={search}
          onSearchChange={(updater) => {
            setSearch((prev) => updater(prev));
          }}
        />
      );
    }
    renderWithClient(<Harness />);
    const input = screen.getByLabelText("商品検索");
    fireEvent.change(input, { target: { value: "  はさみ  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    // 再描画後も入力表示は空白込みのまま（normalizedSearch.q 結線なら trim 済みに書き戻される）
    await waitFor(() => {
      expect(input).toHaveValue("  はさみ  ");
    });
    // CMD payload の keyword だけが trim される
    await waitFor(() => {
      const keywords = mockSearchProducts.mock.calls.map((c) => c[0].keyword);
      expect(keywords).toContain("はさみ");
    });
    expect(mockSearchProducts.mock.calls.map((c) => c[0].keyword)).not.toContain("  はさみ  ");
  });

  it("SPEC-UIBB-11 空状態の2ボタンは中央揃えで登録が先", async () => {
    mockSearchProducts.mockResolvedValue({
      status: "ok",
      data: { items: [], total_count: 0, page: 1, per_page: 50 },
    });
    renderWithClient(<ProductListPage search={{ q: "存在しない" }} onSearchChange={vi.fn()} />);
    const resetButton = await screen.findByRole("button", { name: "絞り込みを解除" });
    const wrapper = resetButton.parentElement;
    if (wrapper === null) {
      throw new Error("reset button has no parent wrapper");
    }
    expect(wrapper).toHaveClass("justify-center");
    const registerLink = within(wrapper).getByRole("link", {
      name: "商品を登録する",
    });
    // 「商品を登録する」が先、「絞り込みを解除」が後（DOM 順序）
    expect(
      registerLink.compareDocumentPosition(resetButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
