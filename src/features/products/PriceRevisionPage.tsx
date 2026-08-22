import { Link } from "@tanstack/react-router";
import { PackageSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/patterns/EmptyState";
import { ListSkeleton } from "@/components/patterns/ListSkeleton";
import { PageHeader } from "@/components/patterns/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceRevisionFilters } from "./components/PriceRevisionFilters";
import { PriceRevisionTable } from "./components/PriceRevisionTable";
import { ProductPagination } from "./components/ProductPagination";
import { usePriceRevisionList } from "./hooks/usePriceRevisionList";
import {
  resetPriceRevisionSearch,
  updatePriceRevisionSearch,
  type PriceRevisionSearch,
  type PriceRevisionSearchPatch,
} from "./priceRevisionSearch";

export function PriceRevisionPage({
  search,
  onSearchChange,
}: {
  search: PriceRevisionSearch;
  onSearchChange: (updater: (current: PriceRevisionSearch) => PriceRevisionSearch) => void;
}) {
  const list = usePriceRevisionList({ search });
  const [assignSupplier, setAssignSupplier] = useState(true);
  useEffect(() => {
    setAssignSupplier(true);
  }, [list.normalizedSearch.supplier]);
  const patchSearch = (patch: PriceRevisionSearchPatch) => {
    if ("supplier" in patch) setAssignSupplier(true);
    onSearchChange((current) => updatePriceRevisionSearch(current, patch));
  };
  const hasFilters =
    list.normalizedSearch.q !== undefined ||
    list.normalizedSearch.supplier !== undefined ||
    list.normalizedSearch.dept !== undefined ||
    list.normalizedSearch.discontinued;

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="一括価格改定"
        subtitle="値上げリストを商品と照合し、1行ずつ売価・原価を確定します。"
      />
      <PriceRevisionFilters
        search={search}
        normalized={list.normalizedSearch}
        suppliersQuery={list.suppliersQuery}
        departmentsQuery={list.departmentsQuery}
        onPatch={patchSearch}
      />
      {list.normalizedSearch.supplier !== undefined ? (
        <label
          htmlFor="price-revision-assign-supplier"
          className="flex items-center gap-2 rounded-md border px-4 py-3 text-sm"
        >
          <Checkbox
            id="price-revision-assign-supplier"
            checked={assignSupplier}
            onCheckedChange={(checked) => {
              setAssignSupplier(checked === true);
            }}
          />
          未設定の商品にこの取引先を設定する
        </label>
      ) : null}
      <Alert role="note">
        <AlertDescription>
          画面を再読み込みすると、確定前に入力した新売価・新原価は失われます。1行ずつ確定してください。
        </AlertDescription>
      </Alert>
      {list.productsQuery.isLoading ? (
        <ListSkeleton rows={6} columns={10} />
      ) : list.productsQuery.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>商品一覧を取得できませんでした</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>しばらくしてから、もう一度お試しください。</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void list.productsQuery.refetch()}
            >
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      ) : list.rows.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={PackageSearch}
            title="条件に一致する商品がありません"
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onSearchChange(() => resetPriceRevisionSearch());
                }}
              >
                絞り込みを解除
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={PackageSearch}
            title="該当する商品がありません"
            action={
              <Button type="button" asChild variant="outline">
                <Link to="/products">商品一覧を開く</Link>
              </Button>
            }
          />
        )
      ) : list.productsQuery.data ? (
        <div className="space-y-3">
          <PriceRevisionTable
            rows={list.rows}
            selectedSupplierId={list.normalizedSearch.supplier}
            assignSupplier={assignSupplier}
          />
          <ProductPagination
            page={list.productsQuery.data.page}
            perPage={list.productsQuery.data.per_page}
            totalCount={list.productsQuery.data.total_count}
            onPageChange={(page) => {
              patchSearch({ page });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
