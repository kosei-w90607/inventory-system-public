// src/features/shortcuts/types.ts
//
// ショートカット型定義。
// 設計: docs/function-design/54-ui-shortcuts.md §54.1 / §54.2

export type ShortcutCategory = "global" | "screen";

export interface Shortcut {
  id: string;
  keys: readonly string[];
  description: string;
  category: ShortcutCategory;
}
