// src/components/patterns/FormSection.tsx
//
// フォームセクション共通 component。タイトル・説明・Separator + children の構造を統一する。
// 設計: docs/function-design/59-ui-shared-patterns.md §59.2
// catalog: docs/design-system/02-component-catalog.md ④ フォームセクション

import type { ReactNode } from "react";

import { Separator } from "@/components/ui/separator";

export interface FormSectionProps {
  /** セクション見出し。h2 要素として描画される */
  title: string;
  /** 補足説明。text-sm text-muted-foreground で h2 直下に描画される（省略可。省略時は <p> を描画しない） */
  description?: string;
  children: ReactNode;
}

/**
 * フォームセクション。
 * description を省略すると <p> を描画しない（D-B6: 空 <p> を残さない）。
 *
 * DOM 構造:
 *   <section className="space-y-3">
 *     <div className="space-y-1">
 *       <h2 className="text-xl font-semibold">{title}</h2>
 *       {description !== undefined && <p className="text-sm text-muted-foreground">{description}</p>}
 *     </div>
 *     <Separator />
 *     {children}
 *   </section>
 */
export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <Separator />
      {children}
    </section>
  );
}
