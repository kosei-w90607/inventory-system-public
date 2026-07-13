import { describe, expect, it } from "vitest";

import type { ReturnExchangeFormValues } from "../types";
import {
  buildReturnExchangeRequest,
  buildReturnExchangeSignature,
} from "./return-exchange-request";

function createValues(overrides: Partial<ReturnExchangeFormValues> = {}): ReturnExchangeFormValues {
  return {
    returnDate: "2026-06-26",
    returnType: "return",
    registerProcessed: true,
    note: "",
    rows: [
      {
        productCode: "RT-001",
        productName: "返品商品",
        departmentName: "布",
        stockUnit: "pcs",
        currentStockQuantity: 5,
        direction: "in",
        quantity: "2",
      },
    ],
    ...overrides,
  };
}

describe("return exchange request builder (UI-03 / REQ-202)", () => {
  it("REQ-202 builds the generated createReturn request shape", () => {
    const built = buildReturnExchangeRequest(createValues({ note: "レシートあり" }), "ret-key-1", {
      receiptImagePath: "images/receipts/test.jpg",
    });

    expect(built.errors).toEqual({});
    expect(built.request).toEqual({
      idempotency_key: "ret-key-1",
      return_type: "return",
      return_date: "2026-06-26",
      register_processed: true,
      receipt_image_path: "images/receipts/test.jpg",
      note: "レシートあり",
      items: [{ product_code: "RT-001", direction: "in", quantity: 2 }],
    });
  });

  it("REQ-202 blocks return with out direction before submit", () => {
    const built = buildReturnExchangeRequest(
      createValues({
        rows: [
          {
            productCode: "RT-001",
            productName: "返品商品",
            departmentName: "布",
            stockUnit: "pcs",
            currentStockQuantity: 5,
            direction: "out",
            quantity: "1",
          },
        ],
      }),
      "ret-key-1",
      { receiptImagePath: null },
    );

    expect(built.request).toBeNull();
    expect(built.errors.items).toBe("返品では渡し明細を指定できません");
  });

  it("REQ-202 blocks exchange missing either in or out rows", () => {
    const onlyIn = buildReturnExchangeRequest(
      createValues({ returnType: "exchange" }),
      "ret-key-1",
      { receiptImagePath: null },
    );
    const onlyOut = buildReturnExchangeRequest(
      createValues({
        returnType: "exchange",
        rows: [
          {
            productCode: "RT-002",
            productName: "交換商品",
            departmentName: "布",
            stockUnit: "pcs",
            currentStockQuantity: 5,
            direction: "out",
            quantity: "1",
          },
        ],
      }),
      "ret-key-2",
      { receiptImagePath: null },
    );

    expect(onlyIn.request).toBeNull();
    expect(onlyOut.request).toBeNull();
    expect(onlyIn.errors.items).toBe("交換では戻り明細と渡し明細がそれぞれ必要です");
    expect(onlyOut.errors.items).toBe("交換では戻り明細と渡し明細がそれぞれ必要です");
  });

  it("REQ-202 includes note and image path in the UI signature", () => {
    const before = buildReturnExchangeSignature(createValues({ note: "" }), null);
    const afterNote = buildReturnExchangeSignature(createValues({ note: "変更" }), null);
    const afterImage = buildReturnExchangeSignature(
      createValues({ note: "" }),
      "images/receipts/test.jpg",
    );

    expect(afterNote).not.toBe(before);
    expect(afterImage).not.toBe(before);
  });
});
