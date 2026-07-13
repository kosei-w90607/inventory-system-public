// src/features/shortcuts/data.ts
//
// ショートカット定義 SSOT。各画面 PR でこの配列に追記して拡張。
// 設計: docs/function-design/54-ui-shortcuts.md §54.1 / §54.2

import type { Shortcut } from "./types";

export const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "global.show-shortcuts",
    keys: ["Ctrl", "/"],
    description: "ショートカット一覧を表示 / 閉じる",
    category: "global",
  },
] as const;
