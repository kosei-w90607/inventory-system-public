// src/components/patterns/SummaryCard.tsx
//
// 単一サマリカード。loading / error / data の 3 状態。
// 設計: docs/function-design/53-ui-home.md §53.5 / §53.6

import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface SummaryCardProps {
  title: string;
  isLoading: boolean;
  isError: boolean;
  /// data 時に表示する子要素。loading / error 時は無視される。
  children: ReactNode;
  /// loading 時の Skeleton。default は h-8 w-32（金額系）。
  loadingSkeleton?: ReactNode;
  /// 「再試行」ボタンの onClick。useQuery({ refetch }) を渡す想定。
  onRetry: () => void;
}

export function SummaryCard({
  title,
  isLoading,
  isError,
  children,
  loadingSkeleton,
  onRetry,
}: SummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          (loadingSkeleton ?? <Skeleton className="h-8 w-32" />)
        ) : isError ? (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>取得失敗</span>
              <Button variant="outline" size="sm" onClick={onRetry}>
                再試行
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
