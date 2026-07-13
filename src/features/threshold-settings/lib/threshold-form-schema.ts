// src/features/threshold-settings/lib/threshold-form-schema.ts
//
// UI-11a 入力検証（整数 1〜99999、69 §69.7 / UI-11a-D3）。zod 4 の superRefine で
// 「空欄 → 整数以外 → 1未満 → 99999超」の優先順に単一メッセージだけを出す。

import { z } from "zod";

import type { ThresholdField } from "./extract-thresholds";

export const THRESHOLD_ERROR_MESSAGES = {
  required: "入力してください",
  integer: "1以上の整数を入力してください",
  max: "99999以下で入力してください",
} as const;

const thresholdFieldSchema = z.string().superRefine((value, ctx) => {
  const trimmed = value.trim();
  if (trimmed === "") {
    ctx.addIssue({ code: "custom", message: THRESHOLD_ERROR_MESSAGES.required });
    return;
  }
  if (!/^\d+$/.test(trimmed)) {
    ctx.addIssue({ code: "custom", message: THRESHOLD_ERROR_MESSAGES.integer });
    return;
  }
  const numeric = Number(trimmed);
  if (numeric < 1) {
    ctx.addIssue({ code: "custom", message: THRESHOLD_ERROR_MESSAGES.integer });
    return;
  }
  if (numeric > 99999) {
    ctx.addIssue({ code: "custom", message: THRESHOLD_ERROR_MESSAGES.max });
  }
});

export const thresholdSettingsSchema = z.object({
  stockLowThreshold: thresholdFieldSchema,
  stockLowThresholdFabric: thresholdFieldSchema,
});

export type ThresholdFormValues = z.infer<typeof thresholdSettingsSchema>;

/** zod issue.path[0] から ThresholdField へ絞り込む（本 schema の 2 key 以外は現れない） */
export function isThresholdField(value: unknown): value is ThresholdField {
  return value === "stockLowThreshold" || value === "stockLowThresholdFabric";
}
