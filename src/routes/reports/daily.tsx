// src/routes/reports/daily.tsx
//
// UI-09a 日次売上レポート画面のファイルベースルート。
// TanStack Router validateSearch + zod 4 直接渡し (本 repo 初実装、ADR-002 + §56.4)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.4

import { createFileRoute } from "@tanstack/react-router";
import { DailySalesPage } from "@/features/daily-sales/DailySalesPage";
import { dailySalesSearchSchema, type DailySalesSearch } from "@/features/daily-sales/types";

export type SearchParams = DailySalesSearch;

export const Route = createFileRoute("/reports/daily")({
  validateSearch: dailySalesSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleSearchChange = (updater: (prev: DailySalesSearch) => DailySalesSearch) => {
    void navigate({ search: (prev) => updater(prev) });
  };

  return <DailySalesPage search={search} onSearchChange={handleSearchChange} />;
}
