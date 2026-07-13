import { useQuery } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";

export function useLastCompletedStocktake() {
  return useQuery({
    queryKey: queryKeys.stocktake.lastCompleted(),
    queryFn: () =>
      unwrapResult(commands.getLastCompletedStocktake(), {
        source: "commands",
        cmd: "get_last_completed_stocktake",
      }),
  });
}
