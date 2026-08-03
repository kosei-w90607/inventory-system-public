import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnsavedChangesDialog } from "@/components/patterns/UnsavedChangesDialog";
import { useUnsavedChangesWarning } from "./useUnsavedChangesWarning";

interface TestBlockerOptions {
  shouldBlockFn: (args: unknown) => boolean;
  withResolver: boolean;
  enableBeforeUnload: boolean | (() => boolean);
}

interface TestBlockerResolver {
  status: "idle" | "blocked";
  current?: unknown;
  next?: unknown;
  action?: unknown;
  proceed?: () => void;
  reset?: () => void;
}

const mockUseBlocker = vi.hoisted(() =>
  vi.fn<(options: TestBlockerOptions) => TestBlockerResolver>(),
);

vi.mock("@tanstack/react-router", () => ({ useBlocker: mockUseBlocker }));

const reset = vi.fn();
const proceed = vi.fn();

function idleResolver() {
  return {
    status: "idle" as const,
    current: undefined,
    next: undefined,
    action: undefined,
    proceed: undefined,
    reset: undefined,
  };
}

function blockedResolver() {
  return {
    status: "blocked" as const,
    current: {} as never,
    next: {} as never,
    action: "PUSH" as never,
    proceed,
    reset,
  };
}

function Harness({ isDirty }: { isDirty: boolean }) {
  const warning = useUnsavedChangesWarning(isDirty);
  return (
    <>
      <input aria-label="編集中の値" defaultValue="保持される入力" />
      <UnsavedChangesDialog warning={warning} />
    </>
  );
}

beforeEach(() => {
  mockUseBlocker.mockReturnValue(idleResolver());
  reset.mockReset();
  proceed.mockReset();
});

describe("useUnsavedChangesWarning (UI-12/UI-USW-D1/D2 / SPEC-UISN-2/3)", () => {
  it("UI-USW-D1 T1/T5: isDirty=false は遷移と beforeunload を block しない", () => {
    renderHook(() => useUnsavedChangesWarning(false));

    const options = mockUseBlocker.mock.calls[mockUseBlocker.mock.calls.length - 1][0];
    expect(options.withResolver).toBe(true);
    expect(options.shouldBlockFn({} as never)).toBe(false);
    expect(typeof options.enableBeforeUnload).toBe("function");
    expect((options.enableBeforeUnload as () => boolean)()).toBe(false);
  });

  it("UI-USW-D1/D2 T2: isDirty=true は遷移を block して破棄確認を表示する", async () => {
    mockUseBlocker.mockReturnValue(blockedResolver());
    render(<Harness isDirty />);

    const options = mockUseBlocker.mock.calls[mockUseBlocker.mock.calls.length - 1][0];
    expect(options.shouldBlockFn({} as never)).toBe(true);
    expect((options.enableBeforeUnload as () => boolean)()).toBe(true);
    expect(await screen.findByText("編集内容が保存されていません")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "編集を続ける" })).toHaveFocus();
    });
  });

  it("UI-USW-D2 T3: 編集を続けると reset して入力を保持する", async () => {
    const user = userEvent.setup();
    mockUseBlocker.mockReturnValue(blockedResolver());
    render(<Harness isDirty />);

    await user.click(await screen.findByRole("button", { name: "編集を続ける" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByLabelText("編集中の値")).toHaveValue("保持される入力");
  });

  it("UI-USW-D2 T4: 破棄して移動すると proceed する", async () => {
    const user = userEvent.setup();
    mockUseBlocker.mockReturnValue(blockedResolver());
    render(<Harness isDirty />);

    await user.click(await screen.findByRole("button", { name: "破棄して移動" }));

    expect(proceed).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
  });
});
