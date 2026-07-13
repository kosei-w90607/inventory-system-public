// src/features/products/lib/product-form-request.test.ts

import { describe, expect, it } from "vitest";

import { makeMockDepartment, makeMockProductWithRelations } from "./test-fixtures";
import {
  buildCreateProductRequest,
  buildUpdateProductRequest,
  createProductFormDefaults,
  productToFormValues,
  type ProductFormValues,
} from "./product-form-request";

const prefixDepartment = makeMockDepartment({ id: 1, name: "毛糸", code_prefix: "Y" });
const noPrefixDepartment = makeMockDepartment({ id: 2, name: "通常部門", code_prefix: null });

function validValues(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return {
    ...createProductFormDefaults,
    janCode: "4901234567890",
    name: "テスト商品",
    departmentId: 1,
    sellingPrice: "500",
    costPrice: "300",
    initialStock: "10",
    ...overrides,
  };
}

describe("buildCreateProductRequest (UI-01b-D4/D6)", () => {
  it("builds JAN product request", () => {
    const result = buildCreateProductRequest(validValues(), [prefixDepartment]);

    expect(result.errors).toEqual({});
    expect(result.request).toMatchObject({
      jan_code: "4901234567890",
      department_id: 1,
      stock_unit: "pcs",
      initial_stock: 10,
      pos_stock_sync: true,
      plu_target: false,
    });
  });

  it("allows JAN blank only when selected department has code_prefix", () => {
    expect(
      buildCreateProductRequest(validValues({ janCode: "", departmentId: 1 }), [
        prefixDepartment,
        noPrefixDepartment,
      ]).request,
    ).toMatchObject({ jan_code: null });

    const result = buildCreateProductRequest(validValues({ janCode: "", departmentId: 2 }), [
      prefixDepartment,
      noPrefixDepartment,
    ]);
    expect(result.request).toBeNull();
    expect(result.errors.janCode).toContain("独自コード発番対象");
  });

  it("preserves cm POS sync override in payload", () => {
    const result = buildCreateProductRequest(validValues({ stockUnit: "cm", posStockSync: true }), [
      prefixDepartment,
    ]);

    expect(result.request).toMatchObject({ stock_unit: "cm", pos_stock_sync: true });
  });

  it("REQ-402 sends PLU target in create payload", () => {
    const result = buildCreateProductRequest(validValues({ pluTarget: true }), [prefixDepartment]);

    expect(result.request).toMatchObject({ plu_target: true });
  });
});

describe("buildUpdateProductRequest (UI-01b-D5)", () => {
  it("sends only supported changed fields and never sends read-only fields", () => {
    const original = makeMockProductWithRelations({
      product_code: "P-001",
      jan_code: "4901234567890",
      stock_quantity: 20,
      stock_unit: "cm",
      supplier_id: 3,
      maker_code: "A-1",
    });
    const values = {
      ...productToFormValues(original),
      name: "更新後商品",
      supplierId: null,
      makerCode: "",
      initialStock: "999",
      stockUnit: "pcs" as const,
      janCode: "DIFFERENT",
    };

    const result = buildUpdateProductRequest(values, original);

    expect(result.request).toEqual({
      name: "更新後商品",
      supplier_id: null,
      maker_code: null,
    });
    expect(result.request).not.toHaveProperty("product_code");
    expect(result.request).not.toHaveProperty("jan_code");
    expect(result.request).not.toHaveProperty("stock_quantity");
    expect(result.request).not.toHaveProperty("stock_unit");
  });

  it("REQ-402 sends PLU target only when changed", () => {
    const original = makeMockProductWithRelations({ plu_target: false });

    expect(buildUpdateProductRequest(productToFormValues(original), original).request).toEqual({});
    expect(
      buildUpdateProductRequest({ ...productToFormValues(original), pluTarget: true }, original)
        .request,
    ).toEqual({ plu_target: true });
  });
});
