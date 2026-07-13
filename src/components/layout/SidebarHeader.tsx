import { Link } from "@tanstack/react-router";

import { Separator } from "@/components/ui/separator";

/// UI-12 サイドバーヘッダ。
/// 設計: docs/function-design/52-ui-shared-layout.md §52.1
/// 店名ロゴ (テキスト) + Link to="/" + 末尾 Separator。
/// 高さ 48px で SidebarArea と分離する。
export function SidebarHeader() {
  return (
    <div>
      <Link
        to="/"
        className="flex h-12 items-center px-3 text-sm font-semibold text-foreground transition-colors hover:bg-stone-200/40"
      >
        在庫管理システム
      </Link>
      <Separator />
    </div>
  );
}
