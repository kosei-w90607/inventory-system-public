// src/features/shortcuts/components/ShortcutsTable.tsx
//
// 1 section 分の Table 描画。空配列時は <p> で「該当なし」メッセージを表示する。
// 設計: docs/function-design/54-ui-shortcuts.md §54.1 / §54.4

import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";

import type { Shortcut } from "../types";

import { ShortcutKeys } from "./ShortcutKeys";

interface ShortcutsTableProps {
  shortcuts: readonly Shortcut[];
  emptyMessage: string;
}

export function ShortcutsTable({ shortcuts, emptyMessage }: ShortcutsTableProps) {
  if (shortcuts.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <Table>
      <TableBody>
        {shortcuts.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="w-40 align-top">
              <ShortcutKeys keys={s.keys} />
            </TableCell>
            <TableCell className="text-sm">{s.description}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
