// src/routes/inventory/records.tsx
//
// UI-02b/05b 入出庫履歴ハブ route。
// 設計: docs/function-design/65-inventory-record-traceability.md §65.10

import { createFileRoute } from "@tanstack/react-router";

import { InventoryRecordsPage } from "@/features/inventory-records/InventoryRecordsPage";
import {
  inventoryRecordsSearchSchema,
  type InventoryRecordsSearch,
} from "@/features/inventory-records/types";

export const Route = createFileRoute("/inventory/records")({
  validateSearch: inventoryRecordsSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleSearchChange = (
    updater: (prev: InventoryRecordsSearch) => InventoryRecordsSearch,
  ) => {
    void navigate({ search: (prev) => updater(prev) });
  };

  return <InventoryRecordsPage search={search} onSearchChange={handleSearchChange} />;
}
