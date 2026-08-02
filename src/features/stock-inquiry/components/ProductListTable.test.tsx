// src/features/stock-inquiry/components/ProductListTable.test.tsx
//
// REQ-301: ProductListTable の選択行直下インライン展開（colSpan 展開行）+ detail 状態描画。
// 旧「テーブル下部固定カード」実装の混入を nextElementSibling colSpan guard で落とす（C-P2-3）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7 / §58.8

import { describe, it, expect, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import type { StockDetail } from "@/lib/bindings";
import { renderWithRouter } from "@/test/render-with-router";
import { ProductListTable } from "./ProductListTable";
import { makeMockProductWithRelations, makeMockStockDetail } from "../lib/test-fixtures";

function makeDetailQuery(
  overrides: Partial<UseQueryResult<StockDetail>> = {},
): UseQueryResult<StockDetail> {
  return {
    isLoading: false,
    isError: false,
    isSuccess: true,
    data: makeMockStockDetail(),
    ...overrides,
  } as unknown as UseQueryResult<StockDetail>;
}

// name は department_name デフォルト（"毛糸"）と衝突しない一意名にする（getByText 複数マッチ回避）。
const items = [
  makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
  makeMockProductWithRelations({ product_code: "P-002", name: "ボタン" }),
];

describe("ProductListTable (REQ-301 インライン展開)", () => {
  it("REQ-302: stockout row renders 在庫切れ badge label", async () => {
    renderWithRouter(
      <ProductListTable
        items={[makeMockProductWithRelations({ product_code: "P-ZERO", stock_quantity: 0 })]}
        source="search"
        selected={null}
        detailQuery={makeDetailQuery()}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText("在庫切れ")).toBeInTheDocument();
  });

  it("REQ-302: low-stock row renders 在庫少 badge label", async () => {
    renderWithRouter(
      <ProductListTable
        items={[makeMockProductWithRelations({ product_code: "P-LOW", stock_quantity: 2 })]}
        source="low_stock"
        selected={null}
        detailQuery={makeDetailQuery()}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText("在庫少")).toBeInTheDocument();
  });

  it("REQ-302: search positive stock renders 通常 status label", async () => {
    renderWithRouter(
      <ProductListTable
        items={[makeMockProductWithRelations({ product_code: "P-OK", stock_quantity: 10 })]}
        source="search"
        selected={null}
        detailQuery={makeDetailQuery()}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText("通常")).toBeInTheDocument();
  });

  it("REQ-301: product code cell uses readable table text size", async () => {
    renderWithRouter(
      <ProductListTable
        items={[makeMockProductWithRelations({ product_code: "HZ-0047", stock_quantity: 10 })]}
        source="search"
        selected={null}
        detailQuery={makeDetailQuery()}
        onSelect={vi.fn()}
      />,
    );
    const cell = (await screen.findByText("HZ-0047")).closest("td");
    expect(cell?.className).toContain("text-sm");
    expect(cell?.className).not.toContain("text-xs");
  });

  it("REQ-301: detail header product code uses readable table text size", async () => {
    const { container } = renderWithRouter(
      <ProductListTable
        items={items}
        source="search"
        selected="P-001"
        detailQuery={makeDetailQuery({
          data: makeMockStockDetail({
            product: makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
          }),
        })}
        onSelect={vi.fn()}
      />,
    );
    await screen.findByText("最終入庫日");
    const detailCode = container.querySelector('tr[data-state="selected"] + tr span.font-mono');
    expect(detailCode?.textContent).toBe("P-001");
    expect(detailCode?.className).toContain("text-sm");
    expect(detailCode?.className).not.toContain("text-xs");
  });

  it("REQ-301: 選択行の直下に詳細をインライン展開する", async () => {
    renderWithRouter(
      <ProductListTable
        items={items}
        source="search"
        selected="P-001"
        detailQuery={makeDetailQuery({
          data: makeMockStockDetail({
            product: makeMockProductWithRelations({ product_code: "P-001", name: "はさみ" }),
          }),
        })}
        onSelect={vi.fn()}
      />,
    );
    // 展開行内に詳細が描画される（「最終入庫日」は列ヘッダと衝突しないラベル）
    expect(await screen.findByText("最終入庫日")).toBeInTheDocument();
  });

  it("REQ-301: 選択行の nextElementSibling が colSpan 展開行（td[colspan=6]、旧下部固定の混入 guard）", async () => {
    renderWithRouter(
      <ProductListTable
        items={items}
        source="search"
        selected="P-001"
        detailQuery={makeDetailQuery()}
        onSelect={vi.fn()}
      />,
    );
    const codeCell = await screen.findByText("P-001");
    const selectedRow = codeCell.closest("tr");
    expect(selectedRow).not.toBeNull();
    const expansionRow = selectedRow?.nextElementSibling;
    expect(expansionRow?.querySelector('td[colspan="6"]')).not.toBeNull();
  });

  it("REQ-301: 非選択時は展開行を描画しない", async () => {
    renderWithRouter(
      <ProductListTable
        items={items}
        source="search"
        selected={null}
        detailQuery={makeDetailQuery()}
        onSelect={vi.fn()}
      />,
    );
    await screen.findByText("はさみ");
    expect(screen.queryByText("最終入庫日")).not.toBeInTheDocument();
  });

  it("REQ-301: detail 失敗時は展開行内に inline エラー（部分障害許容、一覧は維持、§58.8）", async () => {
    renderWithRouter(
      <ProductListTable
        items={items}
        source="search"
        selected="P-001"
        detailQuery={makeDetailQuery({ isError: true, isSuccess: false, data: undefined })}
        onSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText(/商品詳細の取得に失敗しました/)).toBeInTheDocument();
    // 一覧自体は維持（非選択の他商品行は残る）
    expect(screen.getByText("ボタン")).toBeInTheDocument();
  });

  it("REQ-301: 展開行 td は whitespace-normal で折り返し可（Codex Round1 P2-1、旧 nowrap 回帰 guard）", async () => {
    renderWithRouter(
      <ProductListTable
        items={items}
        source="search"
        selected="P-001"
        detailQuery={makeDetailQuery()}
        onSelect={vi.fn()}
      />,
    );
    const expansionCell = (await screen.findByText("P-001"))
      .closest("tr")
      ?.nextElementSibling?.querySelector("td");
    expect(expansionCell?.className).toContain("whitespace-normal");
  });
});
