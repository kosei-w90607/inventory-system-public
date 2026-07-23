import { ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
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
import { ProductPagination } from "@/features/products/components/ProductPagination";
import { commands, type OperationLog } from "@/lib/bindings";
import { unwrapResult } from "@/lib/invoke";
import {
  OPERATION_TYPE_LABELS,
  OPERATION_TYPE_ORDER,
  operationTypeLabel,
} from "./operation-type-labels";
import { normalizeOperationLogsSearch, type OperationLogsSearch } from "./types";

const PER_PAGE = 20;
const KNOWN_KEYS: Partial<Record<string, string>> = {
  file_name: "ファイル名",
  size_bytes: "サイズ（バイト）",
  count: "件数",
  product_code: "商品コード",
  record_id: "関連記録ID",
  record_type: "関連記録種別",
};
const RELATED: Partial<Record<string, string>> = {
  receiving_record: "/inventory/receiving/records/",
  return_record: "/inventory/return/records/",
  manual_sale: "/inventory/manual-sale/records/",
  disposal_record: "/inventory/disposal/records/",
};

function displayValue(value: unknown) {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function parseDetail(raw: string | null) {
  if (!raw?.trim()) return { kind: "empty" as const };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return { kind: "invalid" as const, raw };
    return { kind: "object" as const, raw, parsed: parsed as Record<string, unknown> };
  } catch {
    return { kind: "invalid" as const, raw };
  }
}

interface IntegrityAdjustment {
  productCode: string;
  oldStock: number;
  newStock: number;
  adjustment: number;
}

function parseIntegrityAdjustments(
  log: OperationLog,
  detail: ReturnType<typeof parseDetail>,
): IntegrityAdjustment[] | null {
  if (log.operation_type !== "integrity_fix" || detail.kind !== "object") return null;
  const value = detail.parsed.adjustments;
  if (!Array.isArray(value) || value.length === 0) return null;
  const adjustments: IntegrityAdjustment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.product_code !== "string" ||
      typeof candidate.old_stock !== "number" ||
      !Number.isSafeInteger(candidate.old_stock) ||
      typeof candidate.new_stock !== "number" ||
      !Number.isSafeInteger(candidate.new_stock) ||
      typeof candidate.adjustment !== "number" ||
      !Number.isSafeInteger(candidate.adjustment)
    ) {
      return null;
    }
    adjustments.push({
      productCode: candidate.product_code,
      oldStock: candidate.old_stock,
      newStock: candidate.new_stock,
      adjustment: candidate.adjustment,
    });
  }
  return adjustments;
}

function Detail({ log }: { log: OperationLog }) {
  const detail = parseDetail(log.detail_json);
  if (detail.kind === "empty") return <p>詳細情報はありません</p>;
  const raw = detail.kind === "object" ? JSON.stringify(detail.parsed, null, 2) : detail.raw;
  const truncatedRaw =
    raw.length > 50_000 ? `${raw.slice(0, 50_000)}\n以降は長すぎるため省略しました` : raw;
  const entries = detail.kind === "object" ? Object.entries(detail.parsed) : [];
  const adjustments = parseIntegrityAdjustments(log, detail);
  const summaryEntries = adjustments ? entries.filter(([key]) => key !== "adjustments") : entries;
  const shown = detail.raw.length > 10_000 ? summaryEntries.slice(0, 20) : summaryEntries;
  const recordType =
    detail.kind === "object" && typeof detail.parsed.record_type === "string"
      ? detail.parsed.record_type
      : undefined;
  const recordId =
    detail.kind === "object" &&
    typeof detail.parsed.record_id === "number" &&
    Number.isSafeInteger(detail.parsed.record_id) &&
    detail.parsed.record_id > 0
      ? detail.parsed.record_id
      : undefined;
  return (
    <div className="space-y-3">
      <p className="break-words whitespace-pre-wrap">{log.summary}</p>
      {detail.kind === "invalid" ? (
        <p>詳細情報を解析できませんでした</p>
      ) : (
        <dl
          role="group"
          aria-label="ログ詳細の要約"
          className="grid gap-2 sm:grid-cols-[10rem_1fr]"
        >
          {shown.map(([key, value]) => (
            <div className="contents" key={key}>
              <dt className="font-medium">{KNOWN_KEYS[key] ?? key}</dt>
              <dd className="font-mono text-sm break-all">{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {summaryEntries.length > shown.length && (
        <p>他 {summaryEntries.length - shown.length} 件のフィールドは技術情報でご確認ください</p>
      )}
      {adjustments && (
        <section aria-label="整合性補正の内容" className="space-y-2 rounded-md border p-3">
          <h4 className="font-medium">補正内容</h4>
          <ul className="divide-y">
            {adjustments.slice(0, 20).map((adjustment, index) => (
              <li
                key={`${adjustment.productCode}-${String(index)}`}
                className="grid gap-1 py-2 sm:grid-cols-[minmax(8rem,1fr)_auto_auto] sm:items-center sm:gap-4"
              >
                <span className="font-mono font-medium break-all">{adjustment.productCode}</span>
                <span className="tabular-nums">
                  旧在庫 {adjustment.oldStock.toLocaleString("ja-JP")} → 新在庫{" "}
                  {adjustment.newStock.toLocaleString("ja-JP")}
                </span>
                <span className="tabular-nums">
                  差分 {adjustment.adjustment > 0 ? "+" : ""}
                  {adjustment.adjustment.toLocaleString("ja-JP")}
                </span>
              </li>
            ))}
          </ul>
          {adjustments.length > 20 && (
            <p>他 {adjustments.length - 20} 件は技術情報（JSON）で確認</p>
          )}
        </section>
      )}
      {recordType && recordId && RELATED[recordType] && (
        <Button asChild variant="outline" size="sm">
          <a href={`${RELATED[recordType]}${String(recordId)}`}>関連記録を見る</a>
        </Button>
      )}
      <details>
        <summary className="cursor-pointer font-medium">技術情報（JSON）</summary>
        <div className="mt-2 space-y-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(raw);
            }}
          >
            コピー
          </Button>
          <pre className="max-h-80 overflow-auto rounded bg-muted p-3 text-xs break-all whitespace-pre-wrap">
            {truncatedRaw}
          </pre>
        </div>
      </details>
    </div>
  );
}

export function OperationLogsPage({
  search,
  onSearchChange,
}: {
  search: OperationLogsSearch;
  onSearchChange: (updater: (prev: OperationLogsSearch) => OperationLogsSearch) => void;
}) {
  const now = new Date();
  const normalized = normalizeOperationLogsSearch(search, now);
  const invalidRange =
    normalized.start_date !== undefined &&
    normalized.end_date !== undefined &&
    normalized.start_date > normalized.end_date;
  const [lastCommittedValidSearch, setLastCommittedValidSearch] = useState(normalized);
  const effectiveSearch = invalidRange ? lastCommittedValidSearch : normalized;
  useEffect(() => {
    if (invalidRange) return;
    setLastCommittedValidSearch({
      start_date: normalized.start_date,
      end_date: normalized.end_date,
      operation_type: normalized.operation_type,
      page: normalized.page,
    });
  }, [
    invalidRange,
    normalized.start_date,
    normalized.end_date,
    normalized.operation_type,
    normalized.page,
  ]);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    setExpanded(null);
  }, [
    effectiveSearch.start_date,
    effectiveSearch.end_date,
    effectiveSearch.operation_type,
    effectiveSearch.page,
  ]);
  const typesQuery = useQuery<string[]>({
    queryKey: ["settings", "logOperationTypes"],
    queryFn: () =>
      unwrapResult(commands.listLogOperationTypes(), {
        source: "commands",
        cmd: "list_log_operation_types",
      }),
    staleTime: 0,
    gcTime: 300_000,
    retry: 0,
  });
  const logsQuery = useQuery({
    queryKey: ["settings", "logs", effectiveSearch],
    queryFn: () =>
      unwrapResult(
        commands.listLogs({
          page: effectiveSearch.page,
          per_page: PER_PAGE,
          operation_type: effectiveSearch.operation_type ?? null,
          start_date: effectiveSearch.start_date ?? null,
          end_date: effectiveSearch.end_date ?? null,
        }),
        { source: "commands", cmd: "list_logs" },
      ),
    enabled: !invalidRange,
    staleTime: 0,
    gcTime: 300_000,
    retry: 0,
  });
  const typeValues = useMemo<string[]>(() => {
    const available = Array.from(
      new Set([
        ...(typesQuery.data ?? []),
        ...(normalized.operation_type ? [normalized.operation_type] : []),
      ]),
    );
    const availableSet = new Set(available);
    const known = OPERATION_TYPE_ORDER.filter((value) => availableSet.has(value));
    const unknown = available.filter((value) => OPERATION_TYPE_LABELS[value] === undefined);
    return [...known, ...unknown];
  }, [typesQuery.data, normalized.operation_type]);
  const grouped = useMemo(() => {
    const result = new Map<string, string[]>();
    for (const value of typeValues) {
      const category = OPERATION_TYPE_LABELS[value]?.category ?? "その他";
      result.set(category, [...(result.get(category) ?? []), value]);
    }
    return result;
  }, [typeValues]);
  const update = (patch: Partial<OperationLogsSearch>, reset = false) => {
    onSearchChange((prev) => ({ ...prev, ...patch, page: reset ? 1 : (patch.page ?? prev.page) }));
  };
  const updateDate = (field: "start_date" | "end_date", value: string) => {
    const otherField = field === "start_date" ? "end_date" : "start_date";
    onSearchChange((prev) => {
      const previous = normalizeOperationLogsSearch(prev, now);
      return {
        ...prev,
        [field]: value,
        [otherField]: prev[otherField] ?? previous[otherField] ?? "",
        page: 1,
      };
    });
  };
  const defaults = normalizeOperationLogsSearch({}, now);
  const defaultFilter =
    normalized.start_date === defaults.start_date &&
    normalized.end_date === defaults.end_date &&
    !normalized.operation_type;
  const outOfRange =
    !!logsQuery.data &&
    logsQuery.data.items.length === 0 &&
    logsQuery.data.total_count > 0 &&
    effectiveSearch.page > 1;
  return (
    <div className="space-y-5 p-6">
      <PageHeader title="操作ログ" subtitle="システムの操作履歴を期間・種別で確認します" />
      <section className="space-y-3 rounded-md border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <label htmlFor="log-start" className="text-sm text-muted-foreground">
              開始日
            </label>
            <input
              id="log-start"
              type="date"
              value={normalized.start_date ?? ""}
              className="h-9 rounded-md border px-3"
              onChange={(e) => {
                updateDate("start_date", e.currentTarget.value);
              }}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="log-end" className="text-sm text-muted-foreground">
              終了日
            </label>
            <input
              id="log-end"
              type="date"
              value={normalized.end_date ?? ""}
              className="h-9 rounded-md border px-3"
              onChange={(e) => {
                updateDate("end_date", e.currentTarget.value);
              }}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor="log-type" className="text-sm text-muted-foreground">
              種別
            </label>
            <select
              id="log-type"
              value={normalized.operation_type ?? ""}
              className="h-9 min-w-52 rounded-md border px-3"
              onChange={(e) => {
                update({ operation_type: e.currentTarget.value || undefined }, true);
              }}
            >
              <option value="">すべて</option>
              {Array.from(grouped.entries()).map(([category, values]) => (
                <optgroup key={category} label={category}>
                  {values.map((value) => (
                    <option key={value} value={value}>
                      {operationTypeLabel(value)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        {invalidRange && (
          <p role="alert" className="text-sm text-destructive">
            開始日は終了日と同じ日か、それより前の日付にしてください
          </p>
        )}
      </section>
      {logsQuery.isLoading && !invalidRange && (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-12" />
          ))}
        </div>
      )}
      {logsQuery.isError && (
        <Alert variant="destructive">
          <AlertTitle>操作ログの取得に失敗しました</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{logsQuery.error.message}</p>
            <Button type="button" variant="outline" onClick={() => void logsQuery.refetch()}>
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {outOfRange && (
        <EmptyState
          icon={ScrollText}
          title="このページには表示するログがありません"
          description="先頭ページから確認してください"
          action={
            <Button
              onClick={() => {
                update({ page: 1 });
              }}
            >
              先頭ページに戻る
            </Button>
          }
        />
      )}
      {logsQuery.data && !outOfRange && logsQuery.data.items.length === 0 && (
        <EmptyState
          icon={ScrollText}
          title={
            defaultFilter ? "この30日間の操作ログはありません" : "該当する操作ログがありません"
          }
          description={
            defaultFilter
              ? "期間や種別を変更すると他のログを確認できます"
              : "期間や種別を変更してください"
          }
        />
      )}
      {logsQuery.data && logsQuery.data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">日時</TableHead>
                  <TableHead className="w-52">種別</TableHead>
                  <TableHead>概要</TableHead>
                  <TableHead className="w-40">詳細</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsQuery.data.items.map((item) => (
                  <Fragment key={item.id}>
                    <TableRow>
                      <TableCell>{item.created_at.replace("T", " ")}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            OPERATION_TYPE_LABELS[item.operation_type] === undefined
                              ? "outline"
                              : "secondary"
                          }
                        >
                          {operationTypeLabel(item.operation_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-0 truncate" title={item.summary}>
                        {item.summary}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-expanded={expanded === item.id}
                          aria-controls={`log-detail-${String(item.id)}`}
                          aria-label={expanded === item.id ? "詳細を閉じる" : "詳細を表示"}
                          onClick={() => {
                            setExpanded((current) => (current === item.id ? null : item.id));
                          }}
                        >
                          {expanded === item.id ? (
                            <ChevronUp aria-hidden="true" />
                          ) : (
                            <ChevronDown aria-hidden="true" />
                          )}
                          {expanded === item.id ? "詳細を閉じる" : "詳細を表示"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expanded === item.id && (
                      <TableRow id={`log-detail-${String(item.id)}`}>
                        <TableCell colSpan={4}>
                          <Detail log={item} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
          <ProductPagination
            page={effectiveSearch.page}
            perPage={PER_PAGE}
            totalCount={logsQuery.data.total_count}
            onPageChange={(page) => {
              update({ page });
            }}
          />
        </>
      )}
    </div>
  );
}
