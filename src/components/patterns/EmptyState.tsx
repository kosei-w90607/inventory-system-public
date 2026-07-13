// src/components/patterns/EmptyState.tsx
//
// 空状態の標準 UI コンポーネント。
// 設計: docs/design-system/02-component-catalog.md ⑥ 空状態（Empty State）の標準UI

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  /** lucide-react アイコンコンポーネント（省略可）。24px, stone-400 で描画 */
  icon?: LucideIcon;
  /** 見出し。h3 stone-700 で描画 */
  title: string;
  /** 説明文。text-sm stone-500 で描画（省略可） */
  description?: string;
  /** アクション slot（省略可）。Button + Link 等を受け取る */
  action?: ReactNode;
}

/**
 * 空状態表示の標準 UI。
 * アイコン（省略可）+ 見出し + 説明（省略可）+ アクション（省略可）の 4 要素構成。
 * catalog ⑥: rounded-md border p-12 text-center の囲み内に 3 行以内で収める。
 */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-md border p-12 text-center">
      {Icon !== undefined && (
        <Icon aria-hidden="true" size={24} className="mx-auto mb-3 text-stone-400" />
      )}
      <h3 className="text-base font-medium text-stone-700">{title}</h3>
      {description !== undefined && <p className="mt-1 text-sm text-stone-500">{description}</p>}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}
