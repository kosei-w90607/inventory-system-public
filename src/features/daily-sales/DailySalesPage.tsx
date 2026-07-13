// src/features/daily-sales/DailySalesPage.tsx
//
// UI-09a 日次売上レポート画面の最上位コンポーネント。
// route 結線は commit 5 の src/routes/reports/daily.tsx で実施、本コンポーネントは
// search + onSearchChange を props として受け取り testable に保つ。
// 設計: docs/function-design/56-ui-daily-sales.md §56.1 + §56.3 + §56.8

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/patterns/PageHeader";
import { DateNavigator } from "./components/DateNavigator";
import { DepartmentFilter } from "@/components/patterns/DepartmentFilter";
import { ExportBar } from "./components/ExportBar";
import { ProductTable } from "./components/ProductTable";
import { SummaryCardsBar } from "./components/SummaryCardsBar";
import { TabsHeader } from "@/components/sales/TabsHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDailySalesReport } from "./hooks/useDailySalesReport";
import { useExportDailySalesCsv } from "./hooks/useExportDailySalesCsv";
import { useTodayDate } from "./lib/date-nav";
import type { OfficialDailyReportSummary } from "@/lib/bindings";
import type { SortColumn, SortDirection } from "./types";

export interface DailySalesSearch {
  date?: string;
  dept?: number;
  sortBy?: SortColumn;
  sortDir?: SortDirection;
}

export interface DailySalesPageProps {
  search: DailySalesSearch;
  /// 関数形式 updater で TanStack Router の navigate({ search: (prev) => ... }) を呼ぶ wrapper。
  onSearchChange: (updater: (prev: DailySalesSearch) => DailySalesSearch) => void;
}

export function DailySalesPage({ search, onSearchChange }: DailySalesPageProps) {
  const today = useTodayDate();

  const date = search.date ?? today;
  const dept = search.dept ?? null;
  const sortBy = search.sortBy ?? null;
  const sortDir = search.sortDir ?? "asc";

  const {
    today: todayQ,
    yesterday: yesterdayQ,
    derived,
  } = useDailySalesReport({
    date,
    dept,
    sortBy,
    sortDir,
  });
  const { exportCsv, isExporting } = useExportDailySalesCsv();

  const handleDateChange = (newDate: string) => {
    onSearchChange((prev) => ({ ...prev, date: newDate }));
  };

  const handleDeptChange = (deptId: number | null) => {
    onSearchChange((prev) => ({ ...prev, dept: deptId ?? undefined }));
  };

  const handleSortChange = (column: SortColumn) => {
    const nextDir: SortDirection = sortBy === column && sortDir === "asc" ? "desc" : "asc";
    onSearchChange((prev) => ({ ...prev, sortBy: column, sortDir: nextDir }));
  };

  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader title="日次売上" />

      <TabsHeader />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <DateNavigator date={date} onChange={handleDateChange} />
        <DepartmentFilter
          options={derived.departmentOptions}
          selected={dept}
          onChange={handleDeptChange}
          widthClass="w-[10rem]"
          idPrefix="dept-filter"
        />
      </div>

      {todayQ.isError ? (
        <Alert variant="destructive">
          <AlertTitle>当日の売上データを取得できませんでした</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{todayQ.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void todayQ.refetch();
              }}
            >
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <SummaryCardsBar
            today={todayQ.data}
            yesterday={yesterdayQ.data}
            summary={derived.summary}
            isLoading={todayQ.isLoading}
            yesterdayError={yesterdayQ.isError}
          />

          {todayQ.data && <OfficialDailyReportSection report={todayQ.data.official_daily_report} />}

          <ProductTable
            grouped={derived.grouped}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={handleSortChange}
            grandTotal={
              todayQ.data
                ? {
                    quantity: todayQ.data.grand_total.quantity,
                    amount: todayQ.data.grand_total.amount,
                  }
                : null
            }
            emptyTitle={
              todayQ.data?.official_daily_report
                ? "商品別明細は未取込み"
                : "該当する売上明細がありません"
            }
            emptyDescription={
              todayQ.data?.official_daily_report
                ? "レジ日報の公式集計は表示中です。商品別明細はZ004または手動販売の取込み後に表示されます。"
                : "日付や部門を変更してお試しください"
            }
          />

          <div className="flex justify-end">
            <ExportBar
              onExportCsv={() => {
                exportCsv({ date });
              }}
              isExporting={isExporting}
            />
          </div>
        </>
      )}
    </div>
  );
}

function OfficialDailyReportSection({ report }: { report: OfficialDailyReportSummary | null }) {
  return (
    <section className="space-y-3" aria-labelledby="official-daily-report-title">
      <div>
        <h2 id="official-daily-report-title" className="text-lg font-semibold">
          レジ日報（公式）
        </h2>
        <p className="text-sm text-muted-foreground">
          Z001 / Z002 / Z005 日報から保存した公式集計です。
        </p>
      </div>

      {report === null ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          この日付のレジ日報は未取込みです。
        </p>
      ) : (
        <div className="space-y-4 rounded-md border p-4">
          {report.warnings.length > 0 && (
            <Alert className="border-warning bg-warning-soft text-warning-strong">
              <AlertCircle className="size-4" aria-hidden="true" />
              <AlertTitle>日報の部門確認が必要です</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5">
                  {report.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <dl className="grid gap-3 sm:grid-cols-2">
            <OfficialMetric label="総売上" value={formatMoney(report.gross_amount)} />
            <OfficialMetric label="純売上" value={formatMoney(report.net_amount)} />
          </dl>

          <div className="grid gap-4 lg:grid-cols-2">
            <OfficialLinesTable
              title="支払集計"
              rows={report.payment_lines.map((line) => ({
                key: line.payment_key,
                label: line.label,
                amount: formatMoney(line.amount),
                quantity: line.count === null ? "—" : `${line.count.toLocaleString("ja-JP")} 件`,
              }))}
              quantityLabel="件数"
            />
            <OfficialLinesTable
              title="部門別集計"
              rows={report.department_lines.map((line, index) => ({
                key: `${line.department_id === null ? "unmatched" : String(line.department_id)}-${String(index)}`,
                label: line.normalized_department_name ?? line.raw_department_name,
                amount: formatMoney(line.amount),
                quantity:
                  line.quantity === null ? "—" : `${line.quantity.toLocaleString("ja-JP")} 点`,
              }))}
              quantityLabel="数量"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function OfficialMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function OfficialLinesTable({
  title,
  rows,
  quantityLabel,
}: {
  title: string;
  rows: { key: string; label: string; amount: string; quantity: string }[];
  quantityLabel: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead className="text-right">{quantityLabel}</TableHead>
              <TableHead className="text-right">金額</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>{row.label}</TableCell>
                <TableCell className="text-right">{row.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{row.amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatMoney(value: number | null) {
  return value === null ? "未取得" : `¥${value.toLocaleString("ja-JP")}`;
}
