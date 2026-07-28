// src/features/daily-sales/components/ProductTable.test.tsx
//
// REQ-501: H-6 feedback で商品コードが小さいと確認されたため、
// 日次売上の商品コード列は最小級 text-xs に戻さない。
// 設計: docs/plans/2026-06-07-display-scale-readability.md

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeMockItem } from "../lib/test-fixtures";
import type { GroupedSection } from "../types";
import { ProductTable } from "./ProductTable";

describe("ProductTable (REQ-501 商品コード readability)", () => {
  it("REQ-501: product code cell uses readable table text size", () => {
    const item = makeMockItem({ product_code: "HZ-0047", name: "生成り布" });
    const grouped: GroupedSection[] = [
      {
        departmentId: 1,
        departmentName: "布",
        items: [item],
        subtotal: {
          department_id: 1,
          department_name: "布",
          quantity: 1,
          amount: 100,
        },
      },
    ];

    render(
      <ProductTable
        grouped={grouped}
        sortBy={null}
        sortDir="asc"
        onSortChange={vi.fn()}
        grandTotal={null}
      />,
    );

    const cell = screen.getByText("HZ-0047").closest("td");
    expect(cell?.className).toContain("text-sm");
    expect(cell?.className).not.toContain("text-xs");
  });

  it("UI-09a: 5 sortable headers preserve click payload, ARIA, indicator, and alignment", () => {
    const onSortChange = vi.fn();
    const item = makeMockItem({ product_code: "HZ-0047", name: "生成り布" });
    const grouped: GroupedSection[] = [
      {
        departmentId: 1,
        departmentName: "布",
        items: [item],
        subtotal: {
          department_id: 1,
          department_name: "布",
          quantity: 1,
          amount: 100,
        },
      },
    ];

    render(
      <ProductTable
        grouped={grouped}
        sortBy="product_code"
        sortDir="asc"
        onSortChange={onSortChange}
        grandTotal={null}
      />,
    );

    const sortableHeaders = [
      ["商品コード", "product_code"],
      ["商品名", "name"],
      ["数量", "quantity"],
      ["単価", "unit_price"],
      ["金額", "amount"],
    ] as const;

    for (const [label] of sortableHeaders) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }

    expect(onSortChange).toHaveBeenCalledTimes(5);
    sortableHeaders.forEach(([, column], index) => {
      expect(onSortChange).toHaveBeenNthCalledWith(index + 1, column);
    });

    const productCodeButton = screen.getByRole("button", { name: "商品コード" });
    const productCodeHeader = productCodeButton.closest("th");
    const nameHeader = screen.getByRole("button", { name: "商品名" }).closest("th");
    const quantityHeader = screen.getByRole("button", { name: "数量" }).closest("th");

    expect(productCodeHeader).toHaveAttribute("aria-sort", "ascending");
    expect(nameHeader).toHaveAttribute("aria-sort", "none");
    expect(productCodeButton.querySelector('span[aria-hidden="true"]')).toHaveTextContent("▲");
    expect(screen.getByRole("button", { name: "商品名" })).not.toHaveTextContent(/[▲▼]/);
    expect(quantityHeader).toHaveClass("text-right");
    expect(nameHeader).not.toHaveClass("text-right");
  });
});

// B0 characterization: 空結果の EmptyState DOM 固定（意図的差分③）
// bare div → EmptyState 標準 UI に置換。title(h3) + description の 2 要素に分割される。
describe("ProductTable (B0 empty-state characterization)", () => {
  it("B0-daily-empty: grouped=[] のとき EmptyState の title と description が表示される", () => {
    render(
      <ProductTable
        grouped={[]}
        sortBy={null}
        sortDir="asc"
        onSortChange={vi.fn()}
        grandTotal={null}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "該当する売上明細がありません" }),
    ).toBeInTheDocument();
    expect(screen.getByText("日付や部門を変更してお試しください")).toBeInTheDocument();
  });
});
