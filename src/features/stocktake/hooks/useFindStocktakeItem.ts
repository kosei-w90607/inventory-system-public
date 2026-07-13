import { useMutation } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";

export interface FindStocktakeItemVariables {
  stocktakeId: number;
  code: string;
}

export function useFindStocktakeItem() {
  return useMutation({
    mutationFn: ({ stocktakeId, code }: FindStocktakeItemVariables) =>
      unwrapResult(commands.findStocktakeItem(stocktakeId, code), {
        source: "commands",
        cmd: "find_stocktake_item",
      }),
  });
}
