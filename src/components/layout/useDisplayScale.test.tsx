// src/components/layout/useDisplayScale.test.tsx
//
// UI-12: 表示サイズ option は browser-local token を保持し、Tauri WebView zoom へ反映する。
// 設計: docs/plans/2026-06-07-display-scale-readability.md

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DISPLAY_SCALE_STORAGE_KEY } from "@/lib/display-scale";
import { useDisplayScale } from "./useDisplayScale";

const tauriMocks = vi.hoisted(() => ({
  setZoom: vi.fn<() => Promise<void>>(),
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    setZoom: tauriMocks.setZoom,
  }),
}));

function installMemoryStorage() {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return entries.size;
    },
    clear: () => {
      entries.clear();
    },
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
  Object.defineProperty(window, "localStorage", {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  return storage;
}

describe("useDisplayScale (UI-12 表示サイズ)", () => {
  beforeEach(() => {
    installMemoryStorage();
    tauriMocks.setZoom.mockReset();
    tauriMocks.setZoom.mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("UI-12: invalid stored display scale falls back to standard and applies 1x zoom", async () => {
    localStorage.setItem(DISPLAY_SCALE_STORAGE_KEY, "huge");

    const { result } = renderHook(() => useDisplayScale());

    expect(result.current.displayScale).toBe("standard");
    await waitFor(() => {
      expect(localStorage.getItem(DISPLAY_SCALE_STORAGE_KEY)).toBe("standard");
      expect(tauriMocks.setZoom).toHaveBeenCalledWith(1);
    });
  });

  it("UI-12: changing display scale persists the token and applies matching WebView zoom", async () => {
    const { result } = renderHook(() => useDisplayScale());

    act(() => {
      result.current.setDisplayScale("large");
    });

    expect(result.current.displayScale).toBe("large");
    await waitFor(() => {
      expect(localStorage.getItem(DISPLAY_SCALE_STORAGE_KEY)).toBe("large");
      expect(tauriMocks.setZoom).toHaveBeenLastCalledWith(1.15);
    });
  });

  it("UI-12: WebView zoom failure is non-fatal", async () => {
    tauriMocks.setZoom.mockRejectedValueOnce(new Error("permission denied"));
    const { result } = renderHook(() => useDisplayScale());

    expect(result.current.displayScale).toBe("standard");
    await waitFor(() => {
      expect(tauriMocks.setZoom).toHaveBeenCalledWith(1);
      expect(console.warn).toHaveBeenCalledWith("Tauri webview.setZoom failed:", expect.any(Error));
    });
  });

  it("UI-12: localStorage getter failure falls back to standard and is non-fatal", async () => {
    Object.defineProperty(window, "localStorage", {
      get: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      configurable: true,
    });

    const { result } = renderHook(() => useDisplayScale());

    expect(result.current.displayScale).toBe("standard");
    await waitFor(() => {
      expect(tauriMocks.setZoom).toHaveBeenCalledWith(1);
      expect(console.warn).toHaveBeenCalledWith(
        "Display scale storage read failed:",
        expect.any(DOMException),
      );
      expect(console.warn).toHaveBeenCalledWith(
        "Display scale storage write failed:",
        expect.any(DOMException),
      );
    });
  });
});
