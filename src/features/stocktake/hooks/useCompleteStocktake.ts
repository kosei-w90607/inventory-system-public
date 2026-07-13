import { useMutation } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";

export interface CompleteStocktakeVariables {
  stocktakeId: number;
  forceFill: boolean;
}

export function useCompleteStocktake() {
  return useMutation({
    mutationFn: ({ stocktakeId, forceFill }: CompleteStocktakeVariables) =>
      unwrapResult(commands.completeStocktake(stocktakeId, forceFill), {
        source: "commands",
        cmd: "complete_stocktake",
      }),
  });
}
