// src/features/stocktake/lib/stocktake-formatters.test.ts
//
// REQ-205 / UI-10-D10

import { describe, expect, it } from "vitest";

import type { StocktakeItemDetail } from "@/lib/bindings";

import {
  computeListDifference,
  formatCountedAt,
  formatListDifference,
} from "./stocktake-formatters";

function baseItem(overrides: Partial<StocktakeItemDetail> = {}): StocktakeItemDetail {
  return {
    id: 1,
    stocktake_id: 1,
    product_code: "P-001",
    name: "テスト商品",
    department_name: "テスト部門",
    system_stock: 10,
    actual_count: null,
    counted_at: null,
    current_stock: 10,
    ...overrides,
  };
}

describe("computeListDifference", () => {
  it("req205 未入力は null を返す", () => {
    expect(computeListDifference(baseItem({ actual_count: null }))).toBeNull();
  });

  it("req205 current_stock - actual_count を計算する（正=過剰）", () => {
    expect(computeListDifference(baseItem({ current_stock: 10, actual_count: 7 }))).toBe(3);
  });

  it("req205 current_stock - actual_count を計算する（負=不足）", () => {
    expect(computeListDifference(baseItem({ current_stock: 5, actual_count: 8 }))).toBe(-3);
  });

  it("req205 一致していれば 0 を返す", () => {
    expect(computeListDifference(baseItem({ current_stock: 10, actual_count: 10 }))).toBe(0);
  });
});

describe("formatListDifference", () => {
  it("req205 null は「—」を返す", () => {
    expect(formatListDifference(null)).toBe("—");
  });

  it("req205 正数には + を付ける", () => {
    expect(formatListDifference(3)).toBe("+3");
  });

  it("req205 負数はそのまま表示する", () => {
    expect(formatListDifference(-3)).toBe("-3");
  });

  it("req205 0 はそのまま表示する", () => {
    expect(formatListDifference(0)).toBe("0");
  });
});

describe("formatCountedAt", () => {
  it("req205 null は「—」を返す", () => {
    expect(formatCountedAt(null)).toBe("—");
  });

  it("req205 T区切りをスペースに変換する", () => {
    expect(formatCountedAt("2026-10-01T09:05:00")).toBe("2026-10-01 09:05:00");
  });
});
