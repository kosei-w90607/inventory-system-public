// src/features/products/ProductListPage.tsx
//
// UI-01a 商品検索・一覧 page。

import { PackagePlus, PackageSearch } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/patterns/EmptyState";
import { SearchBar } from "@/components/patterns/SearchBar";
import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";
import { ProductPagination } from "./components/ProductPagination";
import { ProductTable } from "./components/ProductTable";
import { useProductList } from "./hooks/useProductList";
import { buildProductListReturnTo } from "./lib/return-to";
import {
  PRODUCT_PER_PAGE_OPTIONS,
  updateProductListSearch,
  type ProductDiscontinuedMode,
  type ProductListSearch,
  type ProductPerPage,
  type ProductSortDirParam,
  type ProductSortParam,
} from "./search";

export interface ProductListPageProps {
  search: ProductListSearch;
  onSearchChange: (updater: (prev: ProductListSearch) => ProductListSearch) => void;
}

const discontinuedOptions: readonly { value: ProductDiscontinuedMode; label: string }[] = [
  { value: "active", label: "表示中" },
  { value: "all", label: "すべて" },
  { value: "discontinued", label: "廃番のみ" },
];

const sortOptions: readonly { value: ProductSortParam; label: string }[] = [
  { value: "product_code", label: "商品コード" },
  { value: "name", label: "商品名" },
  { value: "stock_quantity", label: "在庫数" },
  { value: "selling_price", label: "売価" },
];

const sortDirOptions: readonly { value: ProductSortDirParam; label: string }[] = [
  { value: "asc", label: "昇順" },
  { value: "desc", label: "降順" },
];

export function ProductListPage({ search, onSearchChange }: ProductListPageProps) {
  const { productsQuery, departmentsQuery, departmentOptions, normalizedSearch } = useProductList({
    search,
  });

  const updateSearch = (patch: Parameters<typeof updateProductListSearch>[1]) => {
    onSearchChange((prev) => updateProductListSearch(prev, patch));
  };
  const returnTo = buildProductListReturnTo(normalizedSearch);

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        title="商品検索・一覧"
        actions={
          <Button type="button" asChild>
            <Link to="/products/new" search={{ returnTo }}>
              <PackagePlus aria-hidden="true" />
              商品登録
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          id="product-search-input"
          value={normalizedSearch.q ?? ""}
          onSearchChange={(value) => {
            updateSearch({ q: value === "" ? undefined : value });
          }}
        />
        <DepartmentFilter
          options={departmentOptions}
          selected={normalizedSearch.dept ?? null}
          disabled={departmentsQuery.isLoading}
          onChange={(dept) => {
            updateSearch({ dept });
          }}
          allLabel="すべての部門"
          widthClass="w-[11rem]"
          idPrefix="product-dept-filter"
        />
        {departmentsQuery.isError ? (
          <p className="text-sm text-destructive" role="alert">
            部門一覧の取得に失敗しました
          </p>
        ) : null}
        <SegmentedControl
          ariaLabel="廃番表示"
          value={normalizedSearch.discontinued}
          options={discontinuedOptions}
          onValueChange={(value) => {
            updateSearch({ discontinued: value });
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="product-sort">
            並び替え
          </label>
          <Select
            value={normalizedSearch.sort}
            onValueChange={(value) => {
              updateSearch({ sort: value as ProductSortParam });
            }}
          >
            <SelectTrigger id="product-sort" className="w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SegmentedControl
          ariaLabel="並び順"
          value={normalizedSearch.dir}
          options={sortDirOptions}
          onValueChange={(value) => {
            updateSearch({ dir: value });
          }}
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="product-per-page">
            表示件数
          </label>
          <Select
            value={String(normalizedSearch.perPage)}
            onValueChange={(value) => {
              updateSearch({ perPage: Number(value) as ProductPerPage });
            }}
          >
            <SelectTrigger id="product-per-page" className="w-[7rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_PER_PAGE_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option} 件
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {productsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : productsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>商品一覧の取得に失敗しました</AlertTitle>
          <AlertDescription>
            検索条件を変えるか、しばらくしてからもう一度お試しください。
          </AlertDescription>
        </Alert>
      ) : productsQuery.data?.items.length === 0 ? (
        // 意図的差分③: bare div → EmptyState 標準 UI（catalog ⑥）
        <EmptyState
          icon={PackageSearch}
          title="該当する商品がありません"
          description="検索条件を変更するか、新しい商品を登録してください"
          action={
            <Button type="button" asChild variant="outline">
              <Link to="/products/new" search={{ returnTo }}>
                商品を登録する
              </Link>
            </Button>
          }
        />
      ) : productsQuery.data ? (
        <div className="space-y-3">
          <ProductTable items={productsQuery.data.items} returnTo={returnTo} />
          <ProductPagination
            page={productsQuery.data.page}
            perPage={productsQuery.data.per_page}
            totalCount={productsQuery.data.total_count}
            onPageChange={(page) => {
              updateSearch({ page });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
