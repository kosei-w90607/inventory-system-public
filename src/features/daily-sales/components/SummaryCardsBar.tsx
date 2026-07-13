// src/features/daily-sales/components/SummaryCardsBar.tsx
//
// 4 カード: 売上合計 / 販売点数 / 売上明細数 (user Option 1.5) / 前日比 (部分障害許容)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.7 + §56.8

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DailySalesReport } from "@/lib/bindings";
import type { SalesLineSummary } from "../types";

const SUMMARY_TOOLTIP = "売上レコード行数ベース。レシート単位の取引件数は後続仕様で定義。";

export interface SummaryCardsBarProps {
  today: DailySalesReport | undefined;
  yesterday: DailySalesReport | undefined;
  summary: SalesLineSummary;
  isLoading: boolean;
  yesterdayError: boolean;
}

export function SummaryCardsBar({
  today,
  yesterday,
  summary,
  isLoading,
  yesterdayError,
}: SummaryCardsBarProps) {
  if (isLoading || today === undefined) {
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

  const compareLabel = computeCompareLabel(today, yesterday, yesterdayError);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SimpleCard title="売上合計" value={`¥${today.grand_total.amount.toLocaleString("ja-JP")}`} />
      <SimpleCard title="販売点数" value={`${String(today.grand_total.quantity)} 点`} />
      <CardWithTooltip
        title="売上明細数"
        value={`${String(summary.total)} 件`}
        sub={`自動 ${String(summary.autoCount)} / 手動 ${String(summary.manualCount)}`}
        tooltip={SUMMARY_TOOLTIP}
      />
      <SimpleCard
        title="前日比"
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
  // Card は flex flex-col のため grid item の min-width:auto で縮まらず、長い金額でカードが
  // 溢れる。Card + CardContent 両方に min-w-0 を付け value div を truncate する (PR-3 (f))。
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

interface CardWithTooltipProps extends SimpleCardProps {
  tooltip: string;
}

function CardWithTooltip({ title, value, sub, tooltip }: CardWithTooltipProps) {
  return (
    <TooltipProvider delayDuration={700}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Card は TooltipTrigger asChild の子のため min-w-0 は Card 自身に付与する (PR-3 (f)) */}
          <Card tabIndex={0} className="min-w-0">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <div className="truncate text-2xl font-semibold">{value}</div>
              {sub !== undefined && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface CompareLabel {
  value: string;
  sub: string | null;
  valueClassName?: string;
}

function computeCompareLabel(
  today: DailySalesReport,
  yesterday: DailySalesReport | undefined,
  yesterdayError: boolean,
): CompareLabel {
  if (yesterdayError) return { value: "比較データなし", sub: null };
  if (yesterday === undefined) return { value: "—", sub: null };
  const yAmount = yesterday.grand_total.amount;
  if (yAmount === 0) return { value: "比較不可", sub: "前日売上 0 円" };
  const diff = today.grand_total.amount - yAmount;
  const pct = (diff / yAmount) * 100;
  const sign = diff >= 0 ? "+" : "-";
  const absDiff = Math.abs(diff).toLocaleString("ja-JP");
  const valueClassName = diff >= 0 ? "text-success-emphasis" : "text-destructive";
  return {
    value: `${sign}¥${absDiff}`,
    sub: `${sign}${pct.toFixed(1)}%`,
    valueClassName,
  };
}
