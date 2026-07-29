// src/routes/products/index.tsx
//
// UI-01a 商品検索・一覧のファイルベースルート。
// 設計: docs/function-design/50-ui-product-list.md §50.4

import { createFileRoute } from "@tanstack/react-router";

import { ProductListPage } from "@/features/products/ProductListPage";
import { productListSearchSchema, type ProductListSearch } from "@/features/products/search";

export const Route = createFileRoute("/products/")({
  validateSearch: productListSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  const handleSearchChange = (updater: (prev: ProductListSearch) => ProductListSearch) => {
    void navigate({ search: (prev) => updater(prev) });
  };

  return <ProductListPage search={search} onSearchChange={handleSearchChange} />;
}
