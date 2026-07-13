import type { ProductWithRelations } from "@/lib/bindings";
import type { ManualSaleRow } from "../types";

function nextQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? String(parsed + 1) : "1";
}

function nextAmount(currentAmount: string, unitPrice: number): string {
  const parsed = Number(currentAmount);
  const base = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  return String(base + unitPrice);
}

export function productToManualSaleRow(product: ProductWithRelations): ManualSaleRow {
  return {
    productCode: product.product_code,
    productName: product.name,
    departmentName: product.department_name,
    stockUnit: product.stock_unit,
    currentStockQuantity: product.stock_quantity,
    unitPrice: product.selling_price,
    quantity: "1",
    amount: String(product.selling_price),
  };
}

export function addProductToManualSaleRows(
  rows: ManualSaleRow[],
  product: ProductWithRelations,
): ManualSaleRow[] {
  const existingIndex = rows.findIndex((row) => row.productCode === product.product_code);
  if (existingIndex === -1) return [...rows, productToManualSaleRow(product)];

  return rows.map((row, index) =>
    index === existingIndex
      ? {
          ...row,
          quantity: nextQuantity(row.quantity),
          amount: nextAmount(row.amount, product.selling_price),
        }
      : row,
  );
}

export function updateManualSaleRow(
  rows: ManualSaleRow[],
  productCode: string,
  patch: Partial<Pick<ManualSaleRow, "quantity" | "amount">>,
): ManualSaleRow[] {
  return rows.map((row) => (row.productCode === productCode ? { ...row, ...patch } : row));
}

export function removeManualSaleRow(rows: ManualSaleRow[], productCode: string): ManualSaleRow[] {
  return rows.filter((row) => row.productCode !== productCode);
}
