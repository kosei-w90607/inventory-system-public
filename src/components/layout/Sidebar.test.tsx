// src/components/layout/Sidebar.test.tsx
//
// UI-12: WebView zoom 後も Sidebar の表示サイズ control へ戻れるよう、
// navigation 側を縮小可能な ScrollArea にしておく。
// 設計: docs/function-design/52-ui-shared-layout.md

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Sidebar } from "./Sidebar";

vi.mock("./SidebarArea", () => ({
  SidebarArea: ({
    area,
  }: {
    area: { label: string; items: readonly { id: string; label: string; status: string }[] };
  }) => (
    <div data-testid="sidebar-area">
      {area.label}
      {area.items.map((item) => (
        <span
          key={item.id}
          data-testid={item.status === "pending" ? "pending-sidebar-item" : undefined}
        >
          {item.label}
        </span>
      ))}
    </div>
  ),
}));

vi.mock("./SidebarHeader", () => ({
  SidebarHeader: () => <div data-testid="sidebar-header">在庫管理システム</div>,
}));

vi.mock("./DisplayScaleControl", () => ({
  DisplayScaleControl: () => <div data-testid="display-scale-control">表示サイズ</div>,
}));

describe("Sidebar (UI-12 表示サイズ reachability)", () => {
  it("UI-12: navigation area can shrink and scroll while display scale control remains mounted", () => {
    const { container } = render(<Sidebar />);

    const root = container.firstElementChild;
    const scrollArea = container.querySelector('[data-slot="scroll-area"]');

    expect(root).toHaveClass("min-h-0");
    expect(scrollArea).toHaveClass("min-h-0");
    expect(scrollArea).toHaveClass("flex-1");
    expect(screen.getByTestId("display-scale-control")).toBeInTheDocument();
  });

  it("UI-12 D-047: renders the configured navigation with no pending items", () => {
    render(<Sidebar />);

    expect(screen.getAllByTestId("sidebar-area")).toHaveLength(4);
    expect(screen.queryAllByTestId("pending-sidebar-item")).toHaveLength(0);
  });
});
