// src/features/monthly-sales/components/ProductRankingTable.tsx
//
// 商品ランキングテーブル (5 列: 順位 / 商品名 / 数量 / 金額 / 前月比、Q-4 部門列なし)。
// item.ranking === 1 行に黄色バッジ強調 (G-3、sort で順序変わっても追従)。
// 順位列以外の 4 列は SortableHeader (name/quantity/amount/prev_month_diff)。
// 設計: docs/function-design/57-ui-monthly-sales.md §57.7

import { EmptyState } from "@/components/patterns/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComparisonInfo, ProductRankingRow, SortColumn, SortDirection } from "../types";
import { ComparisonCell } from "./comparison-cell";

export interface ProductRankingTableProps {
  rows: readonly ProductRankingRow[];
  comparisonMap: ReadonlyMap<string, ComparisonInfo>;
  sortBy: SortColumn | null;
  sortDir: SortDirection;
  onSortChange: (column: SortColumn) => void;
}

export function ProductRankingTable({
  rows,
  comparisonMap,
  sortBy,
  sortDir,
  onSortChange,
}: ProductRankingTableProps) {
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
            <TableHead className="w-16">順位</TableHead>
            <SortableHeader
              column="name"
              label="商品名"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
            />
            <SortableHeader
              column="quantity"
              label="数量"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
              align="right"
            />
            <SortableHeader
              column="amount"
              label="金額"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
              align="right"
            />
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
            const isTop = row.ranking === 1;
            return (
              <TableRow key={row.key} className={isTop ? "bg-rank-top-bg/40" : undefined}>
                <TableCell>
                  {isTop ? (
                    <Badge className="bg-rank-top-badge-bg text-rank-top-badge-text hover:bg-rank-top-badge-bg">
                      {`${String(row.ranking)} 位`}
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">{`${String(row.ranking)} 位`}</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right">
                  {`${row.quantity.toLocaleString("ja-JP")} 点`}
                </TableCell>
                <TableCell className="text-right">¥{row.amount.toLocaleString("ja-JP")}</TableCell>
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
