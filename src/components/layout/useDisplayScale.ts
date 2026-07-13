import { useCallback, useEffect, useState } from "react";
import {
  DISPLAY_SCALE_OPTIONS,
  applyDisplayScaleZoom,
  normalizeDisplayScale,
  readDisplayScale,
  writeDisplayScale,
  type DisplayScaleValue,
} from "@/lib/display-scale";

// UI-12: 表示サイズ state。browser-local token を読み、Tauri WebView zoom に反映する。
// DB/settings 画面とは結合しない（UI-11 系へ移管する場合は別 PR）。
export function useDisplayScale() {
  const [displayScale, setDisplayScaleState] = useState<DisplayScaleValue>(() =>
    readDisplayScale(),
  );

  useEffect(() => {
    writeDisplayScale(displayScale);
    void applyDisplayScaleZoom(displayScale);
  }, [displayScale]);

  const setDisplayScale = useCallback((nextValue: string) => {
    setDisplayScaleState(normalizeDisplayScale(nextValue));
  }, []);

  return {
    displayScale,
    setDisplayScale,
    options: DISPLAY_SCALE_OPTIONS,
  };
}
