// src/features/home/components/SummaryCards.tsx
//
// 3 サマリカード束ね（昨日売上 / 在庫切れ / 在庫少）。
// 設計: docs/function-design/53-ui-home.md §53.1 / §53.5 / §53.6 (per-card Skeleton 仕様)

import { Skeleton } from "@/components/ui/skeleton";
import type { HomeSummaryState } from "../types";
import { SummaryCard } from "@/components/patterns/SummaryCard";

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export interface SummaryCardsProps {
  summary: HomeSummaryState;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const { sales, lowStock, derived } = summary;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <SummaryCard
        title={`昨日の売上 (${derived.yesterdayLabel})`}
        isLoading={sales.isLoading}
        isError={sales.isError}
        loadingSkeleton={
          <div className="space-y-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-16" />
          </div>
        }
        onRetry={() => void sales.refetch()}
      >
        <div className="space-y-1">
          <div className="text-2xl font-semibold">
            {sales.data ? yenFormatter.format(sales.data.grand_total.amount) : "—"}
          </div>
          <div className="text-sm text-muted-foreground">
            {sales.data ? `${String(sales.data.grand_total.quantity)} 点` : ""}
          </div>
        </div>
      </SummaryCard>

      <SummaryCard
        title="在庫切れ"
        isLoading={lowStock.isLoading}
        isError={lowStock.isError}
        loadingSkeleton={<Skeleton className="h-8 w-12" />}
        onRetry={() => void lowStock.refetch()}
      >
        <div className="text-2xl font-semibold">{derived.outOfStockCount} 件</div>
      </SummaryCard>

      <SummaryCard
        title="在庫少"
        isLoading={lowStock.isLoading}
        isError={lowStock.isError}
        loadingSkeleton={<Skeleton className="h-8 w-12" />}
        onRetry={() => void lowStock.refetch()}
      >
        <div className="text-2xl font-semibold">{derived.lowStockCount} 件</div>
      </SummaryCard>
    </div>
  );
}
