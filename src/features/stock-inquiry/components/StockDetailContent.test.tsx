import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import type { StockDetail } from "@/lib/bindings";

import { StockDetailContent } from "./StockDetailContent";
import { makeMockProductWithRelations, makeMockStockDetail } from "../lib/test-fixtures";

describe("StockDetailContent (REQ-301 -> REQ-303)", () => {
  it("REQ-301: StockDetailContent shows active movement history link", () => {
    const data = makeMockStockDetail({
      product: makeMockProductWithRelations({ product_code: "BT0002", name: "ボタン #02" }),
    });

    render(
      <StockDetailContent
        query={{ isLoading: false, isError: false, data } as UseQueryResult<StockDetail>}
      />,
    );

    expect(screen.getByRole("link", { name: "在庫変動履歴" })).toHaveAttribute(
      "href",
      "/stock/BT0002/movements",
    );
  });
});
