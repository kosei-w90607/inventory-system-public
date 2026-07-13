import { describe, expect, it } from "vitest";

import type { ManualSaleFormValues } from "../types";
import { buildManualSaleRequest, buildManualSaleSignature } from "./manual-sale-request";

function createValues(overrides: Partial<ManualSaleFormValues> = {}): ManualSaleFormValues {
  return {
    saleDate: "2026-06-26",
    reason: "plu_unregistered",
    note: "",
    rows: [
      {
        productCode: "MS-001",
        productName: "新商品",
        departmentName: "布",
        stockUnit: "pcs",
        currentStockQuantity: 5,
        unitPrice: 120,
        quantity: "2",
        amount: "240",
      },
    ],
    ...overrides,
  };
}

describe("manual sale request builder (UI-04 / REQ-203)", () => {
  it("REQ-203 builds the generated createManualSale request shape", () => {
    const built = buildManualSaleRequest(createValues({ note: "店頭販売" }), "ms-key-1", null);

    expect(built.errors).toEqual({});
    expect(built.request).toEqual({
      idempotency_key: "ms-key-1",
      sale_date: "2026-06-26",
      reason: "plu_unregistered",
      note: "店頭販売",
      items: [{ product_code: "MS-001", quantity: 2, amount: 240 }],
      confirmation_token: null,
    });
  });

  it("REQ-203 blocks empty rows and invalid numeric fields before submit", () => {
    const built = buildManualSaleRequest(
      createValues({
        saleDate: "",
        rows: [
          {
            productCode: "MS-001",
            productName: "新商品",
            departmentName: "布",
            stockUnit: "pcs",
            currentStockQuantity: 5,
            unitPrice: 120,
            quantity: "1.5",
            amount: "-1",
          },
        ],
      }),
      "ms-key-1",
      null,
    );

    expect(built.request).toBeNull();
    expect(built.errors.saleDate).toBe("販売日は必須です");
    expect(built.errors.rows?.["MS-001"]).toBe(
      "数量は1以上の整数で入力してください / 販売金額は0以上の整数で入力してください",
    );
  });

  it("REQ-203 includes note in the UI signature so note edits create a new attempt", () => {
    const before = buildManualSaleSignature(createValues({ note: "" }));
    const after = buildManualSaleSignature(createValues({ note: "メモ変更" }));

    expect(after).not.toBe(before);
  });
});
