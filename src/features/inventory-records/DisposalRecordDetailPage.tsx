// src/features/inventory-records/DisposalRecordDetailPage.tsx
//
// REQ-204 / REQ-206: 廃棄・破損記録詳細。

import { ArrowLeft, PackageSearch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { MovementTable } from "@/features/stock-movements/components/MovementTable";
import { commands } from "@/lib/bindings";
import { toCmdError, unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import { formatDateTime, formatRecordStatus, formatYen } from "./types";

export interface DisposalRecordDetailPageProps {
  recordId: number;
  returnTo?: string;
}

const DISPOSAL_TYPE_LABELS: Record<string, string> = {
  disposal: "廃棄",
  damage: "破損",
  other: "その他",
};

function formatQuantity(value: number, unit: string): string {
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}

function normalizeReturnTo(value: string | undefined): string {
  if (value !== undefined && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/inventory/records";
}

export function DisposalRecordDetailPage({ recordId, returnTo }: DisposalRecordDetailPageProps) {
  const backHref = normalizeReturnTo(returnTo);
  const detailQuery = useQuery({
    queryKey: queryKeys.inventoryRecords.disposalDetail(recordId),
    queryFn: () =>
      unwrapResult(commands.getDisposalRecord(recordId), {
        source: "commands",
        cmd: "get_disposal_record",
      }),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 0,
  });

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (detailQuery.isError) {
    const cmdError = toCmdError(detailQuery.error);
    return (
      <div className="space-y-4 p-6">
        <PageHeader title="廃棄・破損詳細" />
        <Alert variant="destructive">
          <AlertTitle>{cmdError.message}</AlertTitle>
          <AlertDescription>
            記録IDを確認するか、入出庫履歴から開き直してください。
          </AlertDescription>
        </Alert>
        <Button asChild variant="outline">
          <a href={backHref}>
            <ArrowLeft aria-hidden="true" />
            前の画面へ戻る
          </a>
        </Button>
      </div>
    );
  }

  const detail = detailQuery.data;
  if (!detail) return null;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title={`廃棄・破損 #${String(detail.id)}`}
        actions={
          <Button asChild variant="outline">
            <a href={backHref}>
              <ArrowLeft aria-hidden="true" />
              前の画面へ戻る
            </a>
          </Button>
        }
      />

      <section className="rounded-md border p-4">
        <div className="grid gap-3 text-sm sm:grid-cols-5">
          <div>
            <span className="text-muted-foreground">廃棄日</span>
            <div className="font-medium">{detail.disposal_date}</div>
          </div>
          <div>
            <span className="text-muted-foreground">状態</span>
            <div>
              <Badge variant="outline">{formatRecordStatus(detail.status)}</Badge>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">明細数</span>
            <div className="font-medium">{detail.items.length} 件</div>
          </div>
          <div>
            <span className="text-muted-foreground">ロス原価合計</span>
            <div className="font-medium">{formatYen(detail.total_loss_cost)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">記録日時</span>
            <div className="font-mono font-medium tabular-nums">
              {formatDateTime(detail.created_at)}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-semibold">明細</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商品コード</TableHead>
              <TableHead>商品名</TableHead>
              <TableHead>部門</TableHead>
              <TableHead>種別</TableHead>
              <TableHead className="text-right">数量</TableHead>
              <TableHead className="text-right">原価</TableHead>
              <TableHead className="text-right">ロス原価</TableHead>
              <TableHead>理由</TableHead>
              <TableHead className="text-right">在庫変動</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detail.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono font-medium">{item.product_code}</TableCell>
                <TableCell className="min-w-[12rem] whitespace-normal">
                  {item.product_name}
                </TableCell>
                <TableCell>{item.department_name}</TableCell>
                <TableCell>
                  {DISPOSAL_TYPE_LABELS[item.disposal_type] ?? item.disposal_type}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(item.quantity, item.stock_unit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatYen(item.cost_price)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatYen(item.line_loss_cost)}
                </TableCell>
                <TableCell className="whitespace-normal">{item.reason}</TableCell>
                <TableCell className="text-right">
                  <a
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href={`/stock/${encodeURIComponent(item.product_code)}/movements`}
                  >
                    {item.product_code} の在庫変動履歴
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3 rounded-md border p-4">
        <h2 className="text-lg font-semibold">関連する在庫変動</h2>
        {detail.movements.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="関連する在庫変動がありません"
            description="この記録に紐づく在庫変動は見つかりません"
          />
        ) : (
          <MovementTable movements={detail.movements} />
        )}
      </section>
    </div>
  );
}
