import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import type {
  Department,
  PaginatedResult,
  PriceHistoryEntry,
  ProductWithRelations,
  Supplier,
} from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import {
  buildPriceRevisionProductSearchQuery,
  normalizePriceRevisionSearch,
  type NormalizedPriceRevisionSearch,
  type PriceRevisionSearchInput,
} from "../priceRevisionSearch";

export interface PriceRevisionRow {
  product: ProductWithRelations;
  latestChangedAt: string | undefined;
}

export interface UsePriceRevisionListResult {
  productsQuery: UseQueryResult<PaginatedResult<ProductWithRelations>>;
  suppliersQuery: UseQueryResult<Supplier[]>;
  departmentsQuery: UseQueryResult<Department[]>;
  historyQueries: UseQueryResult<PriceHistoryEntry[]>[];
  rows: PriceRevisionRow[];
  normalizedSearch: NormalizedPriceRevisionSearch;
}

export function usePriceRevisionList({
  search,
}: {
  search: PriceRevisionSearchInput;
}): UsePriceRevisionListResult {
  const normalizedSearch = useMemo(() => normalizePriceRevisionSearch(search), [search]);
  const productQuery = useMemo(
    () => buildPriceRevisionProductSearchQuery(normalizedSearch),
    [normalizedSearch],
  );

  const productsQuery = useQuery({
    queryKey: queryKeys.priceRevision.search(normalizedSearch),
    queryFn: () =>
      unwrapResult(commands.searchProducts(productQuery), {
        source: "commands",
        cmd: "search_products",
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const suppliersQuery = useQuery({
    queryKey: queryKeys.priceRevision.suppliers(),
    queryFn: () =>
      unwrapResult(commands.listSuppliers(), {
        source: "commands",
        cmd: "list_suppliers",
      }),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const departmentsQuery = useQuery({
    queryKey: queryKeys.priceRevision.departments(),
    queryFn: () =>
      unwrapResult(commands.listDepartments(), {
        source: "commands",
        cmd: "list_departments",
      }),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const products = productsQuery.data?.items ?? [];
  const historyQueries = useQueries({
    queries: products.map((product) => ({
      queryKey: queryKeys.priceRevision.history(product.product_code),
      queryFn: () =>
        unwrapResult(commands.listPriceHistory(product.product_code, 1), {
          source: "commands",
          cmd: "list_price_history",
        }),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const rows = products.map((product, index) => ({
    product,
    latestChangedAt: historyQueries[index]?.data?.[0]?.changed_at,
  }));

  return {
    productsQuery,
    suppliersQuery,
    departmentsQuery,
    historyQueries,
    rows,
    normalizedSearch,
  };
}
