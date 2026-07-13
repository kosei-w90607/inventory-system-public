// src/features/products/components/ProductTable.test.tsx
//
// UI-01a-D6: 単位付き在庫表示と廃番状態の非色シグナル。

import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeMockProductWithRelations } from "../lib/test-fixtures";
import { ProductTable } from "./ProductTable";

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

describe("ProductTable (UI-01a-D6 / UI-01a-D8)", () => {
  it("discontinued text badge and no state column", () => {
    render(
      <ProductTable
        items={[
          makeMockProductWithRelations({
            product_code: "F-0001",
            name: "生成り布",
            stock_quantity: 350,
            stock_unit: "cm",
            is_discontinued: true,
          }),
        ]}
      />,
    );

    const row = screen.getByText("F-0001").closest("tr");
    if (row === null) throw new Error("row not found");

    expect(within(row).getByText("350 cm")).toBeInTheDocument();
    // UI-01a-D8: 廃番は商品名セル内の text badge で示す（専用状態列なし）
    expect(within(row).getByText("廃番")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "状態" })).not.toBeInTheDocument();
    expect(screen.queryByText("cm/m切替")).not.toBeInTheDocument();
  });

  it("active product has no badge and no muted row", () => {
    render(
      <ProductTable
        items={[
          makeMockProductWithRelations({
            product_code: "P-100",
            name: "はさみ",
            is_discontinued: false,
          }),
        ]}
      />,
    );

    const row = screen.getByText("P-100").closest("tr");
    if (row === null) throw new Error("row not found");

    expect(within(row).queryByText("廃番")).not.toBeInTheDocument();
    expect(within(row).queryByText("表示中")).not.toBeInTheDocument();
    expect(row.className).not.toContain("text-muted-foreground");
  });
});
