// src/features/monthly-sales/MonthlySalesPage.tsx
//
// UI-09b 月次売上レポート画面の最上位コンポーネント。
// 1 useQuery + 派生 6 純関数 (Q-5) + 失敗 4 状態の出し分け。
// route 結線は src/routes/reports/monthly.tsx で実施、本コンポーネントは props 経由で受け取り testable に保つ。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.1 / §57.4 / §57.7 / §57.8

import { useMemo } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { OfficialMonthlyDepartmentTotal, SalesMode, SalesReportType } from "@/lib/bindings";
import { EmptyState } from "@/components/patterns/EmptyState";
import { PageHeader } from "@/components/patterns/PageHeader";
import { useExportFile } from "@/lib/hooks/useExportFile";
import { TabsHeader } from "@/components/sales/TabsHeader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DepartmentTable } from "./components/DepartmentTable";
import { ExportBar } from "./components/ExportBar";
import { ModeTabs } from "./components/ModeTabs";
import { MonthNavigator } from "./components/MonthNavigator";
import { ProductRankingTable } from "./components/ProductRankingTable";
import { SummaryCardsBar } from "./components/SummaryCardsBar";
import { useMonthlySalesReport } from "./hooks/useMonthlySalesReport";
import { formatYearMonth } from "./lib/format-month-label";
import type { SortColumn, SortDirection } from "./types";

export interface MonthlySalesSearch {
  month?: string;
  mode?: SalesMode;
  sortBy?: SortColumn;
  sortDir?: SortDirection;
}

export interface MonthlySalesPageProps {
  search: MonthlySalesSearch;
  onSearchChange: (updater: (prev: MonthlySalesSearch) => MonthlySalesSearch) => void;
}

export function MonthlySalesPage({ search, onSearchChange }: MonthlySalesPageProps) {
  const currentMonth = useMemo(() => formatYearMonth(new Date()), []);

  const month = search.month ?? currentMonth;
  const mode: SalesMode = search.mode ?? "by_product";
  const sortBy = search.sortBy ?? null;
  const sortDir: SortDirection = search.sortDir ?? "asc";

  const { query, derived } = useMonthlySalesReport({ month, mode, sortBy, sortDir });
  const { exportFile, isExporting } = useExportFile();

  const handleMonthChange = (newMonth: string) => {
    onSearchChange((prev) => ({ ...prev, month: newMonth }));
  };

  const handleModeChange = (newMode: SalesMode) => {
    onSearchChange((prev) => ({ ...prev, mode: newMode }));
  };

  const handleSortChange = (column: SortColumn) => {
    const nextDir: SortDirection = sortBy === column && sortDir === "asc" ? "desc" : "asc";
    onSearchChange((prev) => ({ ...prev, sortBy: column, sortDir: nextDir }));
  };

  const handleExport = () => {
    const reportType: SalesReportType =
      mode === "by_department" ? "monthly_by_department" : "monthly_by_product";
    exportFile({ reportType, target: month });
  };

  return (
    <div className="min-h-screen space-y-6 p-6">
      <PageHeader title="月次売上" />

      <TabsHeader />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <MonthNavigator month={month} onChange={handleMonthChange} />
        <ModeTabs mode={mode} onChange={handleModeChange} />
      </div>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>月次売上データを取得できませんでした</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{query.error.message}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void query.refetch();
              }}
            >
              再試行
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <SummaryCardsBar
            summary={derived?.summary ?? { totalAmount: 0, totalQuantity: 0 }}
            periodLabel={derived?.periodLabel ?? "—"}
            prevComparison={query.data?.prev_month_comparison ?? null}
            isLoading={query.isLoading || derived === null}
          />

          {query.data && derived && (
            <>
              <OfficialDepartmentTotalsSection rows={query.data.official_department_totals} />

              {query.data.items.length === 0 ? (
                // 意図的差分③: bare div → EmptyState 標準 UI（catalog ⑥）。既存 2 文を title + description に正規移植（文言維持）
                <EmptyState title="当月データなし" description="月を変更してお試しください。" />
              ) : mode === "by_department" ? (
                <DepartmentTable
                  rows={derived.composition}
                  comparisonMap={derived.comparisonMap}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortChange={handleSortChange}
                />
              ) : (
                <ProductRankingTable
                  rows={derived.ranking}
                  comparisonMap={derived.comparisonMap}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortChange={handleSortChange}
                />
              )}

              <div className="flex justify-end">
                <ExportBar onExportCsv={handleExport} isExporting={isExporting} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function OfficialDepartmentTotalsSection({
  rows,
}: {
  rows: OfficialMonthlyDepartmentTotal[] | null;
}) {
  return (
    <section className="space-y-3" aria-labelledby="official-monthly-department-title">
      <div>
        <h2 id="official-monthly-department-title" className="text-lg font-semibold">
          公式部門集計（レジ日報由来）
        </h2>
        <p className="text-sm text-muted-foreground">
          日報取込み済み日の Z005 部門別売上合計です。
        </p>
      </div>

      {rows === null ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          この月のレジ日報は未取込みです。
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          公式部門集計の行はありません。
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>部門</TableHead>
                <TableHead className="text-right">数量</TableHead>
                <TableHead className="text-right">件数</TableHead>
                <TableHead className="text-right">金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow
                  key={`${row.department_id === null ? "unmatched" : String(row.department_id)}-${String(index)}`}
                >
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right">
                    {row.quantity === null ? "—" : row.quantity.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.count === null ? "—" : row.count.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    ¥{row.amount.toLocaleString("ja-JP")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
