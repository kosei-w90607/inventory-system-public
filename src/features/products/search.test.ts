// src/features/products/search.test.ts
//
// UI-01a-D1〜D4/D7: URL search params -> ProductSearchQuery mapping と page reset/preserve。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  PRODUCT_DISCONTINUED_OPTIONS,
  PRODUCT_PER_PAGE_OPTIONS,
  PRODUCT_SORT_DIRECTION_OPTIONS,
  PRODUCT_SORT_OPTIONS,
  buildProductSearchQuery,
  normalizeProductListSearch,
  productListSearchSchema,
  updateProductListSearch,
} from "./search";
import { MOVEMENT_TYPE_OPTIONS, stockMovementsSearchSchema } from "../stock-movements/types";
import {
  INVENTORY_RECORD_STATUS_OPTIONS,
  INVENTORY_RECORD_TYPE_OPTIONS,
  inventoryRecordsSearchSchema,
} from "../inventory-records/types";
import {
  DAILY_SORT_DESCRIPTORS,
  DAILY_SORT_DIRECTION_OPTIONS,
  dailySalesSearchSchema,
} from "../daily-sales/types";
import {
  MONTHLY_MODE_DESCRIPTORS,
  MONTHLY_SORT_DESCRIPTORS,
  MONTHLY_SORT_DIRECTION_OPTIONS,
  monthlySalesSearchSchema,
} from "../monthly-sales/types";
import { STOCK_FILTER_DESCRIPTORS, stockInquirySearchSchema } from "../stock-inquiry/types";

describe("product list search mapping (UI-01a)", () => {
  it("UI-01a-D1/D3: defaults to active products payload", () => {
    expect(buildProductSearchQuery({})).toEqual({
      keyword: null,
      department_id: null,
      is_discontinued: false,
      sort_key: "ProductCode",
      sort_order: "Asc",
      page: 1,
      per_page: 50,
    });
  });

  it("UI-01a-D2/D3: maps URL params to generated enum payload", () => {
    expect(
      buildProductSearchQuery({
        q: "  HZ-0047  ",
        dept: 3,
        discontinued: "discontinued",
        sort: "selling_price",
        dir: "desc",
        page: 4,
        perPage: 200,
      }),
    ).toEqual({
      keyword: "HZ-0047",
      department_id: 3,
      is_discontinued: true,
      sort_key: "SellingPrice",
      sort_order: "Desc",
      page: 4,
      per_page: 200,
    });
  });

  it("UI-01a-D2/D4: normalizes invalid URL values before command payload", () => {
    const normalized = normalizeProductListSearch({
      q: "",
      dept: -1,
      discontinued: "unknown",
      sort: "bad_sort",
      dir: "sideways",
      page: 0,
      perPage: 201,
    });

    expect(normalized).toEqual({
      q: undefined,
      dept: undefined,
      discontinued: "active",
      sort: "product_code",
      dir: "asc",
      page: 1,
      perPage: 50,
    });
    expect(buildProductSearchQuery(normalized).per_page).toBe(50);
  });

  it("UI-01a-D4: filter/sort/perPage changes reset page but page-only changes preserve filters", () => {
    const current = {
      q: "毛糸",
      dept: 2,
      discontinued: "all" as const,
      sort: "name" as const,
      dir: "desc" as const,
      page: 3,
      perPage: 100 as const,
    };

    expect(updateProductListSearch(current, { page: 4 })).toEqual({ ...current, page: 4 });
    expect(updateProductListSearch(current, { q: "布" })).toEqual({
      ...current,
      q: "布",
      page: 1,
    });
    expect(updateProductListSearch(current, { dept: null })).toEqual({
      ...current,
      dept: undefined,
      page: 1,
    });
    expect(updateProductListSearch(current, { perPage: 200 })).toEqual({
      ...current,
      perPage: 200,
      page: 1,
    });
  });
});

describe("feature-owned finite search schemas", () => {
  it.each([
    {
      name: "product discontinued",
      schema: productListSearchSchema,
      key: "discontinued",
      values: PRODUCT_DISCONTINUED_OPTIONS.map(({ value }) => value),
    },
    {
      name: "product sort",
      schema: productListSearchSchema,
      key: "sort",
      values: PRODUCT_SORT_OPTIONS.map(({ value }) => value),
    },
    {
      name: "product direction",
      schema: productListSearchSchema,
      key: "dir",
      values: PRODUCT_SORT_DIRECTION_OPTIONS.map(({ value }) => value),
    },
    {
      name: "product page size",
      schema: productListSearchSchema,
      key: "perPage",
      values: [...PRODUCT_PER_PAGE_OPTIONS],
    },
    {
      name: "movement type",
      schema: stockMovementsSearchSchema,
      key: "type",
      values: MOVEMENT_TYPE_OPTIONS.map(({ value }) => value),
    },
    {
      name: "record type",
      schema: inventoryRecordsSearchSchema,
      key: "recordType",
      values: INVENTORY_RECORD_TYPE_OPTIONS.map(({ value }) => value),
    },
    {
      name: "record status",
      schema: inventoryRecordsSearchSchema,
      key: "status",
      values: INVENTORY_RECORD_STATUS_OPTIONS.map(({ value }) => value),
    },
    {
      name: "daily sort",
      schema: dailySalesSearchSchema,
      key: "sortBy",
      values: DAILY_SORT_DESCRIPTORS.map(({ value }) => value),
    },
    {
      name: "daily direction",
      schema: dailySalesSearchSchema,
      key: "sortDir",
      values: DAILY_SORT_DIRECTION_OPTIONS.map(({ value }) => value),
    },
    {
      name: "monthly mode",
      schema: monthlySalesSearchSchema,
      key: "mode",
      values: MONTHLY_MODE_DESCRIPTORS.map(({ value }) => value),
    },
    {
      name: "monthly sort",
      schema: monthlySalesSearchSchema,
      key: "sortBy",
      values: MONTHLY_SORT_DESCRIPTORS.map(({ value }) => value),
    },
    {
      name: "monthly direction",
      schema: monthlySalesSearchSchema,
      key: "sortDir",
      values: MONTHLY_SORT_DIRECTION_OPTIONS.map(({ value }) => value),
    },
    {
      name: "stock status",
      schema: stockInquirySearchSchema,
      key: "status",
      values: STOCK_FILTER_DESCRIPTORS.map(({ value }) => value),
    },
  ])(
    "$name accepts every owner variant and catches an invalid value",
    ({ schema, key, values }) => {
      for (const value of values) {
        expect(schema.parse({ [key]: value })).toMatchObject({ [key]: value });
      }
      expect(schema.parse({ [key]: "__invalid__" })).toMatchObject({ [key]: undefined });
    },
  );
});

describe("finite search source ownership", () => {
  const repoRoot = process.cwd();
  const source = (path: string) => readFileSync(join(repoRoot, path), "utf8");

  it.each([
    ["src/routes/products/index.tsx", "productListSearchSchema"],
    ["src/routes/stock/$code.movements.tsx", "stockMovementsSearchSchema"],
    ["src/routes/inventory/records.tsx", "inventoryRecordsSearchSchema"],
    ["src/routes/reports/daily.tsx", "dailySalesSearchSchema"],
    ["src/routes/reports/monthly.tsx", "monthlySalesSearchSchema"],
    ["src/routes/stock/index.tsx", "stockInquirySearchSchema"],
  ])("%s imports and wires its feature schema without a local enum", (path, schemaName) => {
    const routeSource = source(path);
    expect(routeSource).toMatch(
      new RegExp(`import\\s*\\{[\\s\\S]*?${schemaName}[\\s\\S]*?\\}\\s*from`),
    );
    expect(routeSource).toContain(`validateSearch: ${schemaName}`);
    expect(routeSource).not.toContain("z.enum(");
  });

  it.each([
    [
      "src/features/products/ProductListPage.tsx",
      "PRODUCT_DISCONTINUED_OPTIONS",
      "const discontinuedOptions",
    ],
    [
      "src/features/stock-movements/StockMovementsPage.tsx",
      "MOVEMENT_TYPE_OPTIONS",
      "const movementTypeOptions",
    ],
    [
      "src/features/inventory-records/InventoryRecordsPage.tsx",
      "INVENTORY_RECORD_TYPE_OPTIONS",
      '<option value="receiving_record"',
    ],
    [
      "src/features/daily-sales/components/ProductTable.tsx",
      "DAILY_SORT_DESCRIPTORS",
      'column="product_code"',
    ],
    [
      "src/features/monthly-sales/components/ModeTabs.tsx",
      "MONTHLY_MODE_DESCRIPTORS",
      "const modeOptions = [",
    ],
    [
      "src/features/monthly-sales/components/ProductRankingTable.tsx",
      "monthlySortDescriptorsForMode",
      'column="quantity"',
    ],
    [
      "src/features/monthly-sales/components/DepartmentTable.tsx",
      "monthlySortDescriptorsForMode",
      'column="amount"',
    ],
    [
      "src/features/stock-inquiry/components/StatusChips.tsx",
      "STOCK_FILTER_DESCRIPTORS",
      "const CHIPS",
    ],
  ])("%s renders choices from the feature owner", (path, ownerName, forbiddenFragment) => {
    const componentSource = source(path);
    expect(componentSource).toContain(ownerName);
    expect(componentSource).not.toContain(forbiddenFragment);
  });
});
