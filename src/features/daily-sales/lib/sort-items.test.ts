// src/features/daily-sales/lib/sort-items.test.ts
//
// sortDailyItems 純関数の unit test (7 ケース、5 列対応 + null 末尾)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.9

import { describe, it, expect } from "vitest";
import { sortDailyItems } from "./sort-items";
import { makeMockItem } from "./test-fixtures";

describe("sortDailyItems", () => {
  it("returns empty array for empty input", () => {
    expect(sortDailyItems([], "product_code", "asc")).toEqual([]);
  });

  it("returns identity-like copy when sortBy is null", () => {
    const items = [makeMockItem({ product_code: "C" }), makeMockItem({ product_code: "A" })];
    expect(sortDailyItems(items, null, "asc")).toEqual(items);
  });

  it("sorts by product_code ascending", () => {
    const items = [
      makeMockItem({ product_code: "C" }),
      makeMockItem({ product_code: "A" }),
      makeMockItem({ product_code: "B" }),
    ];
    expect(sortDailyItems(items, "product_code", "asc").map((i) => i.product_code)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("sorts by quantity descending", () => {
    const items = [
      makeMockItem({ quantity: 1 }),
      makeMockItem({ quantity: 10 }),
      makeMockItem({ quantity: 5 }),
    ];
    expect(sortDailyItems(items, "quantity", "desc").map((i) => i.quantity)).toEqual([10, 5, 1]);
  });

  it("sorts by unit_price (derived) ascending with null at end", () => {
    const items = [
      makeMockItem({ product_code: "A", amount: 1000, quantity: 1 }), // unit_price 1000
      makeMockItem({ product_code: "B", amount: 500, quantity: 0 }), // unit_price null
      makeMockItem({ product_code: "C", amount: 2000, quantity: 4 }), // unit_price 500
    ];
    expect(sortDailyItems(items, "unit_price", "asc").map((i) => i.product_code)).toEqual([
      "C",
      "A",
      "B",
    ]);
  });

  it("sorts by unit_price descending with null still at end (user Option 1.5)", () => {
    const items = [
      makeMockItem({ product_code: "A", amount: 1000, quantity: 1 }), // 1000
      makeMockItem({ product_code: "B", amount: 500, quantity: 0 }), // null
      makeMockItem({ product_code: "C", amount: 2000, quantity: 4 }), // 500
    ];
    expect(sortDailyItems(items, "unit_price", "desc").map((i) => i.product_code)).toEqual([
      "A",
      "C",
      "B",
    ]);
  });

  it("preserves input order for tie-breaking (stable sort)", () => {
    const items = [
      makeMockItem({ product_code: "A", amount: 100 }),
      makeMockItem({ product_code: "B", amount: 100 }),
      makeMockItem({ product_code: "C", amount: 100 }),
    ];
    expect(sortDailyItems(items, "amount", "asc").map((i) => i.product_code)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });
});
