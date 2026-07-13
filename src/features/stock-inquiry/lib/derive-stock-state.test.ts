// src/features/stock-inquiry/lib/derive-stock-state.test.ts
//
// REQ-302: deriveStockState の色分け契約 H 検証（source + stock_quantity）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.6 / §58.10

import { describe, it, expect } from "vitest";
import { deriveStockState } from "./derive-stock-state";
import { makeMockProductWithRelations } from "./test-fixtures";

describe("deriveStockState (REQ-302 色分け契約 H)", () => {
  it("REQ-302: source=search + stock>0 は ok（default 表示、色なし）", () => {
    const item = makeMockProductWithRelations({ stock_quantity: 10 });
    expect(deriveStockState(item, "search")).toBe("ok");
  });

  it("REQ-302: source=search + stock<=0 は stockout（在庫切れ赤）", () => {
    const item = makeMockProductWithRelations({ stock_quantity: 0 });
    expect(deriveStockState(item, "search")).toBe("stockout");
  });

  it("REQ-302: source=low_stock + stock>0 は low（在庫少黄）", () => {
    const item = makeMockProductWithRelations({ stock_quantity: 2 });
    expect(deriveStockState(item, "low_stock")).toBe("low");
  });

  it("REQ-302: source=low_stock + stock<=0 は stockout（在庫切れ赤）", () => {
    const item = makeMockProductWithRelations({ stock_quantity: 0 });
    expect(deriveStockState(item, "low_stock")).toBe("stockout");
  });

  it("REQ-302: 負の在庫（補正前など）は source 問わず stockout", () => {
    const item = makeMockProductWithRelations({ stock_quantity: -5 });
    expect(deriveStockState(item, "search")).toBe("stockout");
    expect(deriveStockState(item, "low_stock")).toBe("stockout");
  });

  it("REQ-302: stock_quantity=1 境界は search→ok / low_stock→low", () => {
    const item = makeMockProductWithRelations({ stock_quantity: 1 });
    expect(deriveStockState(item, "search")).toBe("ok");
    expect(deriveStockState(item, "low_stock")).toBe("low");
  });
});
