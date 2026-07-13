// src/features/inventory-records/ReturnRecordDetailPage.tsx
//
// REQ-202 / REQ-206: 返品・交換記録詳細。

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
import { formatDateTime, formatRecordStatus } from "./types";

export interface ReturnRecordDetailPageProps {
  recordId: number;
  returnTo?: string;
}

const RETURN_TYPE_LABELS: Record<string, string> = {
  return: "返品",
  exchange: "交換",
};

const DIRECTION_LABELS: Record<string, string> = {
  in: "戻り（在庫+）",
  out: "渡し（在庫-）",
};

function formatQuantity(value: number, unit: string): string {
  return `${value.toLocaleString("ja-JP")} ${unit}`;
}

function formatRegisterProcessed(value: boolean): string {
  return value ? "レジ戻し済み（CSV取込みで反映）" : "レジ未処理（この保存で反映）";
}

function formatNote(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? "備考なし" : trimmed;
}

function hasNote(value: string | null | undefined): boolean {
  return (value?.trim() ?? "") !== "";
}

function normalizeReturnTo(value: string | undefined): string {
  if (value !== undefined && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/inventory/records";
}

export function ReturnRecordDetailPage({ recordId, returnTo }: ReturnRecordDetailPageProps) {
  const backHref = normalizeReturnTo(returnTo);
  const detailQuery = useQuery({
    queryKey: queryKeys.inventoryRecords.returnDetail(recordId),
    queryFn: () =>
      unwrapResult(commands.getReturnRecord(recordId), {
        source: "commands",
        cmd: "get_return_record",
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
        <PageHeader title="返品・交換詳細" />
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
        title={`返品・交換 #${String(detail.id)}`}
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
        <div className="grid gap-3 text-sm sm:grid-cols-6">
          <div>
            <span className="text-muted-foreground">返品日</span>
            <div className="font-medium">{detail.return_date}</div>
          </div>
          <div>
            <span className="text-muted-foreground">種別</span>
            <div className="font-medium">
              {RETURN_TYPE_LABELS[detail.return_type] ?? detail.return_type}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">レジ戻し</span>
            <div className="font-medium">{formatRegisterProcessed(detail.register_processed)}</div>
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
            <span className="text-muted-foreground">記録日時</span>
            <div className="font-mono font-medium tabular-nums">
              {formatDateTime(detail.created_at)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <span className="text-muted-foreground">レシート画像</span>
            <div className="font-medium">{detail.receipt_image_path ? "添付あり" : "添付なし"}</div>
            {detail.receipt_image_path ? (
              <p className="font-mono text-muted-foreground">{detail.receipt_image_path}</p>
            ) : null}
          </div>
          <section aria-label="備考" className="space-y-1">
            <span className="text-muted-foreground">備考</span>
            <p
              className={
                hasNote(detail.note)
                  ? "whitespace-pre-wrap text-foreground"
                  : "text-muted-foreground"
              }
            >
              {formatNote(detail.note)}
            </p>
          </section>
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
              <TableHead>方向</TableHead>
              <TableHead className="text-right">数量</TableHead>
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
                  <Badge variant="outline">
                    {DIRECTION_LABELS[item.direction] ?? item.direction}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatQuantity(item.quantity, item.stock_unit)}
                </TableCell>
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
            description="レジ戻し済みの返品・交換はこの画面では在庫を動かしません"
          />
        ) : (
          <MovementTable movements={detail.movements} />
        )}
      </section>
    </div>
  );
}
