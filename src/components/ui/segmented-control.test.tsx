// src/components/ui/segmented-control.test.tsx
//
// UI-WF-2026-05-22: app-wide two-choice controls share the same segmented
// visual primitive while exposing a non-color selected state.

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SegmentedControl } from "./segmented-control";

describe("SegmentedControl (UI-WF-2026-05-22 shared two-choice control)", () => {
  const options = [
    { value: "daily", label: "日次" },
    { value: "monthly", label: "月次" },
  ] as const;

  it("exposes the selected option through aria-pressed, data-state, and shared active tone", () => {
    render(
      <SegmentedControl
        ariaLabel="売上レポート切替"
        value="daily"
        options={options}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("group", { name: "売上レポート切替" })).toBeInTheDocument();

    const activeButton = screen.getByRole("button", { name: "日次", pressed: true });
    const inactiveButton = screen.getByRole("button", { name: "月次", pressed: false });

    expect(activeButton).toHaveAttribute("data-state", "active");
    expect(activeButton).toHaveClass(
      "border-stone-300",
      "bg-stone-300",
      "font-semibold",
      "text-stone-950",
    );
    expect(inactiveButton).toHaveAttribute("data-state", "inactive");
    expect(inactiveButton).toHaveClass("text-foreground/60", "hover:text-foreground");
  });

  it("emits only direct changes to a different option", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="売上レポート切替"
        value="daily"
        options={options}
        onValueChange={onValueChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "日次", pressed: true }));
    await user.click(screen.getByRole("button", { name: "月次", pressed: false }));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledWith("monthly");
  });
});
