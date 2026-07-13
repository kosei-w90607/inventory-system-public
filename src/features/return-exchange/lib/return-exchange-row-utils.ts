import type { ProductWithRelations } from "@/lib/bindings";
import type { ReturnDirection, ReturnExchangeRow } from "../types";

function nextQuantity(value: string): string {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? String(parsed + 1) : "1";
}

function sumQuantities(left: string, right: string): string {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (
    Number.isInteger(leftNumber) &&
    Number.isInteger(rightNumber) &&
    leftNumber >= 1 &&
    rightNumber >= 1
  ) {
    return String(leftNumber + rightNumber);
  }
  return "1";
}

export function productToReturnRow(
  product: ProductWithRelations,
  direction: ReturnDirection,
): ReturnExchangeRow {
  return {
    productCode: product.product_code,
    productName: product.name,
    departmentName: product.department_name,
    stockUnit: product.stock_unit,
    currentStockQuantity: product.stock_quantity,
    direction,
    quantity: "1",
  };
}

export function addProductToReturnRows(
  rows: ReturnExchangeRow[],
  product: ProductWithRelations,
  direction: ReturnDirection,
): ReturnExchangeRow[] {
  const existingIndex = rows.findIndex(
    (row) => row.productCode === product.product_code && row.direction === direction,
  );
  if (existingIndex === -1) return [...rows, productToReturnRow(product, direction)];

  return rows.map((row, index) =>
    index === existingIndex ? { ...row, quantity: nextQuantity(row.quantity) } : row,
  );
}

export function updateReturnRow(
  rows: ReturnExchangeRow[],
  productCode: string,
  direction: ReturnDirection,
  patch: Partial<Pick<ReturnExchangeRow, "quantity" | "direction">>,
): ReturnExchangeRow[] {
  return rows.map((row) =>
    row.productCode === productCode && row.direction === direction ? { ...row, ...patch } : row,
  );
}

export function changeReturnRowDirection(
  rows: ReturnExchangeRow[],
  productCode: string,
  fromDirection: ReturnDirection,
  toDirection: ReturnDirection,
): ReturnExchangeRow[] {
  if (fromDirection === toDirection) return rows;

  const sourceRow = rows.find(
    (row) => row.productCode === productCode && row.direction === fromDirection,
  );
  if (sourceRow === undefined) return rows;

  const targetRow = rows.find(
    (row) => row.productCode === productCode && row.direction === toDirection,
  );
  if (targetRow === undefined) {
    return rows.map((row) =>
      row.productCode === productCode && row.direction === fromDirection
        ? { ...row, direction: toDirection }
        : row,
    );
  }

  return rows
    .map((row) =>
      row.productCode === productCode && row.direction === toDirection
        ? { ...row, quantity: sumQuantities(row.quantity, sourceRow.quantity) }
        : row,
    )
    .filter((row) => row.productCode !== productCode || row.direction !== fromDirection);
}

export function removeReturnRow(
  rows: ReturnExchangeRow[],
  productCode: string,
  direction: ReturnDirection,
): ReturnExchangeRow[] {
  return rows.filter((row) => row.productCode !== productCode || row.direction !== direction);
}
