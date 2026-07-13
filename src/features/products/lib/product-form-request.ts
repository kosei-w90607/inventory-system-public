// src/features/products/lib/product-form-request.ts
//
// UI-01b-D4/D5/D6: form state から generated command payload を作る。

import type {
  Department,
  ProductCreateRequest,
  ProductUpdateRequest_Deserialize,
  ProductWithRelations,
} from "@/lib/bindings";

export type ProductTaxRate = "10" | "8" | "0";
export type ProductStockUnit = "pcs" | "cm";

export interface ProductFormValues {
  janCode: string;
  name: string;
  departmentId: number | null;
  sellingPrice: string;
  costPrice: string;
  taxRate: ProductTaxRate;
  stockUnit: ProductStockUnit;
  initialStock: string;
  makerCode: string;
  supplierId: number | null;
  posStockSync: boolean;
  pluTarget: boolean;
}

export interface ProductFormBuildResult<T> {
  request: T | null;
  errors: Partial<Record<keyof ProductFormValues, string>>;
}

export type ProductUpdatePatch = Partial<ProductUpdateRequest_Deserialize>;

export const createProductFormDefaults: ProductFormValues = {
  janCode: "",
  name: "",
  departmentId: null,
  sellingPrice: "0",
  costPrice: "0",
  taxRate: "10",
  stockUnit: "pcs",
  initialStock: "0",
  makerCode: "",
  supplierId: null,
  posStockSync: true,
  pluTarget: false,
};

function parseNonNegativeInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  return Number(value);
}

function trimToNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function productToFormValues(product: ProductWithRelations): ProductFormValues {
  return {
    janCode: product.jan_code ?? "",
    name: product.name,
    departmentId: product.department_id,
    sellingPrice: String(product.selling_price),
    costPrice: String(product.cost_price),
    taxRate: product.tax_rate === "8" || product.tax_rate === "0" ? product.tax_rate : "10",
    stockUnit: product.stock_unit === "cm" ? "cm" : "pcs",
    initialStock: String(product.stock_quantity),
    makerCode: product.maker_code ?? "",
    supplierId: product.supplier_id,
    posStockSync: product.pos_stock_sync,
    pluTarget: product.plu_target,
  };
}

export function buildCreateProductRequest(
  values: ProductFormValues,
  departments: Department[],
): ProductFormBuildResult<ProductCreateRequest> {
  const errors: ProductFormBuildResult<ProductCreateRequest>["errors"] = {};
  const sellingPrice = parseNonNegativeInteger(values.sellingPrice);
  const costPrice = parseNonNegativeInteger(values.costPrice);
  const initialStock = parseNonNegativeInteger(values.initialStock);
  const selectedDepartment = departments.find(
    (department) => department.id === values.departmentId,
  );
  const janCode = trimToNullable(values.janCode);

  if (values.name.trim() === "") errors.name = "商品名を入力してください";
  if (values.departmentId === null || selectedDepartment === undefined) {
    errors.departmentId = "部門を選択してください";
  }
  if (sellingPrice === null) errors.sellingPrice = "売価は0以上の整数で入力してください";
  if (costPrice === null) errors.costPrice = "原価は0以上の整数で入力してください";
  if (initialStock === null) errors.initialStock = "初期在庫は0以上の整数で入力してください";
  if (janCode === null && selectedDepartment?.code_prefix === null) {
    errors.janCode = "JANコードを入力するか、独自コード発番対象の部門を選択してください";
  }

  if (
    Object.keys(errors).length > 0 ||
    sellingPrice === null ||
    costPrice === null ||
    initialStock === null ||
    values.departmentId === null
  ) {
    return { request: null, errors };
  }
  const departmentId = values.departmentId;

  return {
    request: {
      jan_code: janCode,
      name: values.name.trim(),
      department_id: departmentId,
      selling_price: sellingPrice,
      cost_price: costPrice,
      tax_rate: values.taxRate,
      stock_unit: values.stockUnit,
      initial_stock: initialStock,
      maker_code: trimToNullable(values.makerCode),
      supplier_id: values.supplierId,
      pos_stock_sync: values.posStockSync,
      plu_target: values.pluTarget,
    },
    errors,
  };
}

export function buildUpdateProductRequest(
  values: ProductFormValues,
  original: ProductWithRelations,
): ProductFormBuildResult<ProductUpdatePatch> {
  const errors: ProductFormBuildResult<ProductUpdatePatch>["errors"] = {};
  const sellingPrice = parseNonNegativeInteger(values.sellingPrice);
  const costPrice = parseNonNegativeInteger(values.costPrice);
  const request: ProductUpdatePatch = {};

  if (values.name.trim() === "") errors.name = "商品名を入力してください";
  if (values.departmentId === null) errors.departmentId = "部門を選択してください";
  if (sellingPrice === null) errors.sellingPrice = "売価は0以上の整数で入力してください";
  if (costPrice === null) errors.costPrice = "原価は0以上の整数で入力してください";

  if (Object.keys(errors).length > 0 || sellingPrice === null || costPrice === null) {
    return { request: null, errors };
  }

  if (values.name.trim() !== original.name) request.name = values.name.trim();
  if (values.departmentId !== original.department_id) request.department_id = values.departmentId;
  if (values.supplierId !== original.supplier_id) request.supplier_id = values.supplierId;
  if (sellingPrice !== original.selling_price) request.selling_price = sellingPrice;
  if (costPrice !== original.cost_price) request.cost_price = costPrice;
  if (values.taxRate !== original.tax_rate) request.tax_rate = values.taxRate;

  const makerCode = trimToNullable(values.makerCode);
  if (makerCode !== original.maker_code) request.maker_code = makerCode;
  if (values.posStockSync !== original.pos_stock_sync) {
    request.pos_stock_sync = values.posStockSync;
  }
  if (values.pluTarget !== original.plu_target) {
    request.plu_target = values.pluTarget;
  }

  return { request, errors };
}
