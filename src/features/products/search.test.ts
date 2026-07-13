// src/features/products/search.test.ts
//
// UI-01a-D1〜D4/D7: URL search params -> ProductSearchQuery mapping と page reset/preserve。

import { describe, expect, it } from "vitest";

import {
  buildProductSearchQuery,
  normalizeProductListSearch,
  updateProductListSearch,
} from "./search";

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
