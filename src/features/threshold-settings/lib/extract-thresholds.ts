// src/features/threshold-settings/lib/extract-thresholds.ts
//
// UI-11a 閾値設定（在庫少の基準）画面が所有する app_settings 2 key の抽出・付随定数。
// 設計: docs/function-design/69-ui-threshold-settings.md §69.1 / UI-11a-D1 / §69.4 / §69.6

import type { AppSetting } from "@/lib/bindings";

export const STOCK_LOW_THRESHOLD_KEY = "stock_low_threshold";
export const STOCK_LOW_THRESHOLD_FABRIC_KEY = "stock_low_threshold_fabric";

export type ThresholdField = "stockLowThreshold" | "stockLowThresholdFabric";

/** 保存の試行順（UI-11a-D2: 一般商品 → 生地 の固定順で dirty key のみ順次送信） */
export const THRESHOLD_FIELD_ORDER: readonly ThresholdField[] = [
  "stockLowThreshold",
  "stockLowThresholdFabric",
];

export const THRESHOLD_SETTING_KEY_BY_FIELD: Record<ThresholdField, string> = {
  stockLowThreshold: STOCK_LOW_THRESHOLD_KEY,
  stockLowThresholdFabric: STOCK_LOW_THRESHOLD_FABRIC_KEY,
};

/** 部分失敗メッセージ・成功 toast で使う日本語フィールド名（§69.8 / §69.9） */
export const THRESHOLD_FIELD_LABELS: Record<ThresholdField, string> = {
  stockLowThreshold: "一般商品の基準",
  stockLowThresholdFabric: "生地の基準",
};

export interface ThresholdValues {
  stockLowThreshold: string;
  stockLowThresholdFabric: string;
}

function findSettingValue(settings: AppSetting[], key: string): string {
  return settings.find((setting) => setting.key === key)?.value ?? "";
}

/**
 * app_settings 全件から UI-11a が所有する 2 key だけを抽出する純関数（UI-11a-D1）。
 * `backup_*` 等の他 key は無視する。値は raw 文字列のまま返す（数値検証は呼び出し側の責務）。
 */
export function extractThresholds(settings: AppSetting[]): ThresholdValues {
  return {
    stockLowThreshold: findSettingValue(settings, STOCK_LOW_THRESHOLD_KEY),
    stockLowThresholdFabric: findSettingValue(settings, STOCK_LOW_THRESHOLD_FABRIC_KEY),
  };
}

/**
 * 保存済みの値が数値として読み取れるかを判定する（§69.7 既存値が非数値の異常系）。
 * 空文字列・小数・符号付き・非数値文字列はすべて false（DB 直接操作等でしか起こらない想定）。
 */
export function isReadableThresholdValue(raw: string): boolean {
  return /^\d+$/.test(raw.trim());
}
