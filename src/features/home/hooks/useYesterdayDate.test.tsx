// UI-00 / UI-00-D11: local date + Visibility API lifecycle contract。

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useYesterdayDate } from "./useYesterdayDate";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 29, 0, 5));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useYesterdayDate UI-00 visibility lifecycle", () => {
  it("updates only after a visible day rollover and removes its listener on unmount", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const addListener = vi.spyOn(document, "addEventListener");
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { result, unmount } = renderHook(() => useYesterdayDate());
    const registeredHandler = addListener.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1];

    expect(result.current).toBe("2026-07-28");
    expect(registeredHandler).toEqual(expect.any(Function));

    vi.setSystemTime(new Date(2026, 6, 30, 0, 5));
    visibility.mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-07-28");

    visibility.mockReturnValue("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current).toBe("2026-07-29");

    unmount();
    const removedHandler = removeListener.mock.calls.find(
      ([type]) => type === "visibilitychange",
    )?.[1];
    expect(removedHandler).toBe(registeredHandler);
  });
});
