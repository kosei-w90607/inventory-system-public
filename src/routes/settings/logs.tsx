import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { OperationLogsPage } from "@/features/operation-logs/OperationLogsPage";
import type { OperationLogsSearch } from "@/features/operation-logs/types";

const date = z
  .union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)])
  .optional()
  .catch(undefined);
export const operationLogsSearchSchema = z.object({
  start_date: date,
  end_date: date,
  operation_type: z.string().optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
});

export const Route = createFileRoute("/settings/logs")({
  validateSearch: operationLogsSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <OperationLogsPage
      search={search}
      onSearchChange={(updater: (previous: OperationLogsSearch) => OperationLogsSearch) => {
        void navigate({ search: (previous) => updater(previous) });
      }}
    />
  );
}
