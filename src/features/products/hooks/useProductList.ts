// src/features/products/hooks/useProductList.ts
//
// UI-01a 商品検索・一覧の command 呼び出し hook。

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import type { Department, PaginatedResult, ProductWithRelations } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import {
  buildProductSearchQuery,
  normalizeProductListSearch,
  type NormalizedProductListSearch,
  type ProductListSearch,
} from "../search";

// DepartmentOption の唯一の定義は patterns/DepartmentFilter.tsx（59 §59.3、SPEC-UIBB-6）。
// 本 module 内で DepartmentOption[] を使用するため、単文の re-export（`export type { X } from`）
// ではローカル binding が入らず成立しない。import type + export type の 2 文とする（round 1 P1-5）。
import type { DepartmentOption } from "@/components/patterns/DepartmentFilter";
export type { DepartmentOption };

export interface UseProductListArgs {
  search: ProductListSearch;
}

export interface UseProductListResult {
  productsQuery: UseQueryResult<PaginatedResult<ProductWithRelations>>;
  departmentsQuery: UseQueryResult<Department[]>;
  departmentOptions: DepartmentOption[];
  normalizedSearch: NormalizedProductListSearch;
}

export function useProductList(args: UseProductListArgs): UseProductListResult {
  const normalizedSearch = useMemo(() => normalizeProductListSearch(args.search), [args.search]);
  const query = useMemo(() => buildProductSearchQuery(normalizedSearch), [normalizedSearch]);

  const productsQuery = useQuery({
    queryKey: queryKeys.productList.search(normalizedSearch),
    queryFn: () =>
      unwrapResult(commands.searchProducts(query), {
        source: "commands",
        cmd: "search_products",
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const departmentsQuery = useQuery({
    queryKey: queryKeys.productList.departments(),
    queryFn: () =>
      unwrapResult(commands.listDepartments(), {
        source: "commands",
        cmd: "list_departments",
      }),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const departmentOptions = useMemo(
    () =>
      (departmentsQuery.data ?? [])
        .map((department) => ({ id: department.id, name: department.name }))
        .sort((a, b) => a.id - b.id),
    [departmentsQuery.data],
  );

  return { productsQuery, departmentsQuery, departmentOptions, normalizedSearch };
}
