// src/features/daily-sales/components/ProductTable.tsx
//
// shadcn Table 6 列 (商品コード / 商品名 / 部門 / 数量 / 単価 / 金額)。
// 部門小計行 (grey 帯) + 手動バッジ + 単価列 null = 「—」placeholder + 列ソート (5 列対応)。
// 設計: docs/function-design/56-ui-daily-sales.md §56.7

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
import type { DailySaleItem } from "@/lib/bindings";
import { calculateEffectiveUnitPrice } from "../lib/calculate-unit-price";
import type { GroupedSection, SortColumn, SortDirection } from "../types";

export interface ProductTableProps {
  grouped: GroupedSection[];
  sortBy: SortColumn | null;
  sortDir: SortDirection;
  onSortChange: (column: SortColumn) => void;
  /// 全 items の合計 (department_subtotals の総和)。空テーブル時は表示しない。
  grandTotal: { quantity: number; amount: number } | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ProductTable({
  grouped,
  sortBy,
  sortDir,
  onSortChange,
  grandTotal,
  emptyTitle = "該当する売上明細がありません",
  emptyDescription = "日付や部門を変更してお試しください",
}: ProductTableProps) {
  if (grouped.length === 0) {
    // 意図的差分③: bare div → EmptyState 標準 UI（catalog ⑥）
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader
              column="product_code"
              label="商品コード"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
            />
            <SortableHeader
              column="name"
              label="商品名"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
            />
            <TableHead>部門</TableHead>
            <SortableHeader
              column="quantity"
              label="数量"
              sortBy={sortBy}
              sortDir={sortDir}
              onClick={onSortChange}
              align="right"
            />
            <SortableHeader
              column="unit_price"
              label="単価"
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((section) => (
            <SectionRows key={section.departmentId} section={section} />
          ))}
          {grandTotal !== null && (
            <TableRow className="bg-stone-100 font-medium dark:bg-stone-800">
              <TableCell colSpan={3}>合計</TableCell>
              <TableCell className="text-right">
                {grandTotal.quantity.toLocaleString("ja-JP")}
              </TableCell>
              <TableCell />
              <TableCell className="text-right">
                ¥{grandTotal.amount.toLocaleString("ja-JP")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SectionRows({ section }: { section: GroupedSection }) {
  return (
    <>
      <TableRow className="bg-stone-50 font-medium dark:bg-stone-900">
        <TableCell colSpan={3}>{section.departmentName}</TableCell>
        <TableCell className="text-right">
          {section.subtotal.quantity.toLocaleString("ja-JP")}
        </TableCell>
        <TableCell />
        <TableCell className="text-right">
          ¥{section.subtotal.amount.toLocaleString("ja-JP")}
        </TableCell>
      </TableRow>
      {section.items.map((item, idx) => (
        <ItemRow key={`${item.product_code}-${String(idx)}`} item={item} />
      ))}
    </>
  );
}

function ItemRow({ item }: { item: DailySaleItem }) {
  const unitPrice = calculateEffectiveUnitPrice(item);
  return (
    <TableRow>
      <TableCell className="font-mono text-sm font-medium">{item.product_code}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span>{item.name}</span>
          {item.source === "manual" && (
            <Badge variant="secondary" className="bg-warning-soft text-warning-strong">
              手動
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">{item.department_name}</TableCell>
      <TableCell className="text-right">{item.quantity.toLocaleString("ja-JP")}</TableCell>
      <TableCell className="text-right">
        {unitPrice === null ? "—" : `¥${unitPrice.toLocaleString("ja-JP")}`}
      </TableCell>
      <TableCell className="text-right">¥{item.amount.toLocaleString("ja-JP")}</TableCell>
    </TableRow>
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
