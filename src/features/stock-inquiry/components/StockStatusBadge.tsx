// src/features/stock-inquiry/components/StockStatusBadge.tsx
//
// 在庫状態を色だけに依存せず、日本語ラベル + アイコン + Badge で表示する。
// 閾値判定は持たず、ProductListTable で派生済みの StockStatus だけを受け取る。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7 / §58.10

import { CircleAlertIcon, TriangleAlertIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StockStatus } from "../types";

export interface StockStatusBadgeProps {
  status: StockStatus;
}

const STATUS_STYLE: Record<StockStatus, string> = {
  ok: "border-stone-200 bg-stone-50 text-stone-600",
  low: "border-warning-border bg-warning-soft text-warning-strong",
  stockout: "border-destructive-border bg-destructive-soft text-destructive-strong",
};

export function StockStatusBadge({ status }: StockStatusBadgeProps) {
  if (status === "stockout") {
    return (
      <Badge variant="outline" className={cn("font-medium", STATUS_STYLE.stockout)}>
        <CircleAlertIcon aria-hidden="true" />
        在庫切れ
      </Badge>
    );
  }

  if (status === "low") {
    return (
      <Badge variant="outline" className={cn("font-medium", STATUS_STYLE.low)}>
        <TriangleAlertIcon aria-hidden="true" />
        在庫少
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLE.ok)}>
      通常
    </Badge>
  );
}
