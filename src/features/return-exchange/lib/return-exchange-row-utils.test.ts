import { describe, expect, it } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import {
  addProductToReturnRows,
  changeReturnRowDirection,
  productToReturnRow,
} from "./return-exchange-row-utils";

describe("return exchange row utils (UI-03 / REQ-202)", () => {
  it("REQ-202 maps a product to a return row with direction and current stock", () => {
    const row = productToReturnRow(
      makeMockProductWithRelations({
        product_code: "RT-001",
        name: "交換商品",
        department_name: "布",
        stock_quantity: 12,
        stock_unit: "cm",
      }),
      "out",
    );

    expect(row).toMatchObject({
      productCode: "RT-001",
      productName: "交換商品",
      departmentName: "布",
      stockUnit: "cm",
      currentStockQuantity: 12,
      direction: "out",
      quantity: "1",
    });
  });

  it("REQ-202 increments duplicate product by product code and direction", () => {
    const product = makeMockProductWithRelations({ product_code: "RT-001" });
    const rows = addProductToReturnRows(
      addProductToReturnRows(addProductToReturnRows([], product, "in"), product, "out"),
      product,
      "in",
    );

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.direction === "in")).toMatchObject({
      productCode: "RT-001",
      quantity: "2",
    });
    expect(rows.find((row) => row.direction === "out")).toMatchObject({
      productCode: "RT-001",
      quantity: "1",
    });
  });

  it("REQ-202 merges quantities when direction change collides with an existing product direction", () => {
    const product = makeMockProductWithRelations({ product_code: "RT-001" });
    const rows = addProductToReturnRows(addProductToReturnRows([], product, "in"), product, "out");

    const changed = changeReturnRowDirection(rows, "RT-001", "out", "in");

    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ productCode: "RT-001", direction: "in", quantity: "2" });
  });
});
