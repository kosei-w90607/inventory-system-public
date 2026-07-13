// src/features/shortcuts/components/ShortcutKeys.tsx
//
// keys: readonly string[] → <kbd>Ctrl</kbd> + <kbd>/</kbd> 描画。
// + セパレータは aria-hidden で SR から隠す (行全体の description で意味が伝わる、§54.8)。
// 設計: docs/function-design/54-ui-shortcuts.md §54.1

interface ShortcutKeysProps {
  keys: readonly string[];
}

export function ShortcutKeys({ keys }: ShortcutKeysProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key, i) => (
        <span key={`${key}-${i.toString()}`} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="text-muted-foreground">
              +
            </span>
          )}
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {key}
          </kbd>
        </span>
      ))}
    </span>
  );
}
