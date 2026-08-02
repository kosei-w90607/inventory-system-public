// src/components/layout/SidebarLink.test.tsx
//
// PR-1 (B1 nav fix, Codex P2-1): SidebarLink は全画面共通サイドバーの 1 リンクで、
// B1「全画面サイドバー active 消失」の核心バグ。TabsHeader だけでは共有 nav の退行を
// CI で取り逃がす (includeSearch を戻しても緑のまま通る) ため SidebarLink 単体で検証する。
// 設計: docs/plans/2026-05-22-tone-and-nav-fix.md PR-1
//
// 回帰検出力のため initialEntries に search params を必ず載せる (R2-1):
// activeOptions.includeSearch:false により search params 付き URL でも path 一致のみで
// active 判定されることを data-status="active" 属性で検証する (クラス hardcode は脆い)。

import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { Search } from "lucide-react";

import { SidebarLink } from "./SidebarLink";
import { SidebarArea } from "./SidebarArea";
import { navigation } from "@/config/navigation";
import type { NavItem } from "@/config/navigation";

// navigation.ts の在庫照会 NavItem (to: "/stock") 相当。単一 NavItem で十分 (20 項目は不要)。
const stockItem: NavItem = {
  id: "ui-06a",
  label: "在庫照会",
  title: "在庫照会",
  to: "/stock",
  icon: Search,
  status: "active",
};

const stockNavigationAreas = navigation.filter(
  (area) => area.id === "daily" || area.id === "inventory",
);
if (stockNavigationAreas.length !== 2) {
  throw new Error("daily and inventory navigation areas are required for SidebarLink tests");
}

function renderAt(initialPath: string, content = <SidebarLink item={stockItem} />) {
  const rootRoute = createRootRoute({
    component: () => content,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => null,
  });
  const stockRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/stock",
    component: () => null,
  });
  const routeTree = rootRoute.addChildren([indexRoute, stockRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return { router, ...render(<RouterProvider router={router} />) };
}

function renderStockNavigationAt(initialPath: string) {
  return renderAt(
    initialPath,
    <>
      {stockNavigationAreas.map((area) => (
        <SidebarArea key={area.id} area={area} />
      ))}
    </>,
  );
}

function expectOnlyActive(activeLabel: string, inactiveLabel: string) {
  expect(screen.getByRole("link", { name: activeLabel })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: inactiveLabel })).not.toHaveAttribute("aria-current");
}

describe("SidebarLink (PR-1 B1: search params 付き URL の active 維持)", () => {
  it("REQ-301: /stock?q=abc でもサイドバーリンクの active が維持される", async () => {
    renderAt("/stock?q=abc");

    const link = await screen.findByRole("link", { name: "在庫照会" });
    expect(link).toHaveAttribute("data-status", "active");
  });
});

describe("SidebarLink UI-12-D1: 同一 route の排他 active", () => {
  it("test_sidebarlink_ui12d1_low_stock_search_only_low_stock_entry_active", async () => {
    renderStockNavigationAt("/stock?status=low_stock");

    await screen.findByRole("link", { name: "在庫少一覧" });
    expectOnlyActive("在庫少一覧", "在庫照会");
  });

  it.each(["/stock", "/stock?status=all"])(
    "test_sidebarlink_ui12d1_plain_stock_only_inquiry_entry_active: %s",
    async (initialPath) => {
      renderStockNavigationAt(initialPath);

      await screen.findByRole("link", { name: "在庫照会" });
      expectOnlyActive("在庫照会", "在庫少一覧");
    },
  );

  it("test_sidebarlink_ui12d1_stockout_search_only_inquiry_entry_active", async () => {
    renderStockNavigationAt("/stock?status=stockout");

    await screen.findByRole("link", { name: "在庫照会" });
    expectOnlyActive("在庫照会", "在庫少一覧");
  });

  it("test_sidebarlink_ui12d1_low_stock_with_extra_search_params_only_low_stock_entry_active", async () => {
    renderStockNavigationAt("/stock?status=low_stock&q=%E6%AF%9B%E7%B3%B8");

    await screen.findByRole("link", { name: "在庫少一覧" });
    expectOnlyActive("在庫少一覧", "在庫照会");
  });

  it("test_sidebarlink_ui12d1_navigates_with_status_low_stock_search_only", async () => {
    const user = userEvent.setup();
    const { router } = renderStockNavigationAt("/");

    await user.click(await screen.findByRole("link", { name: "在庫少一覧" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/stock");
      expect(router.state.location.search).toEqual({ status: "low_stock" });
    });
  });
});

// UI backlog batch A (SPEC-UIPOLA-D3 / Matrix C1): UI_TECH_STACK.md §5.4 系統① focus ring
// (52 §52.1) を focusable link (active/inactive) へ付与し、pending は非 focusable のまま。
describe("SidebarLink UI-11b batch A: focus ring (UI_TECH_STACK §5.4 系統①)", () => {
  const focusRingClasses = [
    "focus-visible:border-ring",
    "focus-visible:ring-[3px]",
    "focus-visible:ring-ring/50",
  ];

  it("test_sidebarlink_batcha_activematch_active_entry_has_focus_ring", async () => {
    renderStockNavigationAt("/stock?status=low_stock");

    const link = await screen.findByRole("link", { name: "在庫少一覧" });
    expect(link).toHaveAttribute("data-status", "active");
    focusRingClasses.forEach((className) => {
      expect(link).toHaveClass(className);
    });
  });

  it("test_sidebarlink_batcha_activematch_inactive_entry_has_focus_ring", async () => {
    renderStockNavigationAt("/stock?status=low_stock");

    const link = await screen.findByRole("link", { name: "在庫照会" });
    expect(link).not.toHaveAttribute("data-status", "active");
    focusRingClasses.forEach((className) => {
      expect(link).toHaveClass(className);
    });
  });

  it("test_sidebarlink_batcha_plain_link_active_entry_has_focus_ring", async () => {
    renderAt("/stock?q=abc");

    const link = await screen.findByRole("link", { name: "在庫照会" });
    expect(link).toHaveAttribute("data-status", "active");
    focusRingClasses.forEach((className) => {
      expect(link).toHaveClass(className);
    });
  });

  it("test_sidebarlink_batcha_plain_link_inactive_entry_has_focus_ring", async () => {
    renderAt("/");

    const link = await screen.findByRole("link", { name: "在庫照会" });
    expect(link).not.toHaveAttribute("data-status", "active");
    focusRingClasses.forEach((className) => {
      expect(link).toHaveClass(className);
    });
  });

  it("test_sidebarlink_batcha_pending_entry_stays_non_focusable_without_focus_ring", () => {
    const pendingItem: NavItem = {
      id: "ui-batcha-pending-synthetic",
      label: "未実装機能",
      title: "未実装機能",
      to: null,
      icon: Search,
      status: "pending",
    };
    render(<SidebarLink item={pendingItem} />);

    const pendingLink = screen.getByRole("link", { name: /未実装機能/ });
    expect(pendingLink).toHaveAttribute("tabindex", "-1");
    expect(pendingLink).toHaveAttribute("aria-disabled", "true");
    focusRingClasses.forEach((className) => {
      expect(pendingLink).not.toHaveClass(className);
    });
  });
});
