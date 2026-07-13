// src/features/stock-inquiry/lib/format-stock-display.test.ts
//
// REQ-301: formatStockDisplay の単位付き表示 + fallback 検証（Q-4 網羅）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6 / §58.12

import { describe, it, expect } from "vitest";
import { formatStockDisplay } from "./format-stock-display";

describe("formatStockDisplay (REQ-301 単位表示)", () => {
  it("REQ-301: pcs は「個」付き表示", () => {
    expect(formatStockDisplay(10, "pcs")).toBe("10 個");
  });

  it("REQ-301: cm は「cm」付き表示（生地）", () => {
    expect(formatStockDisplay(300, "cm")).toBe("300 cm");
  });

  it("REQ-301: 在庫 0 でも単位付きで表示する", () => {
    expect(formatStockDisplay(0, "cm")).toBe("0 cm");
  });

  it("REQ-301: 想定外の単位は fallback「—」（Q-4）", () => {
    expect(formatStockDisplay(5, "kg")).toBe("—");
    expect(formatStockDisplay(5, "")).toBe("—");
  });
});
