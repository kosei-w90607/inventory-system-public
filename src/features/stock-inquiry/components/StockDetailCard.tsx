// src/features/stock-inquiry/components/StockDetailCard.tsx
//
// 商品詳細フォールバックカード。list 成功時は ProductListTable が選択行直下に
// StockDetailContent を行インライン展開するため、本カードは「list 失敗 + selected!=null」の
// フォールバック経路でのみ使う（StockDetailContent を Card で包み独立描画、部分障害許容）。
// detail query 失敗時はカード内 inline エラー（StockDetailContent が担う、一覧は維持）。
// 設計: docs/function-design/58-ui-stock-inquiry.md §58.7 / §58.8

import type { UseQueryResult } from "@tanstack/react-query";
import type { StockDetail } from "@/lib/bindings";
import { Card } from "@/components/ui/card";
import { StockDetailContent } from "./StockDetailContent";

export interface StockDetailCardProps {
  query: UseQueryResult<StockDetail>;
}

export function StockDetailCard({ query }: StockDetailCardProps) {
  return (
    <Card className="mt-2">
      <StockDetailContent query={query} />
    </Card>
  );
}
