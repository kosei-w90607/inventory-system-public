// src/features/monthly-sales/lib/compute-period-label.test.ts

import { describe, it, expect } from "vitest";
import { computePeriodLabel } from "./compute-period-label";

describe("computePeriodLabel", () => {
  it("returns 31 days for January", () => {
    expect(computePeriodLabel("2026-01")).toBe("2026/01/01-01/31");
  });

  it("returns 29 days for February in leap year (2024)", () => {
    expect(computePeriodLabel("2024-02")).toBe("2024/02/01-02/29");
  });

  it("returns 28 days for February in non-leap year (2025)", () => {
    expect(computePeriodLabel("2025-02")).toBe("2025/02/01-02/28");
  });

  it("returns 31 days for December", () => {
    expect(computePeriodLabel("2026-12")).toBe("2026/12/01-12/31");
  });

  it('returns "—" for invalid month number 13', () => {
    expect(computePeriodLabel("2026-13")).toBe("—");
  });

  it('returns "—" for invalid month number 00', () => {
    expect(computePeriodLabel("2026-00")).toBe("—");
  });

  it("returns 29 days for February in year 2000 (divisible by 400, leap)", () => {
    expect(computePeriodLabel("2000-02")).toBe("2000/02/01-02/29");
  });

  it("returns 28 days for February in year 2100 (divisible by 100 not 400, non-leap)", () => {
    expect(computePeriodLabel("2100-02")).toBe("2100/02/01-02/28");
  });
});
