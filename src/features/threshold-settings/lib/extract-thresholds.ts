// src/features/threshold-settings/lib/extract-thresholds.ts
//
// UI-11a 閾値設定（在庫少の基準）画面が所有する app_settings 2 key の抽出・付随定数。
// 設計: docs/function-design/69-ui-threshold-settings.md §69.1 / UI-11a-D1 / §69.4 / §69.6

import type { AppSetting } from "@/lib/bindings";
import { z } from "zod";

export const THRESHOLD_ERROR_MESSAGES = {
  required: "入力してください",
  integer: "1以上の整数を入力してください",
  max: "99999以下で入力してください",
} as const;

const thresholdValueSchema = z.string().superRefine((value, ctx) => {
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

export const THRESHOLD_FIELD_DESCRIPTORS = [
  {
    field: "stockLowThreshold",
    settingKey: "stock_low_threshold",
    label: "一般商品の基準",
    requiredLabel: "一般商品の基準（必須）",
    inputId: "stock-low-threshold",
    unit: "個",
    description: "在庫がこの個数以下になったら在庫少（初期値: 3個）",
    schema: thresholdValueSchema,
  },
  {
    field: "stockLowThresholdFabric",
    settingKey: "stock_low_threshold_fabric",
    label: "生地の基準",
    requiredLabel: "生地の基準（必須）",
    inputId: "stock-low-threshold-fabric",
    unit: "cm",
    description: "在庫がこの長さ以下になったら在庫少（初期値: 500cm = 5m）",
    schema: thresholdValueSchema,
  },
] as const;

export type ThresholdField = (typeof THRESHOLD_FIELD_DESCRIPTORS)[number]["field"];

/** 部分失敗メッセージ・成功 toast で使う日本語フィールド名（§69.8 / §69.9） */
export const THRESHOLD_FIELD_LABELS = Object.fromEntries(
  THRESHOLD_FIELD_DESCRIPTORS.map(({ field, label }) => [field, label]),
) as Record<ThresholdField, string>;

export type ThresholdValues = Record<ThresholdField, string>;

function findSettingValue(settings: AppSetting[], key: string): string {
  return settings.find((setting) => setting.key === key)?.value ?? "";
}

/**
 * app_settings 全件から UI-11a が所有する 2 key だけを抽出する純関数（UI-11a-D1）。
 * `backup_*` 等の他 key は無視する。値は raw 文字列のまま返す（数値検証は呼び出し側の責務）。
 */
export function extractThresholds(settings: AppSetting[]): ThresholdValues {
  return Object.fromEntries(
    THRESHOLD_FIELD_DESCRIPTORS.map(({ field, settingKey }) => [
      field,
      findSettingValue(settings, settingKey),
    ]),
  ) as ThresholdValues;
}

/**
 * 保存済みの値が数値として読み取れるかを判定する（§69.7 既存値が非数値の異常系）。
 * 空文字列・小数・符号付き・非数値文字列はすべて false（DB 直接操作等でしか起こらない想定）。
 */
export function isReadableThresholdValue(raw: string): boolean {
  return /^\d+$/.test(raw.trim());
}
