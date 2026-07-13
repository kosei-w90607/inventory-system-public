// src/features/shortcuts/ShortcutsDialog.tsx
//
// Ctrl+/ で開閉するダイアログ本体。SHORTCUTS を category でグルーピングして
// 「グローバル」「このページ」2 section で表示する純表示コンポーネント。
// open / onOpenChange は props 受け取り、内部で hook 呼ばない (Radix controlled pattern)。
// 設計: docs/function-design/54-ui-shortcuts.md §54.1 / §54.4

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

import { ShortcutsTable } from "./components/ShortcutsTable";
import { SHORTCUTS } from "./data";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const globalShortcuts = SHORTCUTS.filter((s) => s.category === "global");
  const screenShortcuts = SHORTCUTS.filter((s) => s.category === "screen");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ショートカット一覧</DialogTitle>
          <DialogDescription>押せるキー組合せの一覧</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">グローバル</h3>
              <ShortcutsTable
                shortcuts={globalShortcuts}
                emptyMessage="グローバルショートカットはありません"
              />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">このページ</h3>
              <ShortcutsTable
                shortcuts={screenShortcuts}
                emptyMessage="現在のページに固有のショートカットはありません"
              />
            </section>
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">閉じる</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
