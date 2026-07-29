// src/routes/stock/$code.movements.tsx
//
// UI-06c 商品別在庫変動履歴 route。
// 設計: docs/function-design/66-ui-stock-movements.md §66.3

import { createFileRoute } from "@tanstack/react-router";

import { StockMovementsPage } from "@/features/stock-movements/StockMovementsPage";
import {
  stockMovementsSearchSchema,
  type StockMovementsSearch,
} from "@/features/stock-movements/types";

export const Route = createFileRoute("/stock/$code/movements")({
  validateSearch: stockMovementsSearchSchema,
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
