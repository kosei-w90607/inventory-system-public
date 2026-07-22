export const REEXPORT_SURVIVOR_FILES = new Map<string, string>([
  [
    "test/invalidation-oracle.ts",
    'export { invalidationContract as d052InvalidationOracle } from "../lib/contract-bridge";',
  ],
  [
    "lib/contract-bridge.ts",
    `
export { invalidationContract };
import { invalidationContract } from "./invalidation-contract";
`,
  ],
  ["lib/invalidation-contract.ts", "export const invalidationContract = {};"],
]);

export const HELPER_CONCAT_SURVIVOR_SOURCE = `
invalidateByContract(
  queryClient,
  invalidationContract.manualSale(saleDate).concat(
    saleDate.endsWith("-31") ? [queryKeys.inventoryRecords.root()] : [],
  ),
);
`;

export const HELPER_SPREAD_SOURCE = `
invalidateByContract(
  queryClient,
  ...[invalidationContract.manualSale(saleDate)],
);
`;

export const HELPER_CONDITIONAL_SOURCE = `
invalidateByContract(
  queryClient,
  shouldRefresh
    ? invalidationContract.manualSale(saleDate)
    : invalidationContract.disposal(),
);
`;

export const HELPER_WRAPPER_SOURCE = `
invalidateByContract(
  queryClient,
  identity(invalidationContract.manualSale(saleDate)),
);
`;

export const COMPUTED_INVALIDATE_SURVIVOR_SOURCE = `
const method = ["invalidate", "Queries"].join("");
const client = queryClient as unknown as Record<
  string,
  (filters: { queryKey: readonly unknown[] }) => Promise<unknown>
>;
await client[method]({ queryKey: queryKeys.pluDirty() });
`;

export const BOUND_INVALIDATE_ALIAS_SOURCE = `
const runInvalidation = queryClient.invalidateQueries.bind(queryClient);
await runInvalidation({ queryKey: queryKeys.pluDirty() });
`;

export const DESTRUCTURED_INVALIDATE_ALIAS_SOURCE = `
const { invalidateQueries: runInvalidation } = queryClient;
await runInvalidation({ queryKey: queryKeys.pluDirty() });
`;

export const ASSIGNED_DESTRUCTURED_INVALIDATE_ALIAS_SOURCE = `
const { invalidateQueries: directInvalidation } = queryClient;
let runInvalidation = safeInvalidate;
runInvalidation = directInvalidation;
await runInvalidation({ queryKey: queryKeys.pluDirty() });
`;

export const COMPUTED_DESTRUCTURED_INVALIDATE_ALIAS_SOURCE = `
const method = ["invalidate", "Queries"].join("");
const { [method]: runInvalidation } = queryClient;
await runInvalidation({ queryKey: queryKeys.pluDirty() });
`;

export const HELPER_IMPORT_ALIAS_SOURCE = `
import { invalidateByContract as applyInvalidation } from "@/lib/invalidation-contract";
applyInvalidation(
  queryClient,
  invalidationContract.manualSale(saleDate).concat([queryKeys.pluDirty()]),
);
`;

export const ASSIGNED_INVALIDATE_ALIAS_SOURCE = `
let runInvalidation = safeInvalidate;
runInvalidation = queryClient.invalidateQueries.bind(queryClient);
await runInvalidation({ queryKey: queryKeys.pluDirty() });
`;

export const ASSIGNED_HELPER_ALIAS_SOURCE = `
let applyInvalidation = safeApply;
applyInvalidation = invalidateByContract;
applyInvalidation(
  queryClient,
  invalidationContract.manualSale(saleDate).concat([queryKeys.pluDirty()]),
);
`;
