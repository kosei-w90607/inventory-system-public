// src/routes/stock/$code.movements.tsx
//
// UI-06c 商品別在庫変動履歴 route。
// 設計: docs/function-design/66-ui-stock-movements.md §66.3

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { StockMovementsPage } from "@/features/stock-movements/StockMovementsPage";
import type { StockMovementsSearch } from "@/features/stock-movements/types";

const searchSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  type: z
    .enum(["all", "receiving", "return", "sale_auto", "sale_manual", "disposal", "stocktake"])
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/stock/$code/movements")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { code } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleSearchChange = (updater: (prev: StockMovementsSearch) => StockMovementsSearch) => {
    void navigate({ search: (prev) => updater(prev) });
  };

  return (
    <StockMovementsPage productCode={code} search={search} onSearchChange={handleSearchChange} />
  );
}
