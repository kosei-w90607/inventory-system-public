// src/features/monthly-sales/components/ProductRankingTable.test.tsx
//
// REQ-502 P2-2: ProductRankingTable の SortableHeader 結線テスト (4 列: name/
// quantity/amount/prev_month_diff の click → onSortChange call、順位列はソート
// 対象外)。G-3: sort 後も ranking===1 行に Badge が追従する (sort で順序入替後も
// item.ranking field を base に Badge 強調)。
// 設計: docs/plans/2026-05-19-pr-66-codex-r1-p2-fixes.md §2 commit 2

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ProductRankingTable } from "./ProductRankingTable";
import { makeMockProductRankingRow } from "../lib/test-fixtures";
import type { SortColumn } from "../types";

// B0 characterization: 空結果の EmptyState DOM 固定（意図的差分③）
// bare div → EmptyState 標準 UI に置換。title(h3) + description の 2 要素に分割される。
// plan B0 reachability 注記: page 経由（MonthlySalesPage の query empty mock）では
// page が先に月度メッセージを出すため、このテーブル内空分岐には到達不能。
// 必ず rows=[] の直接 render で characterization する（R3 P2-B）。
describe("ProductRankingTable (B0 empty-state characterization)", () => {
  it("B0-ranking-empty: rows=[] のとき EmptyState の title と description が表示される", () => {
    render(
      <ProductRankingTable
        rows={[]}
        comparisonMap={new Map()}
        sortBy={null}
        sortDir="asc"
        onSortChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "該当する売上明細がありません" }),
    ).toBeInTheDocument();
    expect(screen.getByText("月や部門を変更してお試しください")).toBeInTheDocument();
  });
});

describe("ProductRankingTable (REQ-502 sort 結線)", () => {
  it("REQ-502: SortableHeader 4 列 click で onSortChange が name/quantity/amount/prev_month_diff を順に call、順位列はソート対象外", () => {
    const onSortChange = vi.fn<(column: SortColumn) => void>();
    const rows = [
      makeMockProductRankingRow({ key: "A", label: "商品A", ranking: 1, amount: 1000 }),
      makeMockProductRankingRow({ key: "B", label: "商品B", ranking: 2, amount: 500 }),
    ];
    render(
      <ProductRankingTable
        rows={rows}
        comparisonMap={new Map()}
        sortBy={null}
        sortDir="asc"
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /商品名/ }));
    fireEvent.click(screen.getByRole("button", { name: /数量/ }));
    fireEvent.click(screen.getByRole("button", { name: /金額/ }));
    fireEvent.click(screen.getByRole("button", { name: /前月比/ }));

    expect(onSortChange).toHaveBeenCalledTimes(4);
    expect(onSortChange).toHaveBeenNthCalledWith(1, "name");
    expect(onSortChange).toHaveBeenNthCalledWith(2, "quantity");
    expect(onSortChange).toHaveBeenNthCalledWith(3, "amount");
    expect(onSortChange).toHaveBeenNthCalledWith(4, "prev_month_diff");
    // 順位列はソート対象外 = button ではない
    expect(screen.queryByRole("button", { name: /順位/ })).toBeNull();
  });

  it("REQ-502 G-3: sort 後の reordered rows でも ranking===1 行に Badge が追従する", () => {
    // sort 適用後の rows (上位 hook で sort 済、ranking 1 row は順序入替後の位置に存在)
    // 例: amount desc sort 後の順序 = [商品B (rank 2, amount 1000), 商品A (rank 1, amount 500)]
    const sortedRows = [
      makeMockProductRankingRow({ key: "B", label: "商品B", ranking: 2, amount: 1000 }),
      makeMockProductRankingRow({ key: "A", label: "商品A", ranking: 1, amount: 500 }),
    ];
    render(
      <ProductRankingTable
        rows={sortedRows}
        comparisonMap={new Map()}
        sortBy="amount"
        sortDir="desc"
        onSortChange={vi.fn()}
      />,
    );
    // ranking===1 の 商品A 行 (sort 後は 2 行目に位置) に "1 位" Badge が存在する（色 class 非依存）
    const productA = screen.getByText("商品A");
    const rowEl = productA.closest("tr");
    expect(rowEl).not.toBeNull();
    // 1 位 Badge は同行に "1 位" テキストを持つ要素として存在
    const badgeEl = rowEl ? screen.getAllByText("1 位").find((el) => rowEl.contains(el)) : null;
    expect(badgeEl).not.toBeUndefined();
    expect(badgeEl?.textContent).toContain("1 位");
  });
});
