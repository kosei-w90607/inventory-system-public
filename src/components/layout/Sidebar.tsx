import { ScrollArea } from "@/components/ui/scroll-area";
import { navigation } from "@/config/navigation";

import { DisplayScaleControl } from "./DisplayScaleControl";
import { SidebarArea } from "./SidebarArea";
import { SidebarHeader } from "./SidebarHeader";

// UI-12 サイドバー本体。240px 幅の aside 内側を構成する。
// 設計: docs/function-design/52-ui-shared-layout.md §52.1 / §52.4
// ヘッダ (店名ロゴ) + ScrollArea + 4 エリア (毎日 / 商品管理 / 入出庫 / システム管理) + 表示サイズを縦に並べる。
export function Sidebar() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarHeader />
      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="メインナビゲーション" className="px-2 py-3">
          {navigation.map((area) => (
            <SidebarArea key={area.id} area={area} />
          ))}
        </nav>
      </ScrollArea>
      <DisplayScaleControl />
    </div>
  );
}
