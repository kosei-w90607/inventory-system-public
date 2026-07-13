// src/features/monthly-sales/lib/format-month-label.test.ts

import { describe, it, expect } from "vitest";
import { formatMonthLabel, formatYearMonth, nextMonth, prevMonth } from "./format-month-label";

describe("formatMonthLabel (H-3: UI 表示 zero-pad なし)", () => {
  it('returns "2026年1月" without zero-pad', () => {
    expect(formatMonthLabel("2026-01")).toBe("2026年1月");
  });

  it('returns "2026年12月" for December', () => {
    expect(formatMonthLabel("2026-12")).toBe("2026年12月");
  });

  it('returns "2024年2月" for leap year', () => {
    expect(formatMonthLabel("2024-02")).toBe("2024年2月");
  });

  it('returns "—" for invalid month 13', () => {
    expect(formatMonthLabel("2026-13")).toBe("—");
  });

  it('returns "—" for invalid month 00', () => {
    expect(formatMonthLabel("2026-00")).toBe("—");
  });

  it('returns "—" for missing dash', () => {
    expect(formatMonthLabel("202601")).toBe("—");
  });
});

describe("prevMonth", () => {
  it('returns "2025-12" for January (year boundary)', () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });

  it('returns "2026-01" for February', () => {
    expect(prevMonth("2026-02")).toBe("2026-01");
  });

  it("pads single-digit month with zero", () => {
    expect(prevMonth("2026-10")).toBe("2026-09");
  });

  it('returns "" for invalid input', () => {
    expect(prevMonth("invalid")).toBe("");
  });
});

describe("nextMonth", () => {
  it('returns "2026-01" for December (year boundary)', () => {
    expect(nextMonth("2025-12")).toBe("2026-01");
  });

  it('returns "2026-02" for January', () => {
    expect(nextMonth("2026-01")).toBe("2026-02");
  });

  it('returns "" for invalid input', () => {
    expect(nextMonth("invalid")).toBe("");
  });
});

describe("formatYearMonth", () => {
  it("formats current date with zero-pad ISO", () => {
    const date = new Date(2026, 0, 15); // 2026-01-15 (month is 0-based)
    expect(formatYearMonth(date)).toBe("2026-01");
  });

  it("formats December correctly", () => {
    const date = new Date(2026, 11, 31);
    expect(formatYearMonth(date)).toBe("2026-12");
  });
});
