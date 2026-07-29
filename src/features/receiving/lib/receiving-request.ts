import type { ReceivingCreateRequest } from "@/lib/bindings";
import { createPrefixedIdempotencyKey, parseRequiredSafeInteger } from "@/lib/request-helpers";
import type { ReceivingFormErrors, ReceivingFormValues, ReceivingRow } from "../types";

export { getLocalDateString } from "@/lib/request-helpers";

export interface BuildReceivingRequestResult {
  request: ReceivingCreateRequest | null;
  errors: ReceivingFormErrors;
  signature: string;
}

export function createReceivingIdempotencyKey(): string {
  return createPrefixedIdempotencyKey("receiving");
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
    const quantity = parseRequiredSafeInteger(row.quantity, 1);
    const costPrice = parseRequiredSafeInteger(row.costPrice, 0);
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
