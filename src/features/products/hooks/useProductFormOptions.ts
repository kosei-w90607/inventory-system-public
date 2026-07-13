// src/features/products/hooks/useProductFormOptions.ts
//
// UI-01b-D7/D8: 部門は必須候補、取引先は任意候補として別々に扱う。

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";

import { commands } from "@/lib/bindings";
import type { Department, Supplier } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";

export interface UseProductFormOptionsResult {
  departmentsQuery: UseQueryResult<Department[]>;
  suppliersQuery: UseQueryResult<Supplier[]>;
  departments: Department[];
  suppliers: Supplier[];
}

export function useProductFormOptions(): UseProductFormOptionsResult {
  const departmentsQuery = useQuery({
    queryKey: queryKeys.productList.departments(),
    queryFn: () =>
      unwrapResult(commands.listDepartments(), {
        source: "commands",
        cmd: "list_departments",
      }),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 0,
  });

  const suppliersQuery = useQuery({
    queryKey: queryKeys.productForm.suppliers(),
    queryFn: () =>
      unwrapResult(commands.listSuppliers(), {
        source: "commands",
        cmd: "list_suppliers",
      }),
    staleTime: 5 * 60_000,
    gcTime: 5 * 60_000,
    retry: 0,
  });

  const departments = useMemo(
    () => [...(departmentsQuery.data ?? [])].sort((a, b) => a.id - b.id),
    [departmentsQuery.data],
  );
  const suppliers = useMemo(
    () => [...(suppliersQuery.data ?? [])].sort((a, b) => a.id - b.id),
    [suppliersQuery.data],
  );

  return { departmentsQuery, suppliersQuery, departments, suppliers };
}
