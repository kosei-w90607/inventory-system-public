import { useMutation, useQueryClient } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import type { PriceRevisionInput, PriceRevisionResult } from "@/lib/bindings";
import { invalidateByContract, invalidationContract } from "@/lib/invalidation-contract";
import { unwrapResult } from "@/lib/invoke";

export function useReviseProductPrice({
  onSuccess,
  onError,
}: {
  onSuccess?: (result: PriceRevisionResult, input: PriceRevisionInput) => void;
  onError?: (error: Error, input: PriceRevisionInput) => void;
} = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PriceRevisionInput) =>
      unwrapResult(commands.reviseProductPrice(input), {
        source: "commands",
        cmd: "revise_product_price",
      }),
    onSuccess: async (result, input) => {
      await invalidateByContract(
        queryClient,
        invalidationContract.productPriceRevise(input.product_code),
      );
      onSuccess?.(result, input);
    },
    onError: (error, input) => {
      onError?.(error, input);
    },
  });
}
