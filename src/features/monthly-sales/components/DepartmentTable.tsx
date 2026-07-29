// src/features/monthly-sales/components/DepartmentTable.tsx
//
// 部門別構成比テーブル (4 列: 部門 / 売上 / 構成比 (数値 + Progress バー) / 前月比、
// Q-4 BIZ-05 DTO に商品数 field 不在のため非対応、Plans.md Backlog 参照)。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7

import { EmptyState } from "@/components/patterns/EmptyState";
import { SortableHeader } from "@/components/sales/SortableHeader";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  monthlySortDescriptorsForMode,
  type ComparisonInfo,
  type DeptCompositionRow,
  type SortColumn,
  type SortDirection,
} from "../types";
import { ComparisonCell } from "./comparison-cell";

export interface DepartmentTableProps {
  rows: readonly DeptCompositionRow[];
  comparisonMap: ReadonlyMap<string, ComparisonInfo>;
  sortBy: SortColumn | null;
  sortDir: SortDirection;
  onSortChange: (column: SortColumn) => void;
}

export function DepartmentTable({
  rows,
  comparisonMap,
  sortBy,
  sortDir,
  onSortChange,
}: DepartmentTableProps) {
  if (rows.length === 0) {
    // 意図的差分③: bare div → EmptyState 標準 UI（catalog ⑥）
    return (
      <EmptyState
        title="該当する売上明細がありません"
        description="月や部門を変更してお試しください"
      />
    );
  }

  const sortDescriptors = monthlySortDescriptorsForMode("by_department");

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {sortDescriptors.slice(0, 2).map((descriptor) => (
              <SortableHeader
                key={descriptor.value}
                column={descriptor.value}
                label={descriptor.label}
                sortBy={sortBy}
                sortDir={sortDir}
                onClick={onSortChange}
                align={descriptor.align}
              />
            ))}
            <TableHead>構成比</TableHead>
            {sortDescriptors.slice(2).map((descriptor) => (
              <SortableHeader
                key={descriptor.value}
                column={descriptor.value}
                label={descriptor.label}
                sortBy={sortBy}
                sortDir={sortDir}
                onClick={onSortChange}
                align={descriptor.align}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const info = comparisonMap.get(row.key);
            const pct = (row.ratio * 100).toFixed(1);
            return (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right">¥{row.amount.toLocaleString("ja-JP")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <span className="min-w-[3rem] text-xs text-muted-foreground">{pct}%</span>
                    <Progress value={row.ratio * 100} className="flex-1" />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <ComparisonCell info={info} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
