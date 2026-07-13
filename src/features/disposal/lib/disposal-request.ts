import type { DisposalCreateRequest } from "@/lib/bindings";
import type { DisposalFormErrors, DisposalFormValues, DisposalRow, DisposalType } from "../types";

export interface BuildDisposalRequestResult {
  request: DisposalCreateRequest | null;
  errors: DisposalFormErrors;
  signature: string;
}

const DISPOSAL_TYPES: readonly DisposalType[] = ["disposal", "damage", "other"];

export function createDisposalIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `disposal-${crypto.randomUUID()}`;
  }
  return `disposal-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
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

function normalizeRows(rows: DisposalRow[]) {
  return rows.map((row) => ({
    product_code: row.productCode,
    disposal_type: row.disposalType,
    quantity: row.quantity.trim(),
    cost_price: row.costPrice.trim(),
    reason: row.reason.trim(),
  }));
}

export function buildDisposalSignature(values: DisposalFormValues): string {
  return JSON.stringify({
    disposal_date: values.disposalDate.trim(),
    items: normalizeRows(values.rows),
  });
}

export function calculateLossTotal(rows: DisposalRow[]): number {
  return rows.reduce((total, row) => {
    const quantity = parseRequiredInteger(row.quantity, 1) ?? 0;
    const costPrice = parseRequiredInteger(row.costPrice, 0) ?? 0;
    return total + quantity * costPrice;
  }, 0);
}

export function buildDisposalRequest(
  values: DisposalFormValues,
  idempotencyKey: string,
): BuildDisposalRequestResult {
  const errors: DisposalFormErrors = {};
  const rowErrors: Record<string, string> = {};
  const disposalDate = values.disposalDate.trim();

  if (disposalDate === "") {
    errors.disposalDate = "廃棄日は必須です";
  }
  if (values.rows.length === 0) {
    errors.items = "明細が1件以上必要です";
  }

  const items = values.rows.map((row) => {
    const quantity = parseRequiredInteger(row.quantity, 1);
    const costPrice = parseRequiredInteger(row.costPrice, 0);
    const reason = row.reason.trim();
    const messages = [];
    if (!DISPOSAL_TYPES.includes(row.disposalType)) {
      messages.push("種別を選択してください");
    }
    if (quantity === null) messages.push("数量は1以上の整数で入力してください");
    if (costPrice === null) messages.push("原価は0以上の整数で入力してください");
    if (reason === "") messages.push("理由は必須です");
    if (messages.length > 0) rowErrors[row.rowId] = messages.join(" / ");

    return {
      product_code: row.productCode,
      disposal_type: row.disposalType,
      quantity: quantity ?? 0,
      cost_price: costPrice ?? 0,
      reason,
    };
  });

  if (Object.keys(rowErrors).length > 0) errors.rows = rowErrors;

  const signature = buildDisposalSignature(values);
  if (Object.keys(errors).length > 0) {
    return { request: null, errors, signature };
  }

  return {
    request: {
      idempotency_key: idempotencyKey,
      disposal_date: disposalDate,
      items,
    },
    errors,
    signature,
  };
}
