// src/features/monthly-sales/components/DepartmentTable.tsx
//
// 部門別構成比テーブル (4 列: 部門 / 売上 / 構成比 (数値 + Progress バー) / 前月比、
// Q-4 BIZ-05 DTO に商品数 field 不在のため非対応、Plans.md Backlog 参照)。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7

import { EmptyState } from "@/components/patterns/EmptyState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComparisonInfo, DeptCompositionRow, SortColumn, SortDirection } from "../types";
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

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader
              column="name"
              label="部門"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
            />
            <SortableHeader
              column="amount"
              label="売上"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
              align="right"
            />
            <TableHead>構成比</TableHead>
            <SortableHeader
              column="prev_month_diff"
              label="前月比"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
              align="right"
            />
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

interface SortableHeaderProps {
  column: SortColumn;
  label: string;
  sortBy: SortColumn | null;
  sortDir: SortDirection;
  onClick: (column: SortColumn) => void;
  align?: "left" | "right";
}

function SortableHeader({
  column,
  label,
  sortBy,
  sortDir,
  onClick,
  align = "left",
}: SortableHeaderProps) {
  const isActive = sortBy === column;
  const indicator = isActive ? (sortDir === "asc" ? "▲" : "▼") : "";
  const alignClass = align === "right" ? "text-right" : "";
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? sortDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <TableHead className={alignClass} aria-sort={ariaSort}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-mx-3 h-auto gap-1 px-3 py-0 font-medium hover:bg-transparent hover:text-foreground"
        onClick={() => {
          onClick(column);
        }}
      >
        {label} <span aria-hidden="true">{indicator}</span>
      </Button>
    </TableHead>
  );
}
