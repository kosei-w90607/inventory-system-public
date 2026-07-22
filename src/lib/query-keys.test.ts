import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

function expectPrefix(root: readonly unknown[], child: readonly unknown[]): void {
  expect(child.slice(0, root.length)).toEqual(root);
}

describe("queryKeys UI-06c / UI-01b / UI-09a D-052-S2 prefix contract", () => {
  it("keeps stockMovements product/list keys under root", () => {
    expectPrefix(queryKeys.stockMovements.root(), queryKeys.stockMovements.product("P-001"));
    expectPrefix(
      queryKeys.stockMovements.root(),
      queryKeys.stockMovements.list("P-001", { page: 1 }),
    );
  });

  it("keeps productForm product/suppliers keys under root", () => {
    expectPrefix(queryKeys.productForm.root(), queryKeys.productForm.product("P-001"));
    expectPrefix(queryKeys.productForm.root(), queryKeys.productForm.suppliers());
  });

  it("keeps dailySales detail keys under root", () => {
    expectPrefix(queryKeys.dailySalesRoot(), queryKeys.dailySales("2026-07-23"));
  });
});
