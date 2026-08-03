import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commands } from "@/lib/bindings";
import { ThresholdSettingsPage } from "./ThresholdSettingsPage";

interface TestBlockerOptions {
  shouldBlockFn: () => boolean;
}

const mockUseBlocker = vi.hoisted(() =>
  vi.fn((options: TestBlockerOptions) =>
    options.shouldBlockFn()
      ? { status: "blocked" as const, reset: vi.fn(), proceed: vi.fn() }
      : { status: "idle" as const },
  ),
);

vi.mock("@tanstack/react-router", () => ({ useBlocker: mockUseBlocker }));
vi.mock("@/lib/bindings", () => ({
  commands: { getSettings: vi.fn(), updateSetting: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockGetSettings = vi.mocked(commands.getSettings);
const mockUpdateSetting = vi.mocked(commands.updateSetting);
let blockerStatus: "idle" | "blocked" = "idle";

function shouldBlockCurrentNavigation(): boolean {
  const calls = mockUseBlocker.mock.calls;
  return calls[calls.length - 1][0].shouldBlockFn();
}

beforeEach(() => {
  blockerStatus = "idle";
  mockUseBlocker.mockImplementation(() =>
    blockerStatus === "blocked"
      ? {
          status: "blocked" as const,
          reset: vi.fn(() => {
            blockerStatus = "idle";
          }),
          proceed: vi.fn(),
        }
      : { status: "idle" as const },
  );
  mockGetSettings.mockResolvedValue({
    status: "ok",
    data: [
      { key: "stock_low_threshold", value: "3", updated_at: "2026-08-03T00:00:00" },
      { key: "stock_low_threshold_fabric", value: "500", updated_at: "2026-08-03T00:00:00" },
    ],
  });
  mockUpdateSetting.mockResolvedValue({ status: "ok", data: null });
});

describe("ThresholdSettingsPage unsaved guard (UI-USW-D1/D3 / SPEC-UISN-2/3)", () => {
  it("UI-11a/UI-USW-D1 T14: 既存isDirtyを接続し、保存成功後はpristineへ戻る", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const page = () => (
      <QueryClientProvider client={queryClient}>
        <ThresholdSettingsPage />
      </QueryClientProvider>
    );
    const { rerender } = render(page());

    const input = await screen.findByLabelText("一般商品の基準（必須）");
    expect(shouldBlockCurrentNavigation()).toBe(false);
    await user.clear(input);
    await user.type(input, "5");
    expect(shouldBlockCurrentNavigation()).toBe(true);
    blockerStatus = "blocked";
    rerender(page());
    expect(await screen.findByText("編集内容が保存されていません")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "編集を続ける" }));
    rerender(page());
    await user.click(screen.getByRole("button", { name: "保存する" }));

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByText("編集内容が保存されていません")).not.toBeInTheDocument();
    });
    expect(shouldBlockCurrentNavigation()).toBe(false);
  });
});
