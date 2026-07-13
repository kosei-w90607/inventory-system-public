import { Link } from "@tanstack/react-router";

import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { SELECTION_TONE_ACTIVE, SELECTION_TONE_ACTIVE_ICON } from "@/components/ui/selection-tone";

interface SidebarLinkProps {
  item: NavItem;
}

const baseClass =
  "flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm transition-colors";

/// UI-12 サイドバーの 1 リンク。status で描画分岐する。
/// 設計: docs/function-design/52-ui-shared-layout.md §52.1 / §52.6
/// - status === "active" && to !== null: <Link> + activeOptions={{ exact: true, includeSearch: false }} + activeProps で active 時 shared stone selection tone
///   includeSearch:false は search params 付き URL (例: /stock?q=abc) でも path 一致のみで active 判定する (TanStack デフォルト includeSearch:true は search 完全一致を要求し active が外れる)
/// - status === "pending" or to === null: <span role="link" aria-disabled="true" tabIndex={-1}> + sr-only "（未実装）"
/// アイコン色は Tailwind 4 arbitrary variant ([&_svg]:text-...) で active/inactive を制御する。
export function SidebarLink({ item }: SidebarLinkProps) {
  const Icon = item.icon;

  if (item.status === "pending" || item.to === null) {
    return (
      <span
        role="link"
        aria-disabled="true"
        tabIndex={-1}
        className={cn(baseClass, "cursor-not-allowed text-stone-500 opacity-60")}
      >
        <Icon className="size-4 stroke-[1.5] text-stone-500" aria-hidden="true" />
        <span>{item.label}</span>
        <span className="sr-only">（未実装）</span>
      </span>
    );
  }

  return (
    <Link
      to={item.to}
      activeOptions={{ exact: true, includeSearch: false }}
      className={baseClass}
      activeProps={{
        className: cn(SELECTION_TONE_ACTIVE, SELECTION_TONE_ACTIVE_ICON),
      }}
      inactiveProps={{
        className: cn("text-foreground hover:bg-stone-200/60", "[&_svg]:text-stone-500"),
      }}
    >
      <Icon className="size-4 stroke-[1.5]" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}
