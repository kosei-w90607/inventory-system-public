// src/features/shortcuts/index.ts
//
// Barrel export。公開 API は ShortcutsDialog (Provider に mount) と
// useShortcutsDialog (open state + global keydown listener) のみ。
// 設計: docs/function-design/54-ui-shortcuts.md §54.1

export { ShortcutsDialog } from "./ShortcutsDialog";
export { useShortcutsDialog } from "./hooks/useShortcutsDialog";
