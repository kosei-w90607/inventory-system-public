import { useMutation } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";

export interface UpdateCountVariables {
  stocktakeItemId: number;
  actualCount: number;
}

export function useUpdateCount() {
  return useMutation({
    mutationFn: ({ stocktakeItemId, actualCount }: UpdateCountVariables) =>
      unwrapResult(commands.updateCount(stocktakeItemId, actualCount), {
        source: "commands",
        cmd: "update_count",
      }),
  });
}
