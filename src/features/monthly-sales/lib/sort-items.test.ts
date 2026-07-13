// src/features/monthly-sales/lib/sort-items.test.ts

import { describe, it, expect } from "vitest";
import { sortMonthlyItems } from "./sort-items";
import { makeMockProductRankingRow } from "./test-fixtures";

describe("sortMonthlyItems", () => {
  it("returns empty array for empty input", () => {
    expect(sortMonthlyItems([], "amount", "asc")).toEqual([]);
  });

  it("returns identity-like copy when sortBy is null", () => {
    const items = [
      makeMockProductRankingRow({ key: "C" }),
      makeMockProductRankingRow({ key: "A" }),
    ];
    expect(sortMonthlyItems(items, null, "asc")).toEqual(items);
  });

  it("sorts by name (label) ascending", () => {
    const items = [
      makeMockProductRankingRow({ key: "1", label: "毛糸 C" }),
      makeMockProductRankingRow({ key: "2", label: "毛糸 A" }),
      makeMockProductRankingRow({ key: "3", label: "毛糸 B" }),
    ];
    const sorted = sortMonthlyItems(items, "name", "asc");
    expect(sorted.map((r) => r.label)).toEqual(["毛糸 A", "毛糸 B", "毛糸 C"]);
  });

  it("sorts by quantity descending", () => {
    const items = [
      makeMockProductRankingRow({ key: "A", quantity: 1 }),
      makeMockProductRankingRow({ key: "B", quantity: 10 }),
      makeMockProductRankingRow({ key: "C", quantity: 5 }),
    ];
    expect(sortMonthlyItems(items, "quantity", "desc").map((r) => r.quantity)).toEqual([10, 5, 1]);
  });

  it("sorts by amount ascending", () => {
    const items = [
      makeMockProductRankingRow({ key: "A", amount: 1000 }),
      makeMockProductRankingRow({ key: "B", amount: 500 }),
      makeMockProductRankingRow({ key: "C", amount: 1500 }),
    ];
    expect(sortMonthlyItems(items, "amount", "asc").map((r) => r.amount)).toEqual([
      500, 1000, 1500,
    ]);
  });

  it("sorts by prev_month_diff with null at end (asc)", () => {
    const items = [
      makeMockProductRankingRow({ key: "A", prev_month_diff: 100 }),
      makeMockProductRankingRow({ key: "B", prev_month_diff: null }),
      makeMockProductRankingRow({ key: "C", prev_month_diff: -50 }),
    ];
    const sorted = sortMonthlyItems(items, "prev_month_diff", "asc");
    expect(sorted.map((r) => r.key)).toEqual(["C", "A", "B"]);
  });

  it("sorts by prev_month_diff descending with null still at end", () => {
    const items = [
      makeMockProductRankingRow({ key: "A", prev_month_diff: 100 }),
      makeMockProductRankingRow({ key: "B", prev_month_diff: null }),
      makeMockProductRankingRow({ key: "C", prev_month_diff: -50 }),
    ];
    const sorted = sortMonthlyItems(items, "prev_month_diff", "desc");
    expect(sorted.map((r) => r.key)).toEqual(["A", "C", "B"]);
  });

  it("preserves input order for tie-breaking (stable sort)", () => {
    const items = [
      makeMockProductRankingRow({ key: "A", amount: 100 }),
      makeMockProductRankingRow({ key: "B", amount: 100 }),
      makeMockProductRankingRow({ key: "C", amount: 100 }),
    ];
    expect(sortMonthlyItems(items, "amount", "asc").map((r) => r.key)).toEqual(["A", "B", "C"]);
  });

  it("G-3: ranking field 残存確認（sort 後も identifiable for badge）", () => {
    const items = [
      makeMockProductRankingRow({ key: "A", ranking: 1, amount: 500 }),
      makeMockProductRankingRow({ key: "B", ranking: 2, amount: 1000 }),
      makeMockProductRankingRow({ key: "C", ranking: 3, amount: 200 }),
    ];
    const sorted = sortMonthlyItems(items, "amount", "desc");
    // sort 後の順序は [B, A, C] (1000, 500, 200) だが ranking field は保持
    expect(sorted.map((r) => r.ranking)).toEqual([2, 1, 3]);
    // ranking === 1 の row は依然として識別可能
    expect(sorted.find((r) => r.ranking === 1)?.key).toBe("A");
  });
});
