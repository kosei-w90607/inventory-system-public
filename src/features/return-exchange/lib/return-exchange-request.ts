import type { ReturnCreateRequest } from "@/lib/bindings";
import type {
  ReturnExchangeFormErrors,
  ReturnExchangeFormValues,
  ReturnExchangeRow,
} from "../types";

export interface BuildReturnExchangeRequestResult {
  request: ReturnCreateRequest | null;
  errors: ReturnExchangeFormErrors;
  signature: string;
}

export interface ReceiptPathInput {
  receiptImagePath: string | null;
}

export function createReturnExchangeIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `return-${crypto.randomUUID()}`;
  }
  return `return-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${String(year)}-${month}-${day}`;
}

function parseRequiredInteger(value: string, min: number): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= min ? parsed : null;
}

function rowKey(row: Pick<ReturnExchangeRow, "productCode" | "direction">): string {
  return `${row.productCode}:${row.direction}`;
}

function normalizeRows(rows: ReturnExchangeRow[]) {
  return rows.map((row) => ({
    product_code: row.productCode,
    direction: row.direction,
    quantity: row.quantity.trim(),
  }));
}

export function buildReturnExchangeSignature(
  values: ReturnExchangeFormValues,
  receiptImagePath: string | null,
): string {
  return JSON.stringify({
    return_date: values.returnDate.trim(),
    return_type: values.returnType,
    register_processed: values.registerProcessed,
    receipt_image_path: receiptImagePath,
    note: values.note.trim(),
    items: normalizeRows(values.rows),
  });
}

export function buildReturnExchangeRequest(
  values: ReturnExchangeFormValues,
  idempotencyKey: string,
  receipt: ReceiptPathInput,
): BuildReturnExchangeRequestResult {
  const errors: ReturnExchangeFormErrors = {};
  const rowErrors: Record<string, string> = {};
  const returnDate = values.returnDate.trim();
  const note = values.note.trim();

  if (returnDate === "") errors.returnDate = "返品日は必須です";
  if (values.rows.length === 0) errors.items = "明細が1件以上必要です";

  const hasIn = values.rows.some((row) => row.direction === "in");
  const hasOut = values.rows.some((row) => row.direction === "out");
  if (values.returnType === "return" && hasOut) {
    errors.items = "返品では渡し明細を指定できません";
  }
  if (values.returnType === "exchange" && (!hasIn || !hasOut)) {
    errors.items = "交換では戻り明細と渡し明細がそれぞれ必要です";
  }

  const items = values.rows.map((row) => {
    const quantity = parseRequiredInteger(row.quantity, 1);
    if (quantity === null) rowErrors[rowKey(row)] = "数量は1以上の整数で入力してください";
    return {
      product_code: row.productCode,
      direction: row.direction,
      quantity: quantity ?? 0,
    };
  });

  if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors;

  const signature = buildReturnExchangeSignature(values, receipt.receiptImagePath);
  if (Object.keys(errors).length > 0) {
    return { request: null, errors, signature };
  }

  return {
    request: {
      idempotency_key: idempotencyKey,
      return_type: values.returnType,
      return_date: returnDate,
      register_processed: values.registerProcessed,
      receipt_image_path: receipt.receiptImagePath,
      note: note === "" ? null : note,
      items,
    },
    errors,
    signature,
  };
}
