// src/routes/csv-import.records.$importId.tsx
//
// REQ-206 / REQ-207 CSV取込み記録詳細 route。

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { CsvImportRecordDetailPage } from "@/features/inventory-records/CsvImportRecordDetailPage";

const searchSchema = z.object({
  returnTo: z.string().max(500).optional().catch(undefined),
});

export const Route = createFileRoute("/csv-import/records/$importId")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { importId } = Route.useParams();
  const search = Route.useSearch();
  return <CsvImportRecordDetailPage importId={Number(importId)} returnTo={search.returnTo} />;
}
