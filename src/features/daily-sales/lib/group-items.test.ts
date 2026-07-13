// src/features/daily-sales/lib/group-items.test.ts
//
// groupItemsByDepartment 純関数の unit test (5 ケース)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.9

import { describe, it, expect } from "vitest";
import { groupItemsByDepartment } from "./group-items";
import { makeMockItem } from "./test-fixtures";

describe("groupItemsByDepartment", () => {
  it("returns empty array for empty input", () => {
    expect(groupItemsByDepartment([])).toEqual([]);
  });

  it("groups single department correctly with subtotal", () => {
    const items = [
      makeMockItem({ department_id: 1, department_name: "毛糸", quantity: 2, amount: 200 }),
      makeMockItem({ department_id: 1, department_name: "毛糸", quantity: 3, amount: 300 }),
    ];
    const groups = groupItemsByDepartment(items);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.departmentId).toBe(1);
    expect(groups[0]?.subtotal.quantity).toBe(5);
    expect(groups[0]?.subtotal.amount).toBe(500);
  });

  it("groups multiple departments with separate subtotals", () => {
    const items = [
      makeMockItem({ department_id: 1, department_name: "毛糸", quantity: 1, amount: 100 }),
      makeMockItem({ department_id: 2, department_name: "ボタン", quantity: 5, amount: 500 }),
    ];
    const groups = groupItemsByDepartment(items);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.subtotal.amount).toBe(100);
    expect(groups[1]?.subtotal.amount).toBe(500);
  });

  it("sorts groups by department_id ascending (BIZ-05 order)", () => {
    const items = [
      makeMockItem({ department_id: 3, department_name: "C" }),
      makeMockItem({ department_id: 1, department_name: "A" }),
      makeMockItem({ department_id: 2, department_name: "B" }),
    ];
    const groups = groupItemsByDepartment(items);
    expect(groups.map((g) => g.departmentId)).toEqual([1, 2, 3]);
  });

  it("preserves item order within a section (no reordering)", () => {
    const items = [
      makeMockItem({ product_code: "P1", department_id: 1 }),
      makeMockItem({ product_code: "P2", department_id: 1 }),
      makeMockItem({ product_code: "P3", department_id: 1 }),
    ];
    const groups = groupItemsByDepartment(items);
    expect(groups[0]?.items.map((i) => i.product_code)).toEqual(["P1", "P2", "P3"]);
  });
});
