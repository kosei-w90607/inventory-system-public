// src/routes/products/index.tsx
//
// UI-01a 商品検索・一覧のファイルベースルート。
// 設計: docs/function-design/50-ui-product-list.md §50.4

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { ProductListPage } from "@/features/products/ProductListPage";
import type { ProductListSearch } from "@/features/products/search";

const searchSchema = z.object({
  q: z.string().max(100).optional().catch(undefined),
  dept: z.coerce.number().int().positive().optional().catch(undefined),
  discontinued: z.enum(["active", "all", "discontinued"]).optional().catch(undefined),
  sort: z
    .enum(["product_code", "name", "stock_quantity", "selling_price"])
    .optional()
    .catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().optional().catch(undefined),
  perPage: z.coerce
    .number()
    .refine((value): value is 50 | 100 | 200 => [50, 100, 200].includes(value))
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/products/")({
  validateSearch: searchSchema,
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
