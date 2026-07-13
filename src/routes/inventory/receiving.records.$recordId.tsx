// src/routes/inventory/receiving.records.$recordId.tsx
//
// REQ-201/REQ-206 入庫記録詳細 route。

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ReceivingRecordDetailPage } from "@/features/inventory-records/ReceivingRecordDetailPage";

const searchSchema = z.object({
  returnTo: z.string().max(500).optional().catch(undefined),
});

export const Route = createFileRoute("/inventory/receiving/records/$recordId")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const { recordId } = Route.useParams();
  const search = Route.useSearch();
  return <ReceivingRecordDetailPage recordId={Number(recordId)} returnTo={search.returnTo} />;
}
