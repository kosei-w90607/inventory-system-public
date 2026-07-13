// src/components/patterns/PageHeader.tsx
//
// 全画面共通ページヘッダー。3 variant を props 組合せで統合する。
// 設計: docs/function-design/59-ui-shared-patterns.md §59.1
// catalog: docs/design-system/02-component-catalog.md ① ページヘッダ

import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** ページタイトル。h1 要素として描画される */
  title: string;
  /** 副題。text-sm text-muted-foreground で h1 直下に描画される（省略可） */
  subtitle?: string;
  /** ヘッダー右端に配置するアクション要素（省略可）。存在時は flex justify-between レイアウトになる */
  actions?: ReactNode;
}

/**
 * ページヘッダーの 3 variant:
 *   (a) title のみ         → `<header className="space-y-1">` + `<h1>`
 *   (b) title + subtitle  → `<header className="space-y-1">` + `<h1>` + `<p>`
 *   (c) title + actions   → `<header className="flex flex-wrap items-center justify-between gap-3">` + `<h1>` + actions slot
 *
 * DOM 互換性: 8 画面の既存インライン header を置換した際に DOM 出力が変わらないよう設計
 * （D-B2: subtitle? 追加で 8 画面統合、PageHeader props 契約）。
 */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  // actions がある場合は flex レイアウト（ProductListPage の現構造と同値）
  if (actions !== undefined) {
    return (
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {actions}
      </header>
    );
  }

  // subtitle がある場合、または title のみの場合は space-y-1 レイアウト
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle !== undefined && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </header>
  );
}
