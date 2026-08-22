import { createFileRoute } from "@tanstack/react-router";

import { PriceRevisionPage } from "@/features/products/PriceRevisionPage";
import {
  priceRevisionSearchSchema,
  type PriceRevisionSearch,
} from "@/features/products/priceRevisionSearch";

export const Route = createFileRoute("/products/price-revision")({
  validateSearch: priceRevisionSearchSchema,
  component: RouteComponent,
});

function RouteComponent() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <PriceRevisionPage
      search={search}
      onSearchChange={(updater: (current: PriceRevisionSearch) => PriceRevisionSearch) => {
        void navigate({ search: (current) => updater(current) });
      }}
    />
  );
}
