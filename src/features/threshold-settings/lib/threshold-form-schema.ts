// src/features/threshold-settings/lib/threshold-form-schema.ts
//
// UI-11a 入力検証（整数 1〜99999、69 §69.7 / UI-11a-D3）。zod 4 の superRefine で
// 「空欄 → 整数以外 → 1未満 → 99999超」の優先順に単一メッセージだけを出す。

import { z } from "zod";

import {
  THRESHOLD_ERROR_MESSAGES,
  THRESHOLD_FIELD_DESCRIPTORS,
  type ThresholdField,
} from "./extract-thresholds";

export { THRESHOLD_ERROR_MESSAGES };

const thresholdSettingsShape = Object.fromEntries(
  THRESHOLD_FIELD_DESCRIPTORS.map(({ field, schema }) => [field, schema]),
) as Record<ThresholdField, (typeof THRESHOLD_FIELD_DESCRIPTORS)[number]["schema"]>;

export const thresholdSettingsSchema = z.object(thresholdSettingsShape);

export type ThresholdFormValues = z.infer<typeof thresholdSettingsSchema>;

/** zod issue.path[0] から ThresholdField へ絞り込む（本 schema の 2 key 以外は現れない） */
export function isThresholdField(value: unknown): value is ThresholdField {
  return THRESHOLD_FIELD_DESCRIPTORS.some(({ field }) => field === value);
}
