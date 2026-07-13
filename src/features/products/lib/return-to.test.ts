// src/features/products/lib/return-to.test.ts

import { describe, expect, it } from "vitest";

import {
  buildProductListReturnTo,
  parseProductListSearchFromReturnTo,
  sanitizeProductListReturnTo,
} from "./return-to";

describe("sanitizeProductListReturnTo (UI-01b-D2)", () => {
  it("allows only product list route with search params", () => {
    expect(sanitizeProductListReturnTo("/products?q=布&page=2")).toBe(
      "/products?q=%E5%B8%83&page=2",
    );
    expect(sanitizeProductListReturnTo("/products/")).toBe("/products");
  });

  it("rejects product form/import, external URL, and unrelated routes", () => {
    expect(sanitizeProductListReturnTo("/products/new")).toBe("/products");
    expect(sanitizeProductListReturnTo("/products/ABC/edit")).toBe("/products");
    expect(sanitizeProductListReturnTo("/products/import")).toBe("/products");
    expect(sanitizeProductListReturnTo("https://example.com/products?q=布")).toBe("/products");
    expect(sanitizeProductListReturnTo("/reports/daily")).toBe("/products");
  });

  it("round-trips product list search params for navigation", () => {
    const returnTo = buildProductListReturnTo({
      q: "はさみ",
      dept: 2,
      discontinued: "all",
      sort: "selling_price",
      dir: "desc",
      page: 3,
      perPage: 100,
    });

    expect(returnTo).toBe(
      "/products?q=%E3%81%AF%E3%81%95%E3%81%BF&dept=2&discontinued=all&sort=selling_price&dir=desc&page=3&perPage=100",
    );
    expect(parseProductListSearchFromReturnTo(returnTo)).toEqual({
      q: "はさみ",
      dept: 2,
      discontinued: "all",
      sort: "selling_price",
      dir: "desc",
      page: 3,
      perPage: 100,
    });
  });
});
