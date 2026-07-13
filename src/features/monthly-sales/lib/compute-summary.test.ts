// src/features/monthly-sales/lib/compute-summary.test.ts

import { describe, it, expect } from "vitest";
import { computeMonthlySummary } from "./compute-summary";
import { makeMockMonthlyItem } from "./test-fixtures";

describe("computeMonthlySummary", () => {
  it("returns zeros for empty input", () => {
    expect(computeMonthlySummary([])).toEqual({ totalAmount: 0, totalQuantity: 0 });
  });

  it("sums a single item", () => {
    const items = [makeMockMonthlyItem({ amount: 1234, quantity: 5 })];
    expect(computeMonthlySummary(items)).toEqual({ totalAmount: 1234, totalQuantity: 5 });
  });

  it("sums multiple items", () => {
    const items = [
      makeMockMonthlyItem({ key: "A", amount: 1000, quantity: 2 }),
      makeMockMonthlyItem({ key: "B", amount: 2500, quantity: 5 }),
      makeMockMonthlyItem({ key: "C", amount: 500, quantity: 1 }),
    ];
    expect(computeMonthlySummary(items)).toEqual({ totalAmount: 4000, totalQuantity: 8 });
  });

  it("accepts negative amount (返品超過月)", () => {
    const items = [
      makeMockMonthlyItem({ key: "A", amount: 1000, quantity: 2 }),
      makeMockMonthlyItem({ key: "B", amount: -500, quantity: -1 }),
    ];
    expect(computeMonthlySummary(items)).toEqual({ totalAmount: 500, totalQuantity: 1 });
  });

  it("handles large item count", () => {
    const items = Array.from({ length: 500 }, (_, i) =>
      makeMockMonthlyItem({ key: `K${String(i)}`, amount: 10, quantity: 1 }),
    );
    expect(computeMonthlySummary(items)).toEqual({ totalAmount: 5000, totalQuantity: 500 });
  });
});
