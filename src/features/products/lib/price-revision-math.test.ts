import { describe, expect, it } from "vitest";

import { deriveProposedCost, formatMarkupRate, isRevisedToday } from "./price-revision-math";

describe("price revision math UI-14 / REQ-105", () => {
  it("deriveProposedCost は整数除算で切り捨てる", () => {
    expect(deriveProposedCost(1200, 700, 1000)).toBe(840);
    expect(deriveProposedCost(1250, 333, 1000)).toBe(416);
    expect(deriveProposedCost(999, 700, 1000)).toBe(699);
    expect(deriveProposedCost(1001, 999, 1000)).toBe(999);
  });

  it("deriveProposedCost は現売価 0 で現原価を返す", () => {
    expect(deriveProposedCost(1200, 700, 0)).toBe(700);
  });

  it("deriveProposedCost は 10^7 直下の値でも exact に計算する", () => {
    expect(deriveProposedCost(9_999_999, 9_999_999, 1)).toBe(99_999_980_000_001);
  });

  it("formatMarkupRate は小数 1 桁に四捨五入する", () => {
    expect(formatMarkupRate(700, 1000)).toBe("70.0");
    expect(formatMarkupRate(333, 1000)).toBe("33.3");
    expect(formatMarkupRate(1, 16)).toBe("6.3");
    expect(formatMarkupRate(2, 3)).toBe("66.7");
    expect(formatMarkupRate(23, 80)).toBe("28.8");
  });

  it("formatMarkupRate は現売価 0 で — を返す", () => {
    expect(formatMarkupRate(700, 0)).toBe("—");
  });

  it("isRevisedToday は changed_at の日付部分と today の一致で判定する", () => {
    expect(isRevisedToday("2026-08-23T09:15:00", "2026-08-23")).toBe(true);
    expect(isRevisedToday("2026-08-22T23:59:59", "2026-08-23")).toBe(false);
    expect(isRevisedToday(undefined, "2026-08-23")).toBe(false);
  });
});
