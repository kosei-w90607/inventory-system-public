// src/features/stock-inquiry/components/StatusChips.test.tsx
//
// REQ-302: 在庫状態フィルタは常に 1 つ選択を維持する。
// 視認性 tone は L3 目視対象のため、class ではなく Radix state と挙動を検証する。

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusChips } from "./StatusChips";

describe("StatusChips (REQ-302 状態フィルタ)", () => {
  it("REQ-302: selected chip exposes data-state=on", () => {
    render(<StatusChips value="stockout" onChange={vi.fn()} />);

    expect(screen.getByLabelText("在庫切れ")).toHaveAttribute("data-state", "on");
    expect(screen.getByLabelText("在庫少")).toHaveAttribute("data-state", "off");
  });

  it("REQ-302: clicking another chip emits the next filter value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatusChips value="all" onChange={onChange} />);

    await user.click(screen.getByLabelText("在庫少"));

    expect(onChange).toHaveBeenCalledWith("low_stock");
  });

  it("REQ-302: deselect empty value is ignored", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatusChips value="stockout" onChange={onChange} />);

    await user.click(screen.getByLabelText("在庫切れ"));

    expect(onChange).not.toHaveBeenCalled();
  });
});
