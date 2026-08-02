// src/test/render-with-router.tsx
//
// UI backlog batch A (SPEC-UIPOLA-D2): <Link> 化した既存画面を実 TanStack Router context で
// 描画するための共通 test helper。実 route tree は使わず、渡された component を catch-all
// root route の component として描画する (Link の href 解決に router context が必要な
// だけで、実際の遷移・route matching は本 helper の対象外。SidebarLink.test.tsx の
// renderAt と同じ考え方)。

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

export function renderWithRouter(ui: ReactElement, initialPath = "/") {
  const rootRoute = createRootRoute({ component: () => ui });
  const routeTree = rootRoute.addChildren([]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return { router, ...render(<RouterProvider router={router} />) };
}
