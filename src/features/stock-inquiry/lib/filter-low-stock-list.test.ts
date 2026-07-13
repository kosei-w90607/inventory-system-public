// src/features/stock-inquiry/lib/filter-low-stock-list.test.ts
//
// REQ-302: filterLowStockList の status / q / dept sub-filter 検証。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6

import { describe, it, expect } from "vitest";
import { filterLowStockList } from "./filter-low-stock-list";
import { makeMockProductWithRelations } from "./test-fixtures";

const items = [
  makeMockProductWithRelations({
    product_code: "A-001",
    name: "毛糸 赤",
    jan_code: "4900000000001",
    department_id: 1,
    stock_quantity: 0,
  }),
  makeMockProductWithRelations({
    product_code: "A-002",
    name: "毛糸 青",
    jan_code: "4900000000002",
    department_id: 1,
    stock_quantity: 2,
  }),
  makeMockProductWithRelations({
    product_code: "B-001",
    name: "布 白",
    jan_code: null,
    department_id: 2,
    stock_quantity: 0,
  }),
  makeMockProductWithRelations({
    product_code: "B-002",
    name: "布 黒",
    jan_code: "4900000000004",
    department_id: 2,
    stock_quantity: 5,
  }),
];

describe("filterLowStockList (REQ-302 sub-filter)", () => {
  it("REQ-302: status=stockout は stock<=0 のみ", () => {
    const result = filterLowStockList(items, "", null, "stockout");
    expect(result.map((p) => p.product_code)).toEqual(["A-001", "B-001"]);
  });

  it("REQ-302: status=low_stock は stock>0 のみ", () => {
    const result = filterLowStockList(items, "", null, "low_stock");
    expect(result.map((p) => p.product_code)).toEqual(["A-002", "B-002"]);
  });

  it("REQ-302: dept 絞り込み（department_id 一致）", () => {
    const result = filterLowStockList(items, "", 2, "stockout");
    expect(result.map((p) => p.product_code)).toEqual(["B-001"]);
  });

  it("REQ-302: q 部分一致（商品名）", () => {
    const result = filterLowStockList(items, "毛糸", null, "low_stock");
    expect(result.map((p) => p.product_code)).toEqual(["A-002"]);
  });

  it("REQ-302: q 部分一致（商品コード、大文字小文字非依存）", () => {
    const result = filterLowStockList(items, "b-00", null, "stockout");
    expect(result.map((p) => p.product_code)).toEqual(["B-001"]);
  });

  it("REQ-302: q 部分一致（JAN、null jan_code は除外）", () => {
    const result = filterLowStockList(items, "4900000000002", null, "low_stock");
    expect(result.map((p) => p.product_code)).toEqual(["A-002"]);
  });

  it("REQ-302: status + dept + q 複合条件", () => {
    const result = filterLowStockList(items, "毛糸", 1, "low_stock");
    expect(result.map((p) => p.product_code)).toEqual(["A-002"]);
  });

  it("REQ-302: 該当なしは空配列", () => {
    expect(filterLowStockList(items, "存在しない", null, "low_stock")).toEqual([]);
    expect(filterLowStockList([], "", null, "stockout")).toEqual([]);
  });
});
