// src/routes/inventory/disposal/index.tsx
//
// UI-05 廃棄・破損入力画面の index route。
// 設計: docs/function-design/64-ui-disposal.md §64.8

import { createFileRoute } from "@tanstack/react-router";

import { DisposalPage } from "@/features/disposal/DisposalPage";

export const Route = createFileRoute("/inventory/disposal/")({
  component: DisposalPage,
});
