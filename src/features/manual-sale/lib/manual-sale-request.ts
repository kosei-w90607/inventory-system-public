import type { ManualSaleCreateRequest } from "@/lib/bindings";
import type { ManualSaleFormErrors, ManualSaleFormValues, ManualSaleRow } from "../types";

export interface BuildManualSaleRequestResult {
  request: ManualSaleCreateRequest | null;
  errors: ManualSaleFormErrors;
  signature: string;
}

export function createManualSaleIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `manual-sale-${crypto.randomUUID()}`;
  }
  return `manual-sale-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
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

function normalizeRows(rows: ManualSaleRow[]) {
  return rows.map((row) => ({
    product_code: row.productCode,
    quantity: row.quantity.trim(),
    amount: row.amount.trim(),
  }));
}

export function buildManualSaleSignature(values: ManualSaleFormValues): string {
  return JSON.stringify({
    sale_date: values.saleDate.trim(),
    reason: values.reason,
    note: values.note.trim(),
    items: normalizeRows(values.rows),
  });
}

export function buildManualSaleRequest(
  values: ManualSaleFormValues,
  idempotencyKey: string,
  confirmationToken: string | null,
): BuildManualSaleRequestResult {
  const errors: ManualSaleFormErrors = {};
  const rowErrors: Record<string, string> = {};
  const saleDate = values.saleDate.trim();
  const note = values.note.trim();

  if (saleDate === "") {
    errors.saleDate = "販売日は必須です";
  }
  if (values.rows.length === 0) {
    errors.items = "明細が1件以上必要です";
  }

  const items = values.rows.map((row, index) => {
    const quantity = parseRequiredInteger(row.quantity, 1);
    const amount = parseRequiredInteger(row.amount, 0);
    const messages = [];
    if (quantity === null) messages.push("数量は1以上の整数で入力してください");
    if (amount === null) messages.push("販売金額は0以上の整数で入力してください");
    if (messages.length > 0) rowErrors[row.productCode] = messages.join(" / ");

    return {
      product_code: row.productCode,
      quantity: quantity ?? 0,
      amount: amount ?? 0,
      index,
    };
  });

  if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors;

  const signature = buildManualSaleSignature(values);
  if (Object.keys(errors).length > 0) {
    return { request: null, errors, signature };
  }

  return {
    request: {
      idempotency_key: idempotencyKey,
      sale_date: saleDate,
      reason: values.reason,
      note: note === "" ? null : note,
      items: items.map(({ product_code, quantity, amount }) => ({
        product_code,
        quantity,
        amount,
      })),
      confirmation_token: confirmationToken,
    },
    errors,
    signature,
  };
}
