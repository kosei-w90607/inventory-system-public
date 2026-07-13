import { Separator } from "@/components/ui/separator";
import type { NavArea } from "@/config/navigation";

import { SidebarLink } from "./SidebarLink";

interface SidebarAreaProps {
  area: NavArea;
}

/// UI-12 サイドバーの 1 エリアを描画する。
/// 設計: docs/function-design/52-ui-shared-layout.md §52.1 / §52.4
/// エリアアイコン + ラベル (h2) + SidebarLink × N + 末尾 Separator。
/// 色分けは廃止 (design-system/00-foundations.md 4色エリアモデルの扱い)、識別はアイコン + 区切り線で行う。
export function SidebarArea({ area }: SidebarAreaProps) {
  const AreaIcon = area.icon;

  return (
    <div className="mb-3">
      <h2 className="mb-1 flex items-center gap-2 px-2 py-1 text-xs font-semibold text-muted-foreground">
        <AreaIcon className="size-4 stroke-[1.5]" aria-hidden="true" />
        {area.label}
      </h2>
      <ul className="flex flex-col gap-0.5">
        {area.items.map((item) => (
          <li key={item.id}>
            <SidebarLink item={item} />
          </li>
        ))}
      </ul>
      <Separator className="mt-3" />
    </div>
  );
}
