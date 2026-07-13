// src/features/home/components/PluNotificationBar.tsx
//
// PLU 通知バー。pluDirty.isSuccess && pluDirtyCount >= 1 で表示。
// 設計: docs/function-design/53-ui-home.md §53.1 / §53.4 / §53.5

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import type { HomeSummaryQueries, HomeSummaryDerived } from "../types";

export interface PluNotificationBarProps {
  pluDirty: HomeSummaryQueries["pluDirty"];
  pluDirtyCount: HomeSummaryDerived["pluDirtyCount"];
}

/// pluDirty.isLoading 中はバー非表示（誤判定防止）。
/// isError 時もバー非表示（誤検知より沈黙を選ぶ、Sonner トーストは別レイヤで通知）。
/// isSuccess && pluDirtyCount >= 1 でのみ黄色バー表示。
export function PluNotificationBar({ pluDirty, pluDirtyCount }: PluNotificationBarProps) {
  if (!pluDirty.isSuccess || pluDirtyCount < 1) return null;

  return (
    <Alert className="border-warning bg-warning-soft text-warning-strong">
      <AlertTitle>PLU 未反映商品があります</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{pluDirtyCount} 件の商品で PLU 書出しが必要です。</span>
        <Button variant="outline" size="sm" asChild>
          <Link to="/products/plu-export">PLU 書出しへ</Link>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
