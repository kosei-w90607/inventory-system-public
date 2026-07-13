// src/features/stock-inquiry/StockInquiryPage.test.tsx
//
// REQ-301: StockInquiryPage の結果 1 件自動展開（Q-3 補強）。
// list query 結果が 1 件のとき useEffect → onSearchChange で selected URL state を更新。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7 / §58.9

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState, type ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import type { StockInquirySearch } from "./types";
import { StockInquiryPage } from "./StockInquiryPage";
import { makeMockProductWithRelations, makeMockStockDetail } from "./lib/test-fixtures";

vi.mock("@/lib/bindings", () => ({
  commands: {
    searchProducts: vi.fn(),
    listLowStock: vi.fn(),
    getStockDetail: vi.fn(),
  },
}));

const mockSearch = vi.mocked(commands.searchProducts);
const mockLowStock = vi.mocked(commands.listLowStock);
const mockDetail = vi.mocked(commands.getStockDetail);

function renderWithClient(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  mockSearch.mockReset();
  mockLowStock.mockReset();
  mockDetail.mockReset();
});

// B0 characterization: 空結果の EmptyState DOM 固定（意図的差分③）
// bare div → EmptyState 標準 UI に置換。title(h3) + description の 2 要素に分割される。
// useStockInquiry を内蔵する page なので renderWithClient で render し bindings を vi.mock する
describe("StockInquiryPage (B0 empty-state characterization)", () => {
  it("B0-stock-empty: searchProducts が items 空を返したとき EmptyState の title と description が表示される", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [],
        total_count: 0,
        page: 1,
        per_page: 50,
      },
    });
    renderWithClient(
      <StockInquiryPage search={{ q: "存在しない商品", status: "all" }} onSearchChange={vi.fn()} />,
    );

    expect(
      await screen.findByRole("heading", { name: "該当する商品がありません" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("商品コード・商品名・JANコードを変えてもう一度検索してください"),
    ).toBeInTheDocument();
  });
});

describe("StockInquiryPage (REQ-301 自動展開)", () => {
  it("REQ-302: search result stockout reaches page as 在庫切れ", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "P-ZERO", stock_quantity: 0 })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
    const onSearchChange = vi.fn();
    renderWithClient(
      <StockInquiryPage search={{ q: "P-ZERO", status: "all" }} onSearchChange={onSearchChange} />,
    );

    const codeCell = await screen.findByText("P-ZERO");
    const row = codeCell.closest("tr");
    if (row === null) {
      throw new Error("P-ZERO row not found");
    }
    expect(within(row).getByText("在庫切れ")).toBeInTheDocument();
  });

  it("REQ-302: low_stock result reaches page as 在庫少", async () => {
    mockLowStock.mockResolvedValue({
      status: "ok",
      data: [
        makeMockProductWithRelations({
          product_code: "P-LOW",
          name: "少ない商品",
          stock_quantity: 2,
        }),
      ],
    });
    const onSearchChange = vi.fn();
    renderWithClient(
      <StockInquiryPage search={{ status: "low_stock" }} onSearchChange={onSearchChange} />,
    );

    const codeCell = await screen.findByText("P-LOW");
    const row = codeCell.closest("tr");
    if (row === null) {
      throw new Error("P-LOW row not found");
    }
    expect(within(row).getByText("在庫少")).toBeInTheDocument();
  });

  it("REQ-301: 検索結果 1 件で onSearchChange に selected を渡し詳細を自動展開", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [makeMockProductWithRelations({ product_code: "SOLO-1" })],
        total_count: 1,
        page: 1,
        per_page: 50,
      },
    });
    const onSearchChange = vi.fn();
    renderWithClient(
      <StockInquiryPage search={{ q: "SOLO", status: "all" }} onSearchChange={onSearchChange} />,
    );

    // list 結果 1 件で auto-expand useEffect が onSearchChange を呼ぶ
    await waitFor(() => {
      expect(onSearchChange).toHaveBeenCalled();
    });
    // updater を適用して selected が SOLO-1 になることを確認
    const updaters = onSearchChange.mock.calls.map((call) => call[0] as (p: object) => object);
    const results = updaters.map((u) => u({}));
    expect(results).toContainEqual(expect.objectContaining({ selected: "SOLO-1" }));
  });

  it("REQ-301: 一覧 query 失敗 + 詳細 query 成功でも詳細カードを独立描画（部分障害許容、§58.8）", async () => {
    // 一覧（search_products）失敗・詳細（get_stock_detail）成功の部分障害シナリオ。
    // 行インライン展開は list 成功前提のため、list 失敗時は Alert 下のフォールバックカードに
    // 詳細を独立描画する（§58.8、Codex Round 1 P2-1 の契約を構造変更後も維持）。
    mockSearch.mockResolvedValue({
      status: "error",
      error: { kind: "internal", message: "一覧の取得に失敗しました", field: null },
    });
    mockDetail.mockResolvedValue({
      status: "ok",
      data: makeMockStockDetail({
        product: makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
      }),
    });
    const onSearchChange = vi.fn();
    renderWithClient(
      <StockInquiryPage
        search={{ q: "はさみ", status: "all", selected: "P-001" }}
        onSearchChange={onSearchChange}
      />,
    );

    // 一覧は取得失敗 Alert、詳細カードは独立して描画される（listQuery の retry:1 backoff を待つ）。
    await waitFor(
      () => {
        expect(screen.getByText("取得に失敗しました")).toBeInTheDocument();
        expect(screen.getByText("在庫数")).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    // 詳細カード固有の商品コード（CardTitle 内）も描画されている。
    expect(screen.getByText("P-001")).toBeInTheDocument();
  });

  it("REQ-301: list 成功 + selected 指定で選択行直下にインライン展開（§58.8）", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
          makeMockProductWithRelations({ product_code: "P-002", name: "ボタン" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 50,
      },
    });
    mockDetail.mockResolvedValue({
      status: "ok",
      data: makeMockStockDetail({
        product: makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
      }),
    });
    const onSearchChange = vi.fn();
    renderWithClient(
      <StockInquiryPage
        search={{ q: "P", status: "all", selected: "P-001" }}
        onSearchChange={onSearchChange}
      />,
    );
    // 詳細（最終入庫日 = 列ヘッダと衝突しないラベル）が選択行直下のインライン展開行に描画される。
    // colSpan 展開行の DOM 構造（nextElementSibling）は ProductListTable.test で検証済み。
    await waitFor(() => {
      expect(screen.getByText("最終入庫日")).toBeInTheDocument();
    });
  });

  it("REQ-301: 行クリックで selected が更新され選択行直下に展開する（統合経路、C-P2-3）", async () => {
    mockSearch.mockResolvedValue({
      status: "ok",
      data: {
        items: [
          makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
          makeMockProductWithRelations({ product_code: "P-002", name: "ボタン" }),
        ],
        total_count: 2,
        page: 1,
        per_page: 50,
      },
    });
    mockDetail.mockResolvedValue({
      status: "ok",
      data: makeMockStockDetail({
        product: makeMockProductWithRelations({ product_code: "P-002", name: "ボタン" }),
      }),
    });
    // onSearchChange updater を useState に適用する stateful harness（URL state を実更新する）
    function Harness() {
      const [search, setSearch] = useState<StockInquirySearch>({ q: "P", status: "all" });
      return (
        <StockInquiryPage
          search={search}
          onSearchChange={(updater) => {
            setSearch((prev) => updater(prev));
          }}
        />
      );
    }
    const user = userEvent.setup();
    renderWithClient(<Harness />);
    // 一覧 2 件描画（自動展開なし）。クリック前は詳細なし。
    await waitFor(() => {
      expect(screen.getByText("ボタン")).toBeInTheDocument();
    });
    expect(screen.queryByText("最終入庫日")).not.toBeInTheDocument();
    // ボタン行（P-002）をクリック → selected 更新 → 直下にインライン展開
    await user.click(screen.getByText("ボタン"));
    await waitFor(() => {
      expect(screen.getByText("最終入庫日")).toBeInTheDocument();
    });
  });
});
