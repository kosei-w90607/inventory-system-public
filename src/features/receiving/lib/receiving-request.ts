import type { ReceivingCreateRequest } from "@/lib/bindings";
import type { ReceivingFormErrors, ReceivingFormValues, ReceivingRow } from "../types";

export interface BuildReceivingRequestResult {
  request: ReceivingCreateRequest | null;
  errors: ReceivingFormErrors;
  signature: string;
}

export function createReceivingIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `receiving-${crypto.randomUUID()}`;
  }
  return `receiving-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
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

function normalizeRows(rows: ReceivingRow[]) {
  return rows.map((row) => ({
    product_code: row.productCode,
    quantity: row.quantity.trim(),
    cost_price: row.costPrice.trim(),
  }));
}

export function buildReceivingSignature(values: ReceivingFormValues): string {
  return JSON.stringify({
    supplier_id: values.supplierId,
    receiving_date: values.receivingDate.trim(),
    note: values.note.trim(),
    items: normalizeRows(values.rows),
  });
}

export function buildReceivingRequest(
  values: ReceivingFormValues,
  idempotencyKey: string,
): BuildReceivingRequestResult {
  const errors: ReceivingFormErrors = {};
  const rowErrors: Record<string, string> = {};
  const receivingDate = values.receivingDate.trim();
  const note = values.note.trim();

  if (receivingDate === "") {
    errors.receivingDate = "入庫日は必須です";
  }
  if (values.rows.length === 0) {
    errors.items = "明細が1件以上必要です";
  }

  const items = values.rows.map((row, index) => {
    const quantity = parseRequiredInteger(row.quantity, 1);
    const costPrice = parseRequiredInteger(row.costPrice, 0);
    const messages = [];
    if (quantity === null) messages.push("数量は1以上の整数で入力してください");
    if (costPrice === null) messages.push("原価は0以上の整数で入力してください");
    if (messages.length > 0) rowErrors[row.productCode] = messages.join(" / ");

    return {
      product_code: row.productCode,
      quantity: quantity ?? 0,
      cost_price: costPrice ?? 0,
      index,
    };
  });

  if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors;

  const signature = buildReceivingSignature(values);
  if (Object.keys(errors).length > 0) {
    return { request: null, errors, signature };
  }

  return {
    request: {
      idempotency_key: idempotencyKey,
      supplier_id: values.supplierId,
      receiving_date: receivingDate,
      note: note === "" ? null : note,
      items: items.map(({ product_code, quantity, cost_price }) => ({
        product_code,
        quantity,
        cost_price,
      })),
    },
    errors,
    signature,
  };
}
