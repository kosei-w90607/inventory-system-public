// src/features/daily-sales/lib/filter-items.test.ts
//
// filterItemsByDepartment 純関数の unit test (4 ケース)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.9

import { describe, it, expect } from "vitest";
import { filterItemsByDepartment } from "./filter-items";
import { makeMockItem } from "./test-fixtures";

describe("filterItemsByDepartment", () => {
  it("returns identity when deptId is null (no filter)", () => {
    const items = [makeMockItem({ department_id: 1 }), makeMockItem({ department_id: 2 })];
    expect(filterItemsByDepartment(items, null)).toEqual(items);
  });

  it("returns matching items only", () => {
    const items = [
      makeMockItem({ product_code: "P1", department_id: 1 }),
      makeMockItem({ product_code: "P2", department_id: 2 }),
      makeMockItem({ product_code: "P3", department_id: 1 }),
    ];
    const filtered = filterItemsByDepartment(items, 1);
    expect(filtered.map((i) => i.product_code)).toEqual(["P1", "P3"]);
  });

  it("returns empty array when no items match", () => {
    const items = [makeMockItem({ department_id: 1 }), makeMockItem({ department_id: 2 })];
    expect(filterItemsByDepartment(items, 99)).toEqual([]);
  });

  it("returns all items when all match", () => {
    const items = [
      makeMockItem({ product_code: "P1", department_id: 5 }),
      makeMockItem({ product_code: "P2", department_id: 5 }),
    ];
    expect(filterItemsByDepartment(items, 5)).toEqual(items);
  });
});
