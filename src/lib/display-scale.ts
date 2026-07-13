import { getCurrentWebview } from "@tauri-apps/api/webview";

export const DISPLAY_SCALE_STORAGE_KEY = "inventory.displayScale.v1";

export const DISPLAY_SCALE_OPTIONS = [
  { value: "standard", label: "標準", scaleFactor: 1 },
  { value: "large", label: "大きめ", scaleFactor: 1.15 },
  { value: "extra_large", label: "特大", scaleFactor: 1.3 },
] as const;

export type DisplayScaleValue = (typeof DISPLAY_SCALE_OPTIONS)[number]["value"];

export const DEFAULT_DISPLAY_SCALE: DisplayScaleValue = "standard";

export function isDisplayScaleValue(value: unknown): value is DisplayScaleValue {
  return (
    typeof value === "string" && DISPLAY_SCALE_OPTIONS.some((option) => option.value === value)
  );
}

export function normalizeDisplayScale(value: unknown): DisplayScaleValue {
  return isDisplayScaleValue(value) ? value : DEFAULT_DISPLAY_SCALE;
}

export function getDisplayScaleOption(value: DisplayScaleValue) {
  return DISPLAY_SCALE_OPTIONS.find((option) => option.value === value) ?? DISPLAY_SCALE_OPTIONS[0];
}

export function readDisplayScale(storage?: Storage): DisplayScaleValue {
  try {
    const targetStorage = storage ?? window.localStorage;
    return normalizeDisplayScale(targetStorage.getItem(DISPLAY_SCALE_STORAGE_KEY));
  } catch (e: unknown) {
    console.warn("Display scale storage read failed:", e);
    return DEFAULT_DISPLAY_SCALE;
  }
}

export function writeDisplayScale(value: DisplayScaleValue, storage?: Storage): void {
  try {
    const targetStorage = storage ?? window.localStorage;
    targetStorage.setItem(DISPLAY_SCALE_STORAGE_KEY, value);
  } catch (e: unknown) {
    console.warn("Display scale storage write failed:", e);
  }
}

export async function applyDisplayScaleZoom(value: DisplayScaleValue): Promise<void> {
  const { scaleFactor } = getDisplayScaleOption(value);
  try {
    await getCurrentWebview().setZoom(scaleFactor);
  } catch (e: unknown) {
    console.warn("Tauri webview.setZoom failed:", e);
  }
}
