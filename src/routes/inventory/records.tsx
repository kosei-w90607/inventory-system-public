// src/routes/inventory/records.tsx
//
// UI-02b/05b 入出庫履歴ハブ route。
// 設計: docs/function-design/65-inventory-record-traceability.md §65.10

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { InventoryRecordsPage } from "@/features/inventory-records/InventoryRecordsPage";
import type { InventoryRecordsSearch } from "@/features/inventory-records/types";

const searchSchema = z.object({
  recordType: z
    .enum(["all", "receiving_record", "return_record", "manual_sale", "disposal_record"])
    .optional()
    .catch(undefined),
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
  q: z.string().max(100).optional().catch(undefined),
  recordId: z.coerce.number().int().positive().optional().catch(undefined),
  departmentId: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(["all", "active"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/inventory/records")({
  validateSearch: searchSchema,
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
