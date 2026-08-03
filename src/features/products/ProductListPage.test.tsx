// src/features/products/ProductListPage.test.tsx
//
// UI-01a: 商品検索・一覧 page integration。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
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
    // PR #98 Codex R2 P2 再発防止: SearchBar 共通化後も旧 contract の id を page が結線する
    // （patterns/SearchBar の commit 型既定は "search-input"、本画面は明示 id を渡す）
    expect(screen.getByLabelText("商品検索")).toHaveAttribute("id", "product-search-input");
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
    expect(await screen.findByText("部門一覧の取得に失敗しました")).toBeInTheDocument();
  });
});

describe("ProductListPage SPEC-UIBB-1/2（filter-empty reset action、既存「商品を登録する」と共存）", () => {
  beforeEach(() => {
    mockListDepartments.mockResolvedValue({
      status: "ok",
      data: [makeMockDepartment({ id: 1, name: "毛糸" }), makeMockDepartment({ id: 2, name: "布" })],
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
        search={{ q: "毛糸", dept: 2, discontinued: "discontinued", page: 3, sort: "name", dir: "desc", perPage: 100 }}
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
