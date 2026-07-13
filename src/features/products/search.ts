// src/features/products/search.ts
//
// UI-01a-D1〜D4: URL search params と ProductSearchQuery の変換を一箇所に集約する。

import type { ProductSearchQuery, SortKey, SortOrder } from "@/lib/bindings";

export type ProductDiscontinuedMode = "active" | "all" | "discontinued";
export type ProductSortParam = "product_code" | "name" | "stock_quantity" | "selling_price";
export type ProductSortDirParam = "asc" | "desc";
export type ProductPerPage = 50 | 100 | 200;

export interface ProductListSearch {
  q?: string;
  dept?: number;
  discontinued?: ProductDiscontinuedMode;
  sort?: ProductSortParam;
  dir?: ProductSortDirParam;
  page?: number;
  perPage?: ProductPerPage;
}

export interface ProductListSearchInput {
  q?: unknown;
  dept?: unknown;
  discontinued?: unknown;
  sort?: unknown;
  dir?: unknown;
  page?: unknown;
  perPage?: unknown;
}

export interface ProductListSearchPatch extends Partial<Omit<ProductListSearch, "dept">> {
  dept?: number | null;
}

export interface NormalizedProductListSearch {
  q: string | undefined;
  dept: number | undefined;
  discontinued: ProductDiscontinuedMode;
  sort: ProductSortParam;
  dir: ProductSortDirParam;
  page: number;
  perPage: ProductPerPage;
}

export const PRODUCT_PER_PAGE_OPTIONS = [50, 100, 200] as const;

const sortKeyMap: Record<ProductSortParam, SortKey> = {
  product_code: "ProductCode",
  name: "Name",
  stock_quantity: "StockQuantity",
  selling_price: "SellingPrice",
};

const sortOrderMap: Record<ProductSortDirParam, SortOrder> = {
  asc: "Asc",
  desc: "Desc",
};

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue >= 1 ? numberValue : fallback;
}

function normalizeDepartment(value: unknown): number | undefined {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isInteger(numberValue) && numberValue >= 1 ? numberValue : undefined;
}

function normalizePerPage(value: unknown): ProductPerPage {
  const numberValue = typeof value === "number" ? value : Number(value);
  return PRODUCT_PER_PAGE_OPTIONS.includes(numberValue as ProductPerPage)
    ? (numberValue as ProductPerPage)
    : 50;
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback;
}

export function normalizeProductListSearch(
  input: ProductListSearchInput,
): NormalizedProductListSearch {
  return {
    q: normalizeString(input.q),
    dept: normalizeDepartment(input.dept),
    discontinued: normalizeEnum(
      input.discontinued,
      ["active", "all", "discontinued"] as const,
      "active",
    ),
    sort: normalizeEnum(
      input.sort,
      ["product_code", "name", "stock_quantity", "selling_price"] as const,
      "product_code",
    ),
    dir: normalizeEnum(input.dir, ["asc", "desc"] as const, "asc"),
    page: normalizePositiveInt(input.page, 1),
    perPage: normalizePerPage(input.perPage),
  };
}

export function buildProductSearchQuery(search: ProductListSearchInput): ProductSearchQuery {
  const normalized = normalizeProductListSearch(search);
  const discontinuedMap: Record<ProductDiscontinuedMode, boolean | null> = {
    active: false,
    all: null,
    discontinued: true,
  };

  return {
    keyword: normalized.q ?? null,
    department_id: normalized.dept ?? null,
    is_discontinued: discontinuedMap[normalized.discontinued],
    sort_key: sortKeyMap[normalized.sort],
    sort_order: sortOrderMap[normalized.dir],
    page: normalized.page,
    per_page: normalized.perPage,
  };
}

export function updateProductListSearch(
  current: ProductListSearch,
  patch: ProductListSearchPatch,
): ProductListSearch {
  const next: ProductListSearch = { ...current };
  if ("q" in patch) next.q = patch.q;
  if ("dept" in patch) next.dept = patch.dept ?? undefined;
  if ("discontinued" in patch) next.discontinued = patch.discontinued;
  if ("sort" in patch) next.sort = patch.sort;
  if ("dir" in patch) next.dir = patch.dir;
  if ("page" in patch) next.page = patch.page;
  if ("perPage" in patch) next.perPage = patch.perPage;

  const pageOnlyChange = Object.keys(patch).length === 1 && "page" in patch;
  return pageOnlyChange ? next : { ...next, page: 1 };
}
