import { describe, expect, it } from "vitest";

import { buildReceivingRequest, buildReceivingSignature } from "./receiving-request";
import type { ReceivingFormValues } from "../types";

function makeValues(overrides: Partial<ReceivingFormValues> = {}): ReceivingFormValues {
  return {
    supplierId: null,
    receivingDate: "2026-06-25",
    note: "",
    rows: [
      {
        productCode: "P-001",
        productName: "はさみ",
        stockUnit: "pcs",
        quantity: "2",
        costPrice: "120",
      },
    ],
    ...overrides,
  };
}

describe("receiving-request (UI-02-D7/D8 / REQ-201)", () => {
  it("builds a create request with nullable supplier and note", () => {
    const result = buildReceivingRequest(makeValues(), "key-1");

    expect(result.errors).toEqual({});
    expect(result.request).toEqual({
      idempotency_key: "key-1",
      supplier_id: null,
      receiving_date: "2026-06-25",
      note: null,
      items: [{ product_code: "P-001", quantity: 2, cost_price: 120 }],
    });
  });

  it("blocks blank date, empty rows, decimal quantity, and negative cost before command", () => {
    const result = buildReceivingRequest(
      makeValues({
        receivingDate: "",
        rows: [
          {
            productCode: "P-001",
            productName: "はさみ",
            stockUnit: "pcs",
            quantity: "1.5",
            costPrice: "-1",
          },
        ],
      }),
      "key-1",
    );

    expect(result.request).toBeNull();
    expect(result.errors.receivingDate).toBe("入庫日は必須です");
    expect(result.errors.rows?.["P-001"]).toContain("数量は1以上の整数");
    expect(result.errors.rows?.["P-001"]).toContain("原価は0以上の整数");

    const empty = buildReceivingRequest(makeValues({ rows: [] }), "key-1");
    expect(empty.request).toBeNull();
    expect(empty.errors.items).toBe("明細が1件以上必要です");
  });

  it("keeps the same signature for same-content retry and changes it after edit", () => {
    const values = makeValues();
    const sameContent = makeValues();
    const edited = makeValues({ note: "納品書あり" });

    expect(buildReceivingSignature(values)).toBe(buildReceivingSignature(sameContent));
    expect(buildReceivingSignature(values)).not.toBe(buildReceivingSignature(edited));
  });
});
