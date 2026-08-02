import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("REQ-206: keeps csvImportDetail under the inventoryRecords root", () => {
    expectPrefix(queryKeys.inventoryRecords.root(), queryKeys.inventoryRecords.csvImportDetail(41));
    expect(queryKeys.inventoryRecords.csvImportDetail(41)).toEqual([
      "inventory-records",
      "csv-import-detail",
      { importId: 41 },
    ]);
  });

  it("REQ-206: CSV detail page does not reintroduce a literal query key", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/features/inventory-records/CsvImportRecordDetailPage.tsx"),
      "utf8",
    );
    expect(pageSource).not.toContain('["inventory-records"');
    expect(pageSource).toContain("queryKeys.inventoryRecords.csvImportDetail(importId)");
  });
});
