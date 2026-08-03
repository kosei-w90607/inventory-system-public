// src/features/stock-inquiry/types.test.ts
//
// SPEC-UIBB-3: 在庫照会 `page` search param の検証契約（>=1、invalid catch → 1）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.4

import { describe, expect, it } from "vitest";
import { stockInquirySearchSchema } from "./types";

describe("stockInquirySearchSchema (REQ-301 / SPEC-UIBB-3)", () => {
  it.each([
    ["0", { page: 0 }],
    ["負数", { page: -1 }],
    ["小数", { page: 1.5 }],
    ["非数値文字列", { page: "abc" }],
    ["欠落", {}],
  ])("SPEC-UIBB-3 pageの不正値は既定1に落ちる（%s）", (_label, input) => {
    const result = stockInquirySearchSchema.parse(input);
    // schema は catch(undefined) で吸収する。呼び出し側（StockInquiryPage）は
    // `page ?? 1` で既定 1 に落とす（58 §58.4 / 50 §50.4 と同型）。
    expect(result.page).toBeUndefined();
    expect(result.page ?? 1).toBe(1);
  });

  it("SPEC-UIBB-3 正の整数はそのまま通す", () => {
    expect(stockInquirySearchSchema.parse({ page: 3 }).page).toBe(3);
  });
});
