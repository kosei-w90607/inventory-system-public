import { describe, expect, it } from "vitest";

import { invalidationContract } from "./invalidation-contract";

describe("UI-07 D-052 invalidation SSOT shape", () => {
  it("defines all 16 non-empty mutation entries", () => {
    expect(Object.keys(invalidationContract).sort()).toEqual(
      [
        "productCreate",
        "productUpdate",
        "productImport",
        "receiving",
        "returnExchange",
        "manualSale",
        "disposal",
        "csvImportCommit",
        "csvImportRollback",
        "dailyReportImport",
        "stocktakeStart",
        "stocktakeCountUpdate",
        "stocktakeComplete",
        "integrityFix",
        "thresholdSave",
        "pluExportConfirm",
      ].sort(),
    );
    const entries = [
      invalidationContract.productCreate(),
      invalidationContract.productUpdate("P-001"),
      invalidationContract.productImport(),
      invalidationContract.receiving(),
      invalidationContract.returnExchange(false),
      invalidationContract.manualSale("2026-07-23"),
      invalidationContract.disposal(),
      invalidationContract.csvImportCommit(),
      invalidationContract.csvImportRollback(),
      invalidationContract.dailyReportImport(),
      invalidationContract.stocktakeStart(),
      invalidationContract.stocktakeCountUpdate(),
      invalidationContract.stocktakeComplete(),
      invalidationContract.integrityFix(),
      invalidationContract.thresholdSave(),
      invalidationContract.pluExportConfirm(),
    ];

    expect(entries).toHaveLength(16);
    for (const entry of entries) expect(entry.length).toBeGreaterThan(0);
  });
});
