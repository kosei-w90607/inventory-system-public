import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { queryKeys } from "./query-keys";

export type InvalidationKey = QueryKey;

/** D-052-C1〜C16: mutation 成功時に stale 化する consumer query の SSOT。 */
export const invalidationContract = {
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
  ],
} satisfies Record<string, (...args: never[]) => InvalidationKey[]>;

export async function invalidateByContract(
  queryClient: QueryClient,
  keys: readonly InvalidationKey[],
): Promise<void> {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
