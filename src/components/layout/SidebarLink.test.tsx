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
import { render, screen } from "@testing-library/react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  RouterProvider,
} from "@tanstack/react-router";
import { Search } from "lucide-react";

import { SidebarLink } from "./SidebarLink";
import type { NavItem } from "@/config/navigation";

// navigation.ts の在庫照会 NavItem (to: "/stock") 相当。単一 NavItem で十分 (19 項目は不要)。
const stockItem: NavItem = {
  id: "ui-06a",
  label: "在庫照会",
  title: "在庫照会",
  to: "/stock",
  icon: Search,
  status: "active",
};

function renderAt(initialPath: string) {
  const rootRoute = createRootRoute({ component: () => <SidebarLink item={stockItem} /> });
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
  return render(<RouterProvider router={router} />);
}

describe("SidebarLink (PR-1 B1: search params 付き URL の active 維持)", () => {
  it("REQ-301: /stock?q=abc でもサイドバーリンクの active が維持される", async () => {
    renderAt("/stock?q=abc");

    const link = await screen.findByRole("link", { name: "在庫照会" });
    expect(link).toHaveAttribute("data-status", "active");
  });
});
