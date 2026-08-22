import { describe, expect, it } from "vitest";

import {
  buildPriceRevisionProductSearchQuery,
  normalizePriceRevisionSearch,
  priceRevisionSearchSchema,
  updatePriceRevisionSearch,
} from "./priceRevisionSearch";

describe("priceRevisionSearch UI-14 / REQ-105", () => {
  it("無効な search 値は既定へ回復する", () => {
    const parsed = priceRevisionSearchSchema.parse({
      q: 42,
      supplier: -1,
      dept: "x",
      discontinued: "maybe",
      sort: "bogus",
      page: 0,
      perPage: 999,
    });

    expect(normalizePriceRevisionSearch(parsed)).toEqual({
      q: undefined,
      supplier: undefined,
      includeUnassigned: false,
      dept: undefined,
      discontinued: false,
      sort: "product_code",
      page: 1,
      perPage: 50,
    });
  });

  it("supplier 指定時は includeUnassigned 欠落を true にし未指定時は落とす", () => {
    expect(normalizePriceRevisionSearch({ supplier: 7 })).toMatchObject({
      supplier: 7,
      includeUnassigned: true,
    });
    expect(normalizePriceRevisionSearch({ includeUnassigned: false })).toMatchObject({
      supplier: undefined,
      includeUnassigned: false,
    });
    expect(buildPriceRevisionProductSearchQuery({ includeUnassigned: true })).toMatchObject({
      supplier_id: null,
      include_unassigned: false,
    });
  });

  it("sort は無効値と欠落で product_code 昇順になる", () => {
    expect(buildPriceRevisionProductSearchQuery({ sort: "bogus" })).toMatchObject({
      sort_key: "ProductCode",
      sort_order: "Asc",
    });
    expect(buildPriceRevisionProductSearchQuery({})).toMatchObject({
      sort_key: "ProductCode",
      sort_order: "Asc",
    });
  });

  it.each([50, 100, 200] as const)("perPage=%i は検索 query にそのまま保持する", (perPage) => {
    expect(buildPriceRevisionProductSearchQuery({ perPage })).toMatchObject({
      per_page: perPage,
    });
  });

  it("filter patch は page を 1 に戻す", () => {
    const current = { q: "毛糸", supplier: 7, includeUnassigned: false, page: 4 };
    expect(updatePriceRevisionSearch(current, { q: "布" })).toEqual({
      ...current,
      q: "布",
      page: 1,
    });
    expect(updatePriceRevisionSearch(current, { page: 3 })).toEqual({ ...current, page: 3 });
  });
});
