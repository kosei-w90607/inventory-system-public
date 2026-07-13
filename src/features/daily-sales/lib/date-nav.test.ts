// src/features/daily-sales/lib/date-nav.test.ts
//
// addDays 純関数の unit test (6 ケース、月またぎ / 年またぎ / 閏年カバー)。
// useTodayDate / formatJpDate は DOM / Intl API 依存のため hooks/components test
// (7-7b 後続 PR) で扱う。
// 設計: docs/function-design/56-ui-daily-sales.md §56.9

import { describe, it, expect } from "vitest";
import { addDays } from "./date-nav";

describe("addDays", () => {
  it("adds 1 day within month", () => {
    expect(addDays("2026-05-17", 1)).toBe("2026-05-18");
  });

  it("subtracts 1 day within month", () => {
    expect(addDays("2026-05-17", -1)).toBe("2026-05-16");
  });

  it("handles month boundary (May 31 → June 1)", () => {
    expect(addDays("2026-05-31", 1)).toBe("2026-06-01");
  });

  it("handles year boundary (Dec 31 → Jan 1)", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles leap year Feb 28 → Feb 29 (2028 is leap)", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("handles non-leap year Feb 28 → Mar 1 (2026 not leap)", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});
