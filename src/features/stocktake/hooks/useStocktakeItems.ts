import { useQuery } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";

import type { StocktakeSearch } from "../types";

const STOCKTAKE_PER_PAGE = 200;

export function useStocktakeItems(stocktakeId: number | null, search: StocktakeSearch) {
  const departmentId = search.dept ?? null;
  const countedOnly = search.counted_only ?? null;
  const page = search.page ?? 1;

  return useQuery({
    queryKey:
      stocktakeId === null
        ? queryKeys.stocktake.itemsRoot()
        : queryKeys.stocktake.items(stocktakeId, {
            departmentId,
            countedOnly,
            page,
            perPage: STOCKTAKE_PER_PAGE,
          }),
    enabled: stocktakeId !== null,
    staleTime: 0,
    queryFn: () =>
      unwrapResult(
        commands.getStocktakeItems(
          stocktakeId ?? 0,
          departmentId,
          countedOnly,
          page,
          STOCKTAKE_PER_PAGE,
        ),
        { source: "commands", cmd: "get_stocktake_items" },
      ),
  });
}
