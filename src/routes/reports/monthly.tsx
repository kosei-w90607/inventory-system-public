// src/routes/reports/monthly.tsx
//
// UI-09b 月次売上レポート画面のファイルベースルート。
// TanStack Router validateSearch + zod 4 直接渡し (UI-09a 同パターン)。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.4

import { createFileRoute } from "@tanstack/react-router";

import { MonthlySalesPage } from "@/features/monthly-sales/MonthlySalesPage";
import { monthlySalesSearchSchema, type MonthlySalesSearch } from "@/features/monthly-sales/types";

export type SearchParams = MonthlySalesSearch;

export const Route = createFileRoute("/reports/monthly")({
  validateSearch: monthlySalesSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleSearchChange = (updater: (prev: MonthlySalesSearch) => MonthlySalesSearch) => {
    void navigate({ search: (prev) => updater(prev) });
  };

  return <MonthlySalesPage search={search} onSearchChange={handleSearchChange} />;
}
