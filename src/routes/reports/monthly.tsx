// src/routes/reports/monthly.tsx
//
// UI-09b 月次売上レポート画面のファイルベースルート。
// TanStack Router validateSearch + zod 4 直接渡し (UI-09a 同パターン)。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.4

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { MonthlySalesPage } from "@/features/monthly-sales/MonthlySalesPage";
import type { MonthlySalesSearch } from "@/features/monthly-sales/MonthlySalesPage";

const searchSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
    .catch(undefined),
  mode: z.enum(["by_product", "by_department"]).optional().catch(undefined),
  sortBy: z.enum(["name", "quantity", "amount", "prev_month_diff"]).optional().catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export type SearchParams = z.output<typeof searchSchema>;

export const Route = createFileRoute("/reports/monthly")({
  validateSearch: searchSchema,
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
