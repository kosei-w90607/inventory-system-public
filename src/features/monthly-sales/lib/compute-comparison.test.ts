// src/features/monthly-sales/lib/compute-comparison.test.ts

import { describe, it, expect } from "vitest";
import { computeMonthlyComparison } from "./compute-comparison";
import { makeMockMonthlyItem } from "./test-fixtures";

describe("computeMonthlyComparison", () => {
  it("returns isComparable=false for all when prev is null (failure state #3)", () => {
    const current = [
      makeMockMonthlyItem({ key: "A", amount: 1000 }),
      makeMockMonthlyItem({ key: "B", amount: 500 }),
    ];
    const map = computeMonthlyComparison(current, null);
    expect(map.size).toBe(2);
    expect(map.get("A")?.isComparable).toBe(false);
    expect(map.get("B")?.isComparable).toBe(false);
  });

  it("computes positive diff when current > prev", () => {
    const current = [makeMockMonthlyItem({ key: "A", amount: 1200 })];
    const prev = [makeMockMonthlyItem({ key: "A", amount: 1000 })];
    const info = computeMonthlyComparison(current, prev).get("A");
    expect(info).toBeDefined();
    expect(info?.isComparable).toBe(true);
    expect(info?.diff).toBe(200);
    expect(info?.ratio).toBeCloseTo(0.2);
  });

  it("computes negative diff when current < prev", () => {
    const current = [makeMockMonthlyItem({ key: "A", amount: 800 })];
    const prev = [makeMockMonthlyItem({ key: "A", amount: 1000 })];
    const info = computeMonthlyComparison(current, prev).get("A");
    expect(info?.diff).toBe(-200);
    expect(info?.ratio).toBeCloseTo(-0.2);
  });

  it("returns diff=0 when current === prev", () => {
    const current = [makeMockMonthlyItem({ key: "A", amount: 1000 })];
    const prev = [makeMockMonthlyItem({ key: "A", amount: 1000 })];
    const info = computeMonthlyComparison(current, prev).get("A");
    expect(info?.diff).toBe(0);
    expect(info?.ratio).toBe(0);
    expect(info?.isComparable).toBe(true);
  });

  it("Q-7: prev_amount === 0 → isComparable false (除算ガード)", () => {
    const current = [makeMockMonthlyItem({ key: "A", amount: 500 })];
    const prev = [makeMockMonthlyItem({ key: "A", amount: 0 })];
    const info = computeMonthlyComparison(current, prev).get("A");
    expect(info?.isComparable).toBe(false);
    expect(info?.prevAmount).toBe(0);
    expect(info?.ratio).toBe(null);
  });

  it("Q-7: prev_amount < 0 (Z004 返品超過月、例 prev=-500) → isComparable false (色分け逆転回避)", () => {
    const current = [makeMockMonthlyItem({ key: "A", amount: 1000 })];
    const prev = [makeMockMonthlyItem({ key: "A", amount: -500 })];
    const info = computeMonthlyComparison(current, prev).get("A");
    expect(info?.isComparable).toBe(false);
    expect(info?.prevAmount).toBe(-500);
  });

  it("Q-7: prev_amount < 0 + current_amount < 0 → isComparable false", () => {
    const current = [makeMockMonthlyItem({ key: "A", amount: -300 })];
    const prev = [makeMockMonthlyItem({ key: "A", amount: -500 })];
    const info = computeMonthlyComparison(current, prev).get("A");
    expect(info?.isComparable).toBe(false);
  });

  it("returns isComparable=false when prev does not contain the key (new key in current)", () => {
    const current = [makeMockMonthlyItem({ key: "NEW", amount: 1000 })];
    const prev = [makeMockMonthlyItem({ key: "OLD", amount: 500 })];
    const info = computeMonthlyComparison(current, prev).get("NEW");
    expect(info?.isComparable).toBe(false);
    expect(info?.prevAmount).toBe(null);
  });

  it("computes +1000% (10x) ratio correctly", () => {
    const current = [makeMockMonthlyItem({ key: "A", amount: 11000 })];
    const prev = [makeMockMonthlyItem({ key: "A", amount: 1000 })];
    const info = computeMonthlyComparison(current, prev).get("A");
    expect(info?.ratio).toBeCloseTo(10);
  });

  it("handles multiple keys with mixed comparability", () => {
    const current = [
      makeMockMonthlyItem({ key: "A", amount: 1500 }),
      makeMockMonthlyItem({ key: "B", amount: 500 }),
      makeMockMonthlyItem({ key: "C", amount: 100 }),
    ];
    const prev = [
      makeMockMonthlyItem({ key: "A", amount: 1000 }),
      makeMockMonthlyItem({ key: "B", amount: 0 }),
    ];
    const map = computeMonthlyComparison(current, prev);
    expect(map.get("A")?.isComparable).toBe(true);
    expect(map.get("B")?.isComparable).toBe(false);
    expect(map.get("C")?.isComparable).toBe(false);
  });
});
