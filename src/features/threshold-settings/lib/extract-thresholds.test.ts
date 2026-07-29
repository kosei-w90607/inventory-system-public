// src/features/threshold-settings/lib/extract-thresholds.test.ts
//
// T11: extractThresholds の抽出 / 欠落 key（UI-11a-D1、69 §69.11）

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { AppSetting } from "@/lib/bindings";

import {
  THRESHOLD_FIELD_DESCRIPTORS,
  extractThresholds,
  isReadableThresholdValue,
} from "./extract-thresholds";

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

  it("extracts every descriptor key into its field in save order", () => {
    const settings = [
      setting("stock_low_threshold", "10"),
      setting("stock_low_threshold_fabric", "11"),
    ];

    expect(Object.entries(extractThresholds(settings))).toEqual([
      ["stockLowThreshold", "10"],
      ["stockLowThresholdFabric", "11"],
    ]);
  });

  it("UI-11a-D8: descriptor metadata matches the independently transcribed contract", () => {
    expect(
      THRESHOLD_FIELD_DESCRIPTORS.map((descriptor) => ({
        field: descriptor.field,
        settingKey: descriptor.settingKey,
        label: descriptor.label,
        requiredLabel: descriptor.requiredLabel,
        inputId: descriptor.inputId,
        unit: descriptor.unit,
        description: descriptor.description,
      })),
    ).toEqual([
      {
        field: "stockLowThreshold",
        settingKey: "stock_low_threshold",
        label: "一般商品の基準",
        requiredLabel: "一般商品の基準（必須）",
        inputId: "stock-low-threshold",
        unit: "個",
        description: "在庫がこの個数以下になったら在庫少（初期値: 3個）",
      },
      {
        field: "stockLowThresholdFabric",
        settingKey: "stock_low_threshold_fabric",
        label: "生地の基準",
        requiredLabel: "生地の基準（必須）",
        inputId: "stock-low-threshold-fabric",
        unit: "cm",
        description: "在庫がこの長さ以下になったら在庫少（初期値: 500cm = 5m）",
      },
    ]);
  });

  it("schema, extraction, save hook, and page consume the descriptor owner", () => {
    const repoRoot = process.cwd();
    const descriptorSource = readFileSync(
      join(repoRoot, "src/features/threshold-settings/lib/extract-thresholds.ts"),
      "utf8",
    );
    const schemaSource = readFileSync(
      join(repoRoot, "src/features/threshold-settings/lib/threshold-form-schema.ts"),
      "utf8",
    );
    const saveSource = readFileSync(
      join(repoRoot, "src/features/threshold-settings/hooks/useSaveThresholds.ts"),
      "utf8",
    );
    const pageSource = readFileSync(
      join(repoRoot, "src/features/threshold-settings/ThresholdSettingsPage.tsx"),
      "utf8",
    );

    for (const downstreamSource of [schemaSource, saveSource, pageSource]) {
      expect(downstreamSource).toContain("THRESHOLD_FIELD_DESCRIPTORS");
    }
    expect(schemaSource).not.toContain("stockLowThreshold:");
    expect(saveSource).not.toContain("THRESHOLD_SETTING_KEY_BY_FIELD");
    expect(pageSource).not.toContain("THRESHOLD_FIELD_ORDER");
    for (const retiredExport of [
      "STOCK_LOW_THRESHOLD_KEY",
      "STOCK_LOW_THRESHOLD_FABRIC_KEY",
      "THRESHOLD_FIELD_ORDER",
      "THRESHOLD_SETTING_KEY_BY_FIELD",
    ]) {
      expect(descriptorSource).not.toContain(`export const ${retiredExport}`);
    }
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
