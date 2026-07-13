import { useQuery } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";

export function useStocktakeStatus() {
  const query = useQuery({
    queryKey: queryKeys.stocktake.status(),
    queryFn: () =>
      unwrapResult(commands.getActiveStocktake(), {
        source: "commands",
        cmd: "get_active_stocktake",
      }),
    staleTime: 0,
  });

  return {
    ...query,
    activeStocktake: query.data ?? null,
    activeStocktakeId: query.data?.id ?? null,
  };
}
