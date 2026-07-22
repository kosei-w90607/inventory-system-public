import { expect } from "vitest";

import { queryKeys } from "@/lib/query-keys";

export type InvalidationKey = readonly unknown[];

/**
 * D-052-C1〜C16 を test 側へ独立転記した oracle。
 * production の invalidation-contract.ts を参照してはならない。
 */
export const d052InvalidationOracle = {
  productCreate: () => [
    queryKeys.productList.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.pluDirty(),
    queryKeys.stockMovements.root(),
    queryKeys.stocktake.itemsRoot(),
  ],
  productUpdate: (productCode: string) => [
    queryKeys.productList.root(),
    queryKeys.productForm.product(productCode),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.pluDirty(),
    queryKeys.stockMovements.root(),
  ],
  productImport: () => [
    queryKeys.productList.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.pluDirty(),
    queryKeys.stockMovements.root(),
    queryKeys.stocktake.itemsRoot(),
    queryKeys.productForm.root(),
  ],
  receiving: () => [
    queryKeys.receivings.root(),
    queryKeys.inventoryRecords.root(),
    queryKeys.productList.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
    queryKeys.stocktake.itemsRoot(),
  ],
  returnExchange: (registerProcessed: boolean) => [
    queryKeys.returns.root(),
    queryKeys.inventoryRecords.root(),
    ...(!registerProcessed
      ? [
          queryKeys.productList.root(),
          queryKeys.lowStock(false),
          queryKeys.stockInquiryRoot(),
          queryKeys.stockMovements.root(),
          queryKeys.productForm.root(),
          queryKeys.stocktake.itemsRoot(),
        ]
      : []),
  ],
  manualSale: (saleDate: string) => [
    queryKeys.inventoryRecords.root(),
    queryKeys.productList.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.dailySales(saleDate),
    queryKeys.monthlySalesRoot(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
    queryKeys.stocktake.itemsRoot(),
  ],
  disposal: () => [
    queryKeys.disposals.root(),
    queryKeys.inventoryRecords.root(),
    queryKeys.productList.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
    queryKeys.stocktake.itemsRoot(),
  ],
  csvImportCommit: () => [
    queryKeys.csvImportLists(),
    queryKeys.dailySalesRoot(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.productList.root(),
    queryKeys.monthlySalesRoot(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
    queryKeys.stocktake.itemsRoot(),
  ],
  csvImportRollback: () => [
    queryKeys.csvImportLists(),
    queryKeys.dailySalesRoot(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.productList.root(),
    queryKeys.monthlySalesRoot(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
    queryKeys.stocktake.itemsRoot(),
  ],
  dailyReportImport: () => [
    queryKeys.dailyReportImportLists(),
    queryKeys.dailySalesRoot(),
    queryKeys.monthlySalesRoot(),
  ],
  stocktakeStart: () => [queryKeys.stocktake.status(), queryKeys.stocktake.itemsRoot()],
  stocktakeCountUpdate: () => [queryKeys.stocktake.itemsRoot()],
  stocktakeComplete: () => [
    queryKeys.stocktake.status(),
    queryKeys.stocktake.itemsRoot(),
    queryKeys.stocktake.lastCompleted(),
    queryKeys.productList.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
  ],
  integrityFix: () => [
    queryKeys.productList.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
    queryKeys.stocktake.itemsRoot(),
  ],
  thresholdSave: () => [
    queryKeys.thresholdSettings.settings(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
  ],
  pluExportConfirm: () => [
    queryKeys.pluDirty(),
    queryKeys.productList.root(),
    queryKeys.stockMovements.root(),
    queryKeys.productForm.root(),
    queryKeys.lowStock(false),
    queryKeys.stockInquiryRoot(),
  ],
} satisfies Record<string, (...args: never[]) => InvalidationKey[]>;

function stableKey(key: InvalidationKey): string {
  return JSON.stringify(key);
}

export function expectExactInvalidations(
  calls: readonly unknown[][],
  expectedKeys: readonly InvalidationKey[],
): void {
  const actualKeys = calls.map((call) => {
    const filters = call[0] as { queryKey?: InvalidationKey } | undefined;
    if (filters?.queryKey === undefined) throw new Error("queryKey のない invalidate 呼出しです");
    return filters.queryKey;
  });

  expect(actualKeys.map(stableKey).sort()).toEqual(expectedKeys.map(stableKey).sort());
}
