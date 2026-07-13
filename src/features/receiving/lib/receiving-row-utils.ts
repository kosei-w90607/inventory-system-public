import type { ProductWithRelations } from "@/lib/bindings";
import type { ReceivingRow } from "../types";

function nextQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? String(parsed + 1) : "1";
}

export function productToReceivingRow(product: ProductWithRelations): ReceivingRow {
  return {
    productCode: product.product_code,
    productName: product.name,
    stockUnit: product.stock_unit,
    quantity: "1",
    costPrice: String(product.cost_price),
  };
}

export function addProductToRows(
  rows: ReceivingRow[],
  product: ProductWithRelations,
): ReceivingRow[] {
  const existingIndex = rows.findIndex((row) => row.productCode === product.product_code);
  if (existingIndex === -1) return [...rows, productToReceivingRow(product)];

  return rows.map((row, index) =>
    index === existingIndex ? { ...row, quantity: nextQuantity(row.quantity) } : row,
  );
}

export function updateReceivingRow(
  rows: ReceivingRow[],
  productCode: string,
  patch: Partial<Pick<ReceivingRow, "quantity" | "costPrice">>,
): ReceivingRow[] {
  return rows.map((row) => (row.productCode === productCode ? { ...row, ...patch } : row));
}

export function removeReceivingRow(rows: ReceivingRow[], productCode: string): ReceivingRow[] {
  return rows.filter((row) => row.productCode !== productCode);
}
