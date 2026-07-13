// src/routes/reports/daily.tsx
//
// UI-09a 日次売上レポート画面のファイルベースルート。
// TanStack Router validateSearch + zod 4 直接渡し (本 repo 初実装、ADR-002 + §56.4)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.4

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DailySalesPage } from "@/features/daily-sales/DailySalesPage";
import type { DailySalesSearch } from "@/features/daily-sales/DailySalesPage";

const searchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  dept: z.coerce.number().int().positive().optional().catch(undefined),
  sortBy: z
    .enum(["product_code", "name", "quantity", "unit_price", "amount"])
    .optional()
    .catch(undefined),
  sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
});

export type SearchParams = z.output<typeof searchSchema>;

export const Route = createFileRoute("/reports/daily")({
  validateSearch: searchSchema,
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
