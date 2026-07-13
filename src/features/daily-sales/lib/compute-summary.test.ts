// src/features/daily-sales/lib/compute-summary.test.ts
//
// computeSalesLineSummary 純関数の unit test (5 ケース)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.9

import { describe, it, expect } from "vitest";
import { computeSalesLineSummary } from "./compute-summary";
import { makeMockItem } from "./test-fixtures";

describe("computeSalesLineSummary", () => {
  it("returns all zeros for empty input", () => {
    expect(computeSalesLineSummary([])).toEqual({ total: 0, autoCount: 0, manualCount: 0 });
  });

  it("counts all auto source", () => {
    const items = [
      makeMockItem({ source: "auto" }),
      makeMockItem({ source: "auto" }),
      makeMockItem({ source: "auto" }),
    ];
    expect(computeSalesLineSummary(items)).toEqual({ total: 3, autoCount: 3, manualCount: 0 });
  });

  it("counts all manual source", () => {
    const items = [makeMockItem({ source: "manual" }), makeMockItem({ source: "manual" })];
    expect(computeSalesLineSummary(items)).toEqual({ total: 2, autoCount: 0, manualCount: 2 });
  });

  it("counts mixed sources correctly", () => {
    const items = [
      makeMockItem({ source: "auto" }),
      makeMockItem({ source: "manual" }),
      makeMockItem({ source: "auto" }),
    ];
    expect(computeSalesLineSummary(items)).toEqual({ total: 3, autoCount: 2, manualCount: 1 });
  });

  it("counts unknown source in total but not in auto/manual breakdown (defensive)", () => {
    const items = [
      makeMockItem({ source: "auto" }),
      makeMockItem({ source: "future_value" }),
      makeMockItem({ source: "manual" }),
    ];
    expect(computeSalesLineSummary(items)).toEqual({ total: 3, autoCount: 1, manualCount: 1 });
  });
});
