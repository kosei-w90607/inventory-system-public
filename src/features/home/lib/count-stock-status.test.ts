// src/features/home/lib/count-stock-status.test.ts
//
// countStockStatus 純関数の unit test。
// 設計: docs/function-design/53-ui-home.md §53.2 D-1
// Phase 1 7-7a Vitest 初期化、option A 純関数 only test の 1 file (6 ケース)

import { describe, it, expect } from "vitest";
import type { ProductWithRelations } from "@/lib/bindings";
import { countStockStatus } from "./count-stock-status";

/// 必要最小限の ProductWithRelations mock factory。
/// stock_quantity のみテストに使うため他 fields は適当に埋める。
function mockProduct(stockQuantity: number): ProductWithRelations {
  return {
    stock_quantity: stockQuantity,
  } as unknown as ProductWithRelations;
}

describe("countStockStatus", () => {
  it("returns 0/0 for empty array", () => {
    expect(countStockStatus([])).toEqual({ outOfStock: 0, lowStock: 0 });
  });

  it("counts all items with stock_quantity <= 0 as outOfStock", () => {
    const items = [mockProduct(0), mockProduct(-1), mockProduct(0)];
    expect(countStockStatus(items)).toEqual({ outOfStock: 3, lowStock: 0 });
  });

  it("counts all items with stock_quantity > 0 as lowStock", () => {
    const items = [mockProduct(1), mockProduct(10), mockProduct(100)];
    expect(countStockStatus(items)).toEqual({ outOfStock: 0, lowStock: 3 });
  });

  it("counts mixed items correctly", () => {
    const items = [mockProduct(0), mockProduct(5), mockProduct(-1), mockProduct(10)];
    expect(countStockStatus(items)).toEqual({ outOfStock: 2, lowStock: 2 });
  });

  it("treats boundary stock_quantity=0 as outOfStock", () => {
    expect(countStockStatus([mockProduct(0)])).toEqual({ outOfStock: 1, lowStock: 0 });
  });

  it("treats boundary stock_quantity=1 as lowStock", () => {
    expect(countStockStatus([mockProduct(1)])).toEqual({ outOfStock: 0, lowStock: 1 });
  });
});
