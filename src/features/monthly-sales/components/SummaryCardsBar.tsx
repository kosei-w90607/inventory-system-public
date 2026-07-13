// src/features/monthly-sales/components/SummaryCardsBar.tsx
//
// 4 カード: 月間売上合計 / 月間販売点数 / 期間表示 / 前月比 (集計サマリ)。
// 前月比カードは `hasPrevComparison === false` で「比較不可」灰表示（Q-5 失敗 4 状態 #3）。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MonthlySaleItem } from "@/lib/bindings";
import type { MonthlySummary } from "../types";

export interface SummaryCardsBarProps {
  summary: MonthlySummary;
  periodLabel: string;
  prevComparison: readonly MonthlySaleItem[] | null;
  isLoading: boolean;
}

export function SummaryCardsBar({
  summary,
  periodLabel,
  prevComparison,
  isLoading,
}: SummaryCardsBarProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <Skeleton className="h-4 w-20" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const compareLabel = computeSummaryCompareLabel(summary.totalAmount, prevComparison);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SimpleCard title="月間売上合計" value={`¥${summary.totalAmount.toLocaleString("ja-JP")}`} />
      <SimpleCard title="月間販売点数" value={`${String(summary.totalQuantity)} 点`} />
      <SimpleCard title="期間" value={periodLabel} />
      <SimpleCard
        title="前月比"
        value={compareLabel.value}
        sub={compareLabel.sub ?? undefined}
        valueClassName={compareLabel.valueClassName}
      />
    </div>
  );
}

interface SimpleCardProps {
  title: string;
  value: string;
  sub?: string;
  valueClassName?: string;
}

function SimpleCard({ title, value, sub, valueClassName }: SimpleCardProps) {
  // Card は flex flex-col のため grid item の min-width:auto で縮まらず、長い金額/期間ラベルで
  // カードが溢れる (B2/B3)。Card + CardContent 両方に min-w-0 を付け value div を truncate する。
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <div className={cn("truncate text-2xl font-semibold", valueClassName)}>{value}</div>
        {sub !== undefined && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

interface CompareLabel {
  value: string;
  sub: string | null;
  valueClassName?: string;
}

/// 月間総額同士で前月比を計算する。
/// `prevComparison === null` は specta `Option<Vec<T>>` 境界の defensive guard（通常 BIZ-05 は
/// 前月データなしも `Some(空Vec)` を返す常時セット = `sales_service.rs:196-197`）、「比較不可」灰。
/// `prevComparison === []` の通常 path は下の for ループで prevTotal=0 になり、Q-7 ガード
/// (`prev <= 0`) で「比較不可」灰に同じく落ちる。
/// Q-7 ガード: 前月合計 <= 0 → 「比較不可」（除算 + 色分け逆転回避）。
function computeSummaryCompareLabel(
  currentAmount: number,
  prevComparison: readonly MonthlySaleItem[] | null,
): CompareLabel {
  if (prevComparison === null) return { value: "比較不可", sub: null };

  let prevTotal = 0;
  for (const item of prevComparison) {
    prevTotal += item.amount;
  }

  if (prevTotal <= 0)
    return { value: "比較不可", sub: prevTotal === 0 ? "前月売上 0 円" : "前月返品超過" };

  const diff = currentAmount - prevTotal;
  const pct = (diff / prevTotal) * 100;
  const sign = diff >= 0 ? "+" : "-";
  const absDiff = Math.abs(diff).toLocaleString("ja-JP");
  const valueClassName = diff >= 0 ? "text-success-emphasis" : "text-destructive";
  return {
    value: `${sign}¥${absDiff}`,
    sub: `${sign}${pct.toFixed(1)}%`,
    valueClassName,
  };
}
