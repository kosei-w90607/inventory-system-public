import { Link, useLinkProps, useRouterState } from "@tanstack/react-router";

import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { SELECTION_TONE_ACTIVE, SELECTION_TONE_ACTIVE_ICON } from "@/components/ui/selection-tone";

interface SidebarLinkProps {
  item: NavItem;
}

const baseClass =
  "flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-sm transition-colors";

const inactiveClass = cn("text-foreground hover:bg-stone-200/60", "[&_svg]:text-stone-500");

interface ActiveMatchSidebarLinkProps {
  item: NavItem & { to: string; activeMatch: NonNullable<NavItem["activeMatch"]> };
}

function ActiveMatchSidebarLink({ item }: ActiveMatchSidebarLinkProps) {
  const location = useRouterState({ select: (state) => state.location });
  const currentValue = (location.search as Record<string, unknown>)[item.activeMatch.searchKey];
  const matchesIs = item.activeMatch.is === undefined || currentValue === item.activeMatch.is;
  const matchesIsNot =
    item.activeMatch.isNot === undefined || currentValue !== item.activeMatch.isNot;
  const isActive = location.pathname === item.to && matchesIs && matchesIsNot;
  const linkProps = useLinkProps({
    to: item.to,
    ...(item.search === undefined ? {} : { search: item.search }),
  });
  const Icon = item.icon;

  return (
    // useLinkProps で SPA 遷移を維持しつつ、同一 pathname の標準 active 属性は
    // UI-12-D1 の search predicate に基づく値で上書きする。
    <a
      {...linkProps}
      className={cn(
        baseClass,
        isActive ? cn(SELECTION_TONE_ACTIVE, SELECTION_TONE_ACTIVE_ICON) : inactiveClass,
      )}
      aria-current={isActive ? "page" : undefined}
      data-status={isActive ? "active" : undefined}
    >
      <Icon className="size-4 stroke-[1.5]" aria-hidden="true" />
      <span>{item.label}</span>
    </a>
  );
}

/// UI-12 サイドバーの 1 リンク。status で描画分岐する。
/// 設計: docs/function-design/52-ui-shared-layout.md §52.1 / §52.6
/// - status === "active" && to !== null: <Link> + activeOptions={{ exact: true, includeSearch: false }} + activeProps で active 時 shared stone selection tone
///   includeSearch:false は search params 付き URL (例: /stock?q=abc) でも path 一致のみで active 判定する (TanStack デフォルト includeSearch:true は search 完全一致を要求し active が外れる)
/// - activeMatch あり: useRouterState の pathname + search で排他的に active 判定し、useLinkProps で Link と同じ SPA 遷移を維持する
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

  if (item.activeMatch !== undefined) {
    return (
      <ActiveMatchSidebarLink item={{ ...item, to: item.to, activeMatch: item.activeMatch }} />
    );
  }

  return (
    <Link
      to={item.to}
      {...(item.search === undefined ? {} : { search: item.search })}
      activeOptions={{ exact: true, includeSearch: false }}
      className={baseClass}
      activeProps={{
        className: cn(SELECTION_TONE_ACTIVE, SELECTION_TONE_ACTIVE_ICON),
      }}
      inactiveProps={{
        className: inactiveClass,
      }}
    >
      <Icon className="size-4 stroke-[1.5]" aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}
