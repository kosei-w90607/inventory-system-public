// src/routes/stock/index.tsx
//
// UI-06a 在庫照会画面のファイルベースルート。
// TanStack Router validateSearch + zod 4 直接渡し（UI-09a/b 同パターン）。
// sibling route として UI-06c = /stock/$code/movements を予約。
// UI-06b 在庫少一覧は独立画面を作らず、本 route への status=low_stock deep-link とする（D-047）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.4

import { createFileRoute } from "@tanstack/react-router";

import { StockInquiryPage } from "@/features/stock-inquiry/StockInquiryPage";
import { stockInquirySearchSchema, type StockInquirySearch } from "@/features/stock-inquiry/types";

export type SearchParams = StockInquirySearch;

export const Route = createFileRoute("/stock/")({
  validateSearch: stockInquirySearchSchema,
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
