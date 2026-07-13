// src/features/daily-sales/lib/calculate-unit-price.test.ts
//
// calculateEffectiveUnitPrice 純関数の unit test (5 ケース、user Option 1.5)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.9 + §56.10 単価派生

import { describe, it, expect } from "vitest";
import { calculateEffectiveUnitPrice } from "./calculate-unit-price";
import { makeMockItem } from "./test-fixtures";

describe("calculateEffectiveUnitPrice", () => {
  it("returns 594 for amount=2376, quantity=4", () => {
    expect(calculateEffectiveUnitPrice(makeMockItem({ amount: 2376, quantity: 4 }))).toBe(594);
  });

  it("returns 594 for return row (amount=-594, quantity=-1, abs values)", () => {
    expect(calculateEffectiveUnitPrice(makeMockItem({ amount: -594, quantity: -1 }))).toBe(594);
  });

  it("returns 1001 for amount=2002, quantity=2", () => {
    expect(calculateEffectiveUnitPrice(makeMockItem({ amount: 2002, quantity: 2 }))).toBe(1001);
  });

  it("rounds 1000/3 to 333 (Math.round, 0.333... → 333)", () => {
    expect(calculateEffectiveUnitPrice(makeMockItem({ amount: 1000, quantity: 3 }))).toBe(333);
  });

  it("returns null when quantity is 0 (displays as «—» placeholder)", () => {
    expect(calculateEffectiveUnitPrice(makeMockItem({ quantity: 0 }))).toBeNull();
  });
});
