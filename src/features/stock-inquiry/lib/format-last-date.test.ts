// src/features/stock-inquiry/lib/format-last-date.test.ts
//
// REQ-301: formatLastDate の None → 「—」変換検証（Q-2）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6 / §58.12

import { describe, it, expect } from "vitest";
import { formatLastDate } from "./format-last-date";

describe("formatLastDate (REQ-301 None 表示)", () => {
  it("REQ-301: null は「—」（Q-2）", () => {
    expect(formatLastDate(null)).toBe("—");
  });

  it("REQ-301: 空文字も「—」", () => {
    expect(formatLastDate("")).toBe("—");
  });

  it("REQ-301: 日付文字列はそのまま返す", () => {
    expect(formatLastDate("2026-03-20")).toBe("2026-03-20");
  });
});
