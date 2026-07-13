// src/features/inventory-records/InventoryRecordsPage.tsx
//
// REQ-206: 入出庫履歴ハブ。初回実装は廃棄・破損記録を具体例にする。

import { Eye, PackageSearch } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { ProductPagination } from "@/features/products/components/ProductPagination";
import { commands } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import { queryKeys } from "@/lib/query-keys";
import {
  formatDateTime,
  formatRecordStatus,
  formatRecordType,
  normalizeInventoryRecordsSearch,
  type InventoryRecordsSearch,
} from "./types";

export interface InventoryRecordsPageProps {
  search: InventoryRecordsSearch;
  onSearchChange: (updater: (prev: InventoryRecordsSearch) => InventoryRecordsSearch) => void;
}

const PER_PAGE = 20;

function buildInventoryRecordsReturnTo(search: ReturnType<typeof normalizeInventoryRecordsSearch>) {
  const params = new URLSearchParams();
  if (search.recordType !== "all") params.set("recordType", search.recordType);
  if (search.dateFrom) params.set("dateFrom", search.dateFrom);
  if (search.dateTo) params.set("dateTo", search.dateTo);
  if (search.q) params.set("q", search.q);
  if (search.recordId !== undefined) params.set("recordId", String(search.recordId));
  if (search.departmentId !== undefined) params.set("departmentId", String(search.departmentId));
  if (search.status !== "all") params.set("status", search.status);
  if (search.page > 1) params.set("page", String(search.page));

  const query = params.toString();
  return query ? `/inventory/records?${query}` : "/inventory/records";
}

function buildDetailHref(detailRoute: string, returnTo: string) {
  const separator = detailRoute.includes("?") ? "&" : "?";
  return `${detailRoute}${separator}${new URLSearchParams({ returnTo }).toString()}`;
}

export function InventoryRecordsPage({ search, onSearchChange }: InventoryRecordsPageProps) {
  const normalized = normalizeInventoryRecordsSearch(search);
  const returnTo = buildInventoryRecordsReturnTo(normalized);
  const [keywordDraft, setKeywordDraft] = useState(normalized.q ?? "");
  const isKeywordComposingRef = useRef(false);

  useEffect(() => {
    if (!isKeywordComposingRef.current) {
      setKeywordDraft(normalized.q ?? "");
    }
  }, [normalized.q]);

  const departmentsQuery = useQuery({
    queryKey: queryKeys.inventoryRecords.departments(),
    queryFn: () =>
      unwrapResult(commands.listDepartments(), {
        source: "commands",
        cmd: "list_departments",
      }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    retry: 0,
  });
  const recordsQuery = useQuery({
    queryKey: queryKeys.inventoryRecords.list(normalized),
    queryFn: () =>
      unwrapResult(
        commands.listInventoryRecords({
          record_type: normalized.recordType === "all" ? null : normalized.recordType,
          date_from: normalized.dateFrom ?? null,
          date_to: normalized.dateTo ?? null,
          record_id: normalized.recordId ?? null,
          product_keyword: normalized.q ?? null,
          department_id: normalized.departmentId ?? null,
          status: normalized.status === "all" ? null : normalized.status,
          page: normalized.page,
          per_page: PER_PAGE,
        }),
        { source: "commands", cmd: "list_inventory_records" },
      ),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 0,
  });

  const updateSearch = (patch: Partial<InventoryRecordsSearch>, resetPage = false) => {
    onSearchChange((prev) => ({
      ...prev,
      ...patch,
      page: resetPage ? 1 : (patch.page ?? prev.page),
    }));
  };
  const updateKeywordSearch = (value: string) => {
    updateSearch({ q: value || undefined }, true);
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="入出庫履歴"
        subtitle="入庫・返品・販売出庫・廃棄などの業務記録を後から確認します"
      />

      <section className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label className="text-sm text-muted-foreground" htmlFor="records-type">
              記録種別
            </label>
            <select
              id="records-type"
              className="h-9 w-40 rounded-md border border-input bg-background px-3 text-sm"
              value={normalized.recordType}
              onChange={(event) => {
                updateSearch(
                  { recordType: event.currentTarget.value as InventoryRecordsSearch["recordType"] },
                  true,
                );
              }}
            >
              <option value="all">すべて</option>
              <option value="receiving_record">入庫</option>
              <option value="return_record">返品・交換</option>
              <option value="manual_sale">手動販売出庫</option>
              <option value="disposal_record">廃棄・破損</option>
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-muted-foreground" htmlFor="records-date-from">
              開始日
            </label>
            <input
              id="records-date-from"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              type="date"
              value={normalized.dateFrom ?? ""}
              onChange={(event) => {
                updateSearch({ dateFrom: event.currentTarget.value || undefined }, true);
              }}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-muted-foreground" htmlFor="records-date-to">
              終了日
            </label>
            <input
              id="records-date-to"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              type="date"
              value={normalized.dateTo ?? ""}
              onChange={(event) => {
                updateSearch({ dateTo: event.currentTarget.value || undefined }, true);
              }}
            />
          </div>
          <div className="grid min-w-[18rem] flex-1 gap-1">
            <label className="text-sm text-muted-foreground" htmlFor="records-keyword">
              商品検索
            </label>
            <input
              id="records-keyword"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={keywordDraft}
              placeholder="商品コード・JAN・商品名"
              onChange={(event) => {
                const next = event.currentTarget.value;
                const nativeEvent = event.nativeEvent as InputEvent;
                setKeywordDraft(next);
                if (isKeywordComposingRef.current || nativeEvent.isComposing) {
                  return;
                }
                updateKeywordSearch(next);
              }}
              onCompositionStart={() => {
                isKeywordComposingRef.current = true;
              }}
              onCompositionEnd={(event) => {
                isKeywordComposingRef.current = false;
                const next = event.currentTarget.value;
                setKeywordDraft(next);
                updateKeywordSearch(next);
              }}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-muted-foreground" htmlFor="records-id">
              記録ID
            </label>
            <input
              id="records-id"
              className="h-9 w-28 rounded-md border border-input bg-background px-3 text-sm"
              type="number"
              min="1"
              value={normalized.recordId ?? ""}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateSearch({ recordId: value ? Number(value) : undefined }, true);
              }}
            />
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-muted-foreground" htmlFor="records-department">
              部門
            </label>
            <select
              id="records-department"
              className="h-9 w-44 rounded-md border border-input bg-background px-3 text-sm"
              value={normalized.departmentId ?? "all"}
              disabled={departmentsQuery.isLoading || departmentsQuery.isError}
              onChange={(event) => {
                const value = event.currentTarget.value;
                updateSearch({ departmentId: value === "all" ? undefined : Number(value) }, true);
              }}
            >
              <option value="all">すべて</option>
              {(departmentsQuery.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1">
            <label className="text-sm text-muted-foreground" htmlFor="records-status">
              状態
            </label>
            <select
              id="records-status"
              className="h-9 w-32 rounded-md border border-input bg-background px-3 text-sm"
              value={normalized.status}
              onChange={(event) => {
                updateSearch(
                  { status: event.currentTarget.value as InventoryRecordsSearch["status"] },
                  true,
                );
              }}
            >
              <option value="all">すべて</option>
              <option value="active">有効</option>
            </select>
          </div>
        </div>
      </section>

      {recordsQuery.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : recordsQuery.isError ? (
        <Alert variant="destructive">
          <AlertTitle>入出庫履歴の取得に失敗しました</AlertTitle>
          <AlertDescription>
            検索条件を変えるか、しばらくしてからもう一度お試しください。
          </AlertDescription>
        </Alert>
      ) : recordsQuery.data?.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="入出庫履歴がありません"
          description="検索条件に該当する業務記録はありません"
        />
      ) : recordsQuery.data ? (
        <div className="space-y-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>種別</TableHead>
                <TableHead>記録ID</TableHead>
                <TableHead>業務日付</TableHead>
                <TableHead>代表商品</TableHead>
                <TableHead className="text-right">明細数</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>記録日時</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recordsQuery.data.items.map((record) => (
                <TableRow key={`${record.record_type}-${String(record.record_id)}`}>
                  <TableCell>{formatRecordType(record.record_type)}</TableCell>
                  <TableCell className="font-mono tabular-nums">
                    #{String(record.record_id)}
                  </TableCell>
                  <TableCell>{record.business_date}</TableCell>
                  <TableCell className="min-w-[12rem] whitespace-normal">
                    {record.representative_item}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{record.item_count}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatRecordStatus(record.status)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {formatDateTime(record.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm">
                      <a href={buildDetailHref(record.detail_route, returnTo)}>
                        <Eye aria-hidden="true" />
                        詳細を見る
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <ProductPagination
            page={recordsQuery.data.page}
            perPage={recordsQuery.data.per_page}
            totalCount={recordsQuery.data.total_count}
            onPageChange={(page) => {
              updateSearch({ page });
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
