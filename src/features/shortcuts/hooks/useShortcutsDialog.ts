// src/features/shortcuts/hooks/useShortcutsDialog.ts
//
// Ctrl+/ keydown listener + open state。Listener は window レベル / bubble phase /
// stopPropagation 呼ばない (Phase 3 UI-02 バーコードスキャナ keypress との衝突回避)。
// 設計: docs/function-design/54-ui-shortcuts.md §54.2 / §54.7

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useShortcutsDialog(): {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
} {
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      // §54.7 除外条件 (優先順位):
      // 1. IME composition 中 → 日本語入力中の誤発火防止
      // keyCode === 229 は isComposing をサポートしない古いブラウザ向け fallback (§54.7)
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- IME composition 検出の互換 fallback (§54.7)
      if (event.isComposing || event.keyCode === 229) return;
      // 2. input / textarea / contenteditable focus 中 → フォーム入力中の誤発火防止
      if (isEditableTarget(event.target)) return;
      // 3. Ctrl+/ 以外 → スキップ
      if (!event.ctrlKey || event.key !== "/") return;

      event.preventDefault();
      // 4. 長押し連続発火 → preventDefault は既定動作抑止のため毎回呼ぶが、toggle は 1 keypress 1 回に限定 (§54.7)
      if (event.repeat) return;
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
  }, []);

  return { open, setOpen };
}
