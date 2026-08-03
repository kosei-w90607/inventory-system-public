import { readFileSync } from "node:fs";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

function renderChildCrash() {
  const rootRoute = createRootRoute({
    component: () => (
      <div>
        <nav aria-label="サイドバー">業務メニュー</nav>
        <Outlet />
      </div>
    ),
    errorComponent: (props) => <RouteErrorFallback {...props} fullScreen />,
  });
  const crashRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => {
      throw new Error("synthetic child crash");
    },
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([crashRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultErrorComponent: RouteErrorFallback,
  });
  return render(<RouterProvider router={router} />);
}

describe("route error fallback (UI-12/UI-EB-D1/D2/D3 / SPEC-UISN-1)", () => {
  it("UI-EB-D1/D2 T6: 子routeのthrowでlayoutを保持して日本語fallbackを表示する", async () => {
    renderChildCrash();

    expect(await screen.findByText("画面の表示中に問題が発生しました")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "サイドバー" })).toBeInTheDocument();
    expect(screen.getByText("保存済みのデータは失われていません。")).toBeInTheDocument();

    const mainSource = readFileSync(`${process.cwd()}/src/main.tsx`, "utf8");
    expect(mainSource).toContain("defaultErrorComponent: RouteErrorFallback");
  });

  it("UI-EB-D1 T7: RootLayout相当のthrowをroot errorComponentで全画面fallbackにする", async () => {
    const rootRoute = createRootRoute({
      component: () => {
        throw new Error("synthetic root crash");
      },
      errorComponent: (props) => <RouteErrorFallback {...props} fullScreen />,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("画面の表示中に問題が発生しました")).toBeInTheDocument();
    expect(screen.getByTestId("route-error-fallback")).toHaveClass("min-h-screen");

    const rootSource = readFileSync(`${process.cwd()}/src/routes/__root.tsx`, "utf8");
    expect(rootSource).toContain("errorComponent:");
    expect(rootSource).toContain("fullScreen");
  });

  it("UI-EB-D2 T8: 再試行で再renderし、ホーム導線は / を指す", async () => {
    const user = userEvent.setup();
    function RetryHarness() {
      const [hasError, setHasError] = useState(true);
      return hasError ? (
        <RouteErrorFallback
          error={new Error("retry once")}
          reset={() => {
            setHasError(false);
          }}
        />
      ) : (
        <p>再表示できました</p>
      );
    }
    const rootRoute = createRootRoute({
      component: RetryHarness,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText("画面の表示中に問題が発生しました")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ホームへ戻る" })).toHaveAttribute("href", "/");
    await user.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => {
      expect(screen.getByText("再表示できました")).toBeInTheDocument();
    });
  });
});
