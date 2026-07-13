// src/routes/inventory/disposal/records/$recordId.tsx
//
// UI-05/REQ-206 廃棄・破損記録詳細 route。
// 設計: docs/function-design/65-inventory-record-traceability.md §65.10

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { DisposalRecordDetailPage } from "@/features/inventory-records/DisposalRecordDetailPage";

const searchSchema = z.object({
  returnTo: z.string().max(500).optional().catch(undefined),
});

export const Route = createFileRoute("/inventory/disposal/records/$recordId")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { recordId } = Route.useParams();
  const search = Route.useSearch();
  return <DisposalRecordDetailPage recordId={Number(recordId)} returnTo={search.returnTo} />;
}
