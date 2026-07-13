// src/features/stock-inquiry/components/StockDetailContent.tsx
//
// 商品詳細の内側描画（在庫数 / 売価 / 原価 / 最終入庫日 / 最終販売日 + 遷移 CTA × 3）。
// query の isLoading / isError / data 全状態を内包する。行インライン展開（colSpan td 内）
// と list 失敗時フォールバックカード（StockDetailCard が Card で包む）で共用する。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7 / §58.8

import type { UseQueryResult } from "@tanstack/react-query";
import { History } from "lucide-react";
import type { StockDetail } from "@/lib/bindings";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatStockDisplay } from "../lib/format-stock-display";
import { formatLastDate } from "../lib/format-last-date";

export interface StockDetailContentProps {
  query: UseQueryResult<StockDetail>;
}

const priceFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
});

/** 将来実装予定の遷移ボタン（HTML disabled は Tooltip 不発のため aria-disabled パターン）。 */
function DisabledCta({ label, hint }: { label: string; hint: string }) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            aria-disabled="true"
            tabIndex={0}
            className="inline-flex cursor-not-allowed items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium opacity-60"
            onClick={(e) => {
              e.preventDefault();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
              }
            }}
          >
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ActiveCta({ label, href }: { label: string; href: string }) {
  return (
    <Button type="button" asChild variant="outline" size="sm">
      <a href={href}>
        <History aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}

export function StockDetailContent({ query }: StockDetailContentProps) {
  if (query.isLoading) {
    return (
      <CardContent className="space-y-2 py-4">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </CardContent>
    );
  }

  if (query.isError) {
    return (
      <CardContent className="py-4 text-sm text-destructive">
        商品詳細の取得に失敗しました。別の商品を選び直すか、再度お試しください。
      </CardContent>
    );
  }

  if (query.data) {
    return (
      <>
        <CardHeader>
          <CardTitle className="text-base">
            {query.data.product.name}
            <span className="ml-2 font-mono text-sm font-medium text-muted-foreground">
              {query.data.product.product_code}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <DetailRow
              label="在庫数"
              value={formatStockDisplay(
                query.data.product.stock_quantity,
                query.data.product.stock_unit,
              )}
            />
            <DetailRow
              label="売価"
              value={priceFormatter.format(query.data.product.selling_price)}
            />
            <DetailRow label="原価" value={priceFormatter.format(query.data.product.cost_price)} />
            <DetailRow label="最終入庫日" value={formatLastDate(query.data.last_receiving_date)} />
            <DetailRow label="最終販売日" value={formatLastDate(query.data.last_sale_date)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <DisabledCta label="商品修正" hint="Phase 3 で実装予定" />
            <ActiveCta
              label="在庫変動履歴"
              href={`/stock/${encodeURIComponent(query.data.product.product_code)}/movements`}
            />
            <DisabledCta label="入庫記録" hint="Phase 3 で実装予定" />
          </div>
        </CardContent>
      </>
    );
  }

  return null;
}
