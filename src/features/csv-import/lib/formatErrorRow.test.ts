// src/features/csv-import/lib/formatErrorRow.test.ts
//
// formatErrorRow 純関数の unit test。
// 設計: docs/function-design/55-ui-csv-import.md §55.5
// Phase 1 7-7a Vitest 初期化、option A 純関数 only test の 1 file (5 ケース)

import { describe, it, expect } from "vitest";
import { formatErrorRow } from "./formatErrorRow";

describe("formatErrorRow", () => {
  it("maps unmatched_product to secondary + 未登録 JAN", () => {
    expect(formatErrorRow("unmatched_product")).toEqual({
      variant: "secondary",
      label: "未登録 JAN",
    });
  });

  it("maps invalid_format to destructive + フォーマット異常", () => {
    expect(formatErrorRow("invalid_format")).toEqual({
      variant: "destructive",
      label: "フォーマット異常",
    });
  });

  it("maps invalid_jan to outline + JAN 不正", () => {
    expect(formatErrorRow("invalid_jan")).toEqual({
      variant: "outline",
      label: "JAN 不正",
    });
  });

  it("maps invalid_number to outline + 数値不正", () => {
    expect(formatErrorRow("invalid_number")).toEqual({
      variant: "outline",
      label: "数値不正",
    });
  });

  it("falls back to outline + その他 for unknown error_type (defense for BIZ-03 future additions)", () => {
    expect(formatErrorRow("some_new_error_type")).toEqual({
      variant: "outline",
      label: "その他",
    });
  });
});
