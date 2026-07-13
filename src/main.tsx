import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./styles/globals.css";
import { routeTree } from "./routeTree.gen";

/// TanStack Router + Query 初期化（ADR-001 / ADR-003 / 2026-04-20 採用）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min
      gcTime: 5 * 60_000, // 5 min
      retry: 1,
      refetchOnWindowFocus: false, // desktop app
    },
  },
});

// 注: router context は使わない（loader で queryClient を使う Phase 2 以降で
// __root.tsx を createRootRouteWithContext に拡張する段階で導入）。
// 7-5c 時点は useQuery が QueryClientProvider から取るので router context 不要。
const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element #root not found in index.html");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-left" />}
    </QueryClientProvider>
  </React.StrictMode>,
);
