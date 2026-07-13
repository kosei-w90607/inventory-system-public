// src/features/monthly-sales/lib/pick-top-ranking.test.ts

import { describe, it, expect } from "vitest";
import { pickTopRanking } from "./pick-top-ranking";
import { makeMockMonthlyItem } from "./test-fixtures";

describe("pickTopRanking", () => {
  it("returns empty for empty input", () => {
    expect(pickTopRanking([])).toEqual([]);
  });

  it("returns all 5 items when input has 5 items (all within top 10)", () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      makeMockMonthlyItem({ key: `K${String(i + 1)}`, ranking: i + 1, amount: 100 - i }),
    );
    const result = pickTopRanking(items);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.ranking)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns all 10 items when input has exactly 10", () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeMockMonthlyItem({ key: `K${String(i + 1)}`, ranking: i + 1 }),
    );
    expect(pickTopRanking(items)).toHaveLength(10);
  });

  it("excludes items with ranking > 10 (input has 15 items)", () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeMockMonthlyItem({ key: `K${String(i + 1)}`, ranking: i + 1 }),
    );
    const result = pickTopRanking(items);
    expect(result).toHaveLength(10);
    expect(result.every((r) => r.ranking <= 10)).toBe(true);
  });

  it("sorts by ranking ascending even if input is shuffled", () => {
    const items = [
      makeMockMonthlyItem({ key: "C", ranking: 3 }),
      makeMockMonthlyItem({ key: "A", ranking: 1 }),
      makeMockMonthlyItem({ key: "B", ranking: 2 }),
    ];
    const result = pickTopRanking(items);
    expect(result.map((r) => r.key)).toEqual(["A", "B", "C"]);
  });

  it("ignores ranking=11 row (above top 10)", () => {
    const items = [
      makeMockMonthlyItem({ key: "A", ranking: 1 }),
      makeMockMonthlyItem({ key: "B", ranking: 11 }),
    ];
    const result = pickTopRanking(items);
    expect(result.map((r) => r.key)).toEqual(["A"]);
  });

  it("ignores ranking=0 (invalid, below 1-based assumption)", () => {
    const items = [
      makeMockMonthlyItem({ key: "A", ranking: 0 }),
      makeMockMonthlyItem({ key: "B", ranking: 1 }),
    ];
    const result = pickTopRanking(items);
    expect(result.map((r) => r.key)).toEqual(["B"]);
  });

  it("attaches prev_month_diff from comparisonMap when isComparable", () => {
    const items = [makeMockMonthlyItem({ key: "A", ranking: 1, amount: 1000 })];
    const map = new Map([["A", { prevAmount: 800, diff: 200, ratio: 0.25, isComparable: true }]]);
    const result = pickTopRanking(items, map);
    expect(result[0]?.prev_month_diff).toBe(200);
  });
});
