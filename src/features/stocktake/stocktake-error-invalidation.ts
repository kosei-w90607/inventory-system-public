import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

/** conflict / not-in-progress 後に active state を防御的に再取得する。 */
export async function refreshStocktakeStateAfterConflict(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.stocktake.status() }),
    queryClient.invalidateQueries({ queryKey: queryKeys.stocktake.itemsRoot() }),
  ]);
}

/** validation failure 後に再試行用の最新明細を取得する。 */
export async function refreshStocktakeItemsAfterValidation(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.stocktake.itemsRoot() });
}
