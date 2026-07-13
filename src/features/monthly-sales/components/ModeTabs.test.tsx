// src/features/monthly-sales/components/ModeTabs.test.tsx
//
// REQ-502: 月次売上の表示 mode は商品別 / 部門別を直接切り替えられる。
// PR #80 L3 feedback: mode tab も shared segmented control 対象として扱う。

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ModeTabs } from "./ModeTabs";

describe("ModeTabs (REQ-502 月次売上 mode 切替)", () => {
  it.each([
    {
      mode: "by_product" as const,
      activeName: "商品別ランキング",
      inactiveName: "部門別構成比",
    },
    {
      mode: "by_department" as const,
      activeName: "部門別構成比",
      inactiveName: "商品別ランキング",
    },
  ])(
    "REQ-502: $mode exposes Radix active state and shared selection tone",
    ({ mode, activeName, inactiveName }) => {
      render(<ModeTabs mode={mode} onChange={vi.fn()} />);

      const activeButton = screen.getByRole("button", { name: activeName, pressed: true });
      const inactiveButton = screen.getByRole("button", { name: inactiveName, pressed: false });

      expect(activeButton).toHaveAttribute("data-state", "active");
      expect(inactiveButton).toHaveAttribute("data-state", "inactive");
      expect(activeButton).toHaveClass("flex-none", "px-3");
    },
  );

  it("REQ-502: clicking another mode emits the next mode", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ModeTabs mode="by_product" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "部門別構成比", pressed: false }));

    expect(onChange).toHaveBeenCalledWith("by_department");
  });
});
