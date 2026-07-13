import { describe, expect, it } from "vitest";

import { makeMockProductWithRelations } from "@/features/products/lib/test-fixtures";
import { addProductToManualSaleRows, productToManualSaleRow } from "./manual-sale-row-utils";

describe("manual sale row utils (UI-04 / REQ-203)", () => {
  it("REQ-203 maps a product to a manual sale row with selling price as initial amount", () => {
    const row = productToManualSaleRow(
      makeMockProductWithRelations({
        product_code: "MS-001",
        name: "新商品",
        department_name: "布",
        selling_price: 120,
        stock_quantity: 3,
        stock_unit: "cm",
      }),
    );

    expect(row).toMatchObject({
      productCode: "MS-001",
      productName: "新商品",
      departmentName: "布",
      stockUnit: "cm",
      currentStockQuantity: 3,
      unitPrice: 120,
      quantity: "1",
      amount: "120",
    });
  });

  it("REQ-203 merges duplicate product codes by incrementing quantity and amount", () => {
    const product = makeMockProductWithRelations({
      product_code: "MS-001",
      selling_price: 150,
    });

    const rows = addProductToManualSaleRows(addProductToManualSaleRows([], product), product);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productCode: "MS-001", quantity: "2", amount: "300" });
  });
});
