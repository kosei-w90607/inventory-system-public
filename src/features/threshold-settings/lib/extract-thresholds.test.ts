// src/features/threshold-settings/lib/extract-thresholds.test.ts
//
// T11: extractThresholds の抽出 / 欠落 key（UI-11a-D1、69 §69.11）

import { describe, expect, it } from "vitest";

import type { AppSetting } from "@/lib/bindings";

import { extractThresholds, isReadableThresholdValue } from "./extract-thresholds";

function setting(key: string, value: string): AppSetting {
  return { key, value, updated_at: "2026-07-06T00:00:00" };
}

describe("extractThresholds (UI-11a-D1)", () => {
  it("ui11a extract-thresholds extracts only the 2 owned keys and ignores others", () => {
    const settings = [
      setting("backup_enabled", "1"),
      setting("stock_low_threshold", "3"),
      setting("backup_path", "/tmp/backups"),
      setting("stock_low_threshold_fabric", "500"),
      setting("tax_rate_standard", "10"),
    ];

    expect(extractThresholds(settings)).toEqual({
      stockLowThreshold: "3",
      stockLowThresholdFabric: "500",
    });
  });

  it("ui11a extract-thresholds returns empty string for missing keys", () => {
    const settings = [setting("backup_enabled", "1")];

    expect(extractThresholds(settings)).toEqual({
      stockLowThreshold: "",
      stockLowThresholdFabric: "",
    });
  });

  it("ui11a extract-thresholds handles empty settings list", () => {
    expect(extractThresholds([])).toEqual({
      stockLowThreshold: "",
      stockLowThresholdFabric: "",
    });
  });
});

describe("isReadableThresholdValue (§69.7 既存値が非数値)", () => {
  it("ui11a isReadableThresholdValue accepts positive integer strings", () => {
    expect(isReadableThresholdValue("3")).toBe(true);
    expect(isReadableThresholdValue("500")).toBe(true);
    expect(isReadableThresholdValue(" 12 ")).toBe(true);
  });

  it("ui11a isReadableThresholdValue rejects non-numeric or malformed values", () => {
    expect(isReadableThresholdValue("")).toBe(false);
    expect(isReadableThresholdValue("abc")).toBe(false);
    expect(isReadableThresholdValue("1.5")).toBe(false);
    expect(isReadableThresholdValue("-1")).toBe(false);
  });
});
