import { useState } from "react";

import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";
import { SearchBar } from "@/components/patterns/SearchBar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Department, Supplier } from "@/lib/bindings";
import type { UseQueryResult } from "@tanstack/react-query";
import type {
  NormalizedPriceRevisionSearch,
  PriceRevisionSearch,
  PriceRevisionSearchPatch,
} from "../priceRevisionSearch";
import { PRODUCT_PER_PAGE_OPTIONS } from "../search";
import { CreateSupplierDialog } from "./CreateSupplierDialog";

export function PriceRevisionFilters({
  search,
  normalized,
  suppliersQuery,
  departmentsQuery,
  onPatch,
}: {
  search: PriceRevisionSearch;
  normalized: NormalizedPriceRevisionSearch;
  suppliersQuery: UseQueryResult<Supplier[]>;
  departmentsQuery: UseQueryResult<Department[]>;
  onPatch: (patch: PriceRevisionSearchPatch) => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const departments = (departmentsQuery.data ?? []).map(({ id, name }) => ({ id, name }));

  return (
    <div className="space-y-3 rounded-md border bg-stone-50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={search.q ?? ""}
          debounceMs={200}
          placeholder="商品コード・商品名・JAN・メーカー品番で検索"
          onSearchChange={(value) => {
            onPatch({ q: value === "" ? undefined : value });
          }}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          取引先
          <select
            className="h-9 w-48 rounded-md border bg-background px-3 text-foreground"
            aria-label="取引先"
            disabled={suppliersQuery.isLoading}
            value={normalized.supplier === undefined ? "" : String(normalized.supplier)}
            onChange={(event) => {
              onPatch({ supplier: event.target.value === "" ? null : Number(event.target.value) });
            }}
          >
            <option value="">すべての取引先</option>
            {(suppliersQuery.data ?? []).map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDialogOpen(true);
          }}
        >
          新しい取引先を追加
        </Button>
        <DepartmentFilter
          options={departments}
          selected={normalized.dept ?? null}
          disabled={departmentsQuery.isLoading}
          idPrefix="price-revision-department"
          widthClass="w-[11rem]"
          onChange={(dept) => {
            onPatch({ dept });
          }}
        />
        <label htmlFor="price-revision-discontinued" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="price-revision-discontinued"
            checked={normalized.discontinued}
            onCheckedChange={(checked) => {
              onPatch({ discontinued: checked === true ? true : undefined });
            }}
          />
          廃番を含む
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          表示件数
          <select
            className="h-9 rounded-md border bg-background px-3 text-foreground"
            aria-label="表示件数"
            value={normalized.perPage}
            onChange={(event) => {
              onPatch({ perPage: Number(event.target.value) as 50 | 100 | 200 });
            }}
          >
            {PRODUCT_PER_PAGE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}件
              </option>
            ))}
          </select>
        </label>
      </div>
      {normalized.supplier !== undefined ? (
        <label
          htmlFor="price-revision-include-unassigned"
          className="flex items-center gap-2 text-sm"
        >
          <Checkbox
            id="price-revision-include-unassigned"
            checked={normalized.includeUnassigned}
            onCheckedChange={(checked) => {
              onPatch({ includeUnassigned: checked === true });
            }}
          />
          取引先未設定の商品も含める
        </label>
      ) : null}
      {suppliersQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          取引先一覧を取得できませんでした。{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => void suppliersQuery.refetch()}
          >
            再試行
          </Button>
        </p>
      ) : null}
      {departmentsQuery.isError ? (
        <p role="alert" className="text-sm text-destructive">
          部門一覧を取得できませんでした。{" "}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0"
            onClick={() => void departmentsQuery.refetch()}
          >
            再試行
          </Button>
        </p>
      ) : null}
      <CreateSupplierDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={async (supplier) => {
          await suppliersQuery.refetch();
          onPatch({ supplier: supplier.id });
        }}
      />
    </div>
  );
}
