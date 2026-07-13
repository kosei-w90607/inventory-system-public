import type { ProductWithRelations } from "@/lib/bindings";
import type { DisposalRow } from "../types";

function makeDisposalKey(productCode: string, disposalType: string, reason: string): string {
  return `${productCode}::${disposalType}::${reason.trim()}`;
}

function getDisposalKey(row: DisposalRow): string {
  return makeDisposalKey(row.productCode, row.disposalType, row.reason);
}

function makeUniqueRowId(rows: DisposalRow[], baseId: string): string {
  let candidate = baseId;
  let suffix = 2;
  while (rows.some((row) => row.rowId === candidate)) {
    candidate = `${baseId}::${String(suffix)}`;
    suffix += 1;
  }
  return candidate;
}

function nextQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? String(parsed + 1) : "1";
}

function mergeQuantity(base: string, addition: string): string {
  const baseQuantity = Number(base);
  const additionalQuantity = Number(addition);
  if (
    Number.isInteger(baseQuantity) &&
    baseQuantity >= 1 &&
    Number.isInteger(additionalQuantity) &&
    additionalQuantity >= 1
  ) {
    return String(baseQuantity + additionalQuantity);
  }
  return base;
}

export function productToDisposalRow(product: ProductWithRelations): DisposalRow {
  const reason = "破損";
  return {
    rowId: makeDisposalKey(product.product_code, "damage", reason),
    productCode: product.product_code,
    productName: product.name,
    departmentName: product.department_name,
    stockUnit: product.stock_unit,
    currentStockQuantity: product.stock_quantity,
    defaultCostPrice: product.cost_price,
    disposalType: "damage",
    quantity: "1",
    costPrice: String(product.cost_price),
    reason,
  };
}

export function addProductToDisposalRows(
  rows: DisposalRow[],
  product: ProductWithRelations,
): DisposalRow[] {
  const nextRow = productToDisposalRow(product);
  const existingIndex = rows.findIndex((row) => getDisposalKey(row) === getDisposalKey(nextRow));
  if (existingIndex === -1) {
    return [...rows, { ...nextRow, rowId: makeUniqueRowId(rows, nextRow.rowId) }];
  }

  return rows.map((row, index) =>
    index === existingIndex ? { ...row, quantity: nextQuantity(row.quantity) } : row,
  );
}

export function updateDisposalRow(
  rows: DisposalRow[],
  rowId: string,
  patch: Partial<Pick<DisposalRow, "disposalType" | "quantity" | "costPrice" | "reason">>,
): DisposalRow[] {
  const target = rows.find((row) => row.rowId === rowId);
  if (target === undefined) return rows;

  const nextRow = { ...target, ...patch };
  const existingIndex = rows.findIndex(
    (row) => getDisposalKey(row) === getDisposalKey(nextRow) && row.rowId !== rowId,
  );

  if (existingIndex === -1) {
    return rows.map((row) => (row.rowId === rowId ? nextRow : row));
  }

  return rows
    .filter((row) => row.rowId !== rowId)
    .map((row) =>
      getDisposalKey(row) === getDisposalKey(nextRow)
        ? { ...row, quantity: mergeQuantity(row.quantity, nextRow.quantity) }
        : row,
    );
}

export function removeDisposalRow(rows: DisposalRow[], rowId: string): DisposalRow[] {
  return rows.filter((row) => row.rowId !== rowId);
}
