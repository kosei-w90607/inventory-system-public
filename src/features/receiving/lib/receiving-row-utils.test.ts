import { describe, expect, it } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { addProductToRows } from "./receiving-row-utils";

describe("receiving-row-utils (UI-02-D6 / REQ-201)", () => {
  it("adds a new product row with quantity 1 and product cost", () => {
    const rows = addProductToRows(
      [],
      makeMockProductWithRelations({
        product_code: "P-001",
        name: "はさみ",
        cost_price: 120,
      }),
    );

    expect(rows).toEqual([
      {
        productCode: "P-001",
        productName: "はさみ",
        stockUnit: "pcs",
        quantity: "1",
        costPrice: "120",
      },
    ]);
  });

  it("increments quantity when the same product is added again", () => {
    const product = makeMockProductWithRelations({ product_code: "P-001" });
    const once = addProductToRows([], product);
    const twice = addProductToRows(once, product);

    expect(twice).toHaveLength(1);
    expect(twice[0].quantity).toBe("2");
  });
});
