import { createRootRoute } from "@tanstack/react-router";

import { RootLayout } from "@/components/layout/RootLayout";
import { RouteErrorFallback } from "@/components/patterns/RouteErrorFallback";

/// ルート route。UI-12 共通レイアウト (RootLayout) を mount する。
/// 設計: docs/function-design/52-ui-shared-layout.md §52.1
/// notFoundComponent は RootLayout の h-screen 枠内で描画されるため min-h-screen を持たない。
export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: (props) => <RouteErrorFallback {...props} fullScreen />,
  notFoundComponent: () => (
    <div className="bg-background p-8 text-foreground">
      <h1 className="text-2xl font-semibold">404 Not Found</h1>
      <p className="mt-2 text-sm text-muted-foreground">指定された画面が見つかりません。</p>
    </div>
  ),
});
