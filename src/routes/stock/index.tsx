// src/routes/stock/index.tsx
//
// UI-06a 在庫照会画面のファイルベースルート。
// TanStack Router validateSearch + zod 4 直接渡し（UI-09a/b 同パターン）。
// sibling route として UI-06b = /stock/low、UI-06c = /stock/$code/movements を予約。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.4

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { StockInquiryPage } from "@/features/stock-inquiry/StockInquiryPage";
import type { StockInquirySearch } from "@/features/stock-inquiry/types";

const searchSchema = z.object({
  q: z.string().min(1).max(100).optional().catch(undefined),
  dept: z.coerce.number().int().positive().optional().catch(undefined),
  status: z.enum(["all", "stockout", "low_stock"]).optional().catch(undefined),
  selected: z.string().min(1).max(20).optional().catch(undefined),
});

export type SearchParams = z.output<typeof searchSchema>;

export const Route = createFileRoute("/stock/")({
  validateSearch: searchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleSearchChange = (updater: (prev: StockInquirySearch) => StockInquirySearch) => {
    void navigate({ search: (prev) => updater(prev) });
  };

  return <StockInquiryPage search={search} onSearchChange={handleSearchChange} />;
}
