// src/features/home/components/ActionButton.tsx
//
// 大ボタン共通コンポーネント。引数 navItemId のみで navigation SSOT を参照。
// 設計: docs/function-design/53-ui-home.md §53.1 / D-2 / B-10

import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navigation } from "@/config/navigation";
import type { NavItem } from "@/config/navigation";

function findNavItem(id: NavItem["id"]): NavItem | undefined {
  for (const area of navigation) {
    const found = area.items.find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

export interface ActionButtonProps {
  navItemId: NavItem["id"];
  /// "lg" = 大ボタン (毎日の作業 / 入出庫)、"md" = 中ボタン (その他 3 ボタン)
  size?: "lg" | "md";
}

export function ActionButton({ navItemId, size = "lg" }: ActionButtonProps) {
  const item = findNavItem(navItemId);

  if (!item) {
    // navigation SSOT に未定義の id → コード変更時の検出のため fail-fast
    // pending パターンと整合 (HTML disabled でなく aria-disabled、「Unknown:」テキストで開発者警告維持)
    return (
      <Button variant="outline" aria-disabled="true" className="cursor-not-allowed opacity-60">
        Unknown: {navItemId}
      </Button>
    );
  }

  const Icon = item.icon;
  const sizeClass = size === "lg" ? "h-24 text-base" : "h-16 text-sm";
  const baseClass = `w-full flex flex-col items-center justify-center gap-2 ${sizeClass}`;

  // pending: aria-disabled + Tooltip + cursor-not-allowed + onClick preventDefault の 3 層 (D-2 改訂)
  // shadcn 公式パターン: HTML `disabled` 属性は pointer-events を受けないため Tooltip が hover で起動しない。
  // `aria-disabled` で screen reader に伝達 + `onClick preventDefault` でクリック無効化 + `cursor-not-allowed` で
  // 視覚的に disabled を表現。これで Button が pointer-events を受けて Tooltip 起動可能。
  if (item.status === "pending" || item.to === null) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            className={`${baseClass} cursor-not-allowed opacity-60`}
            aria-disabled="true"
            onClick={(e) => {
              e.preventDefault();
            }}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
            <span>{item.label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>後続フェーズで着手予定</TooltipContent>
      </Tooltip>
    );
  }

  // active: TanStack Router <Link> で遷移
  return (
    <Button asChild variant="outline" className={baseClass}>
      <Link to={item.to}>
        <Icon className="h-6 w-6" aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    </Button>
  );
}
