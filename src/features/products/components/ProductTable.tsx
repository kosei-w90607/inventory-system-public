// src/features/products/components/ProductTable.tsx
//
// UI-01a-D6: 商品コードと商品名を併記し、在庫単位と廃番状態を明示する。

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductWithRelations } from "@/lib/bindings";

export interface ProductTableProps {
  items: ProductWithRelations[];
  returnTo?: string;
}

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

export function ProductTable({ items, returnTo = "/products" }: ProductTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>商品コード</TableHead>
          <TableHead>商品名</TableHead>
          <TableHead>部門</TableHead>
          <TableHead className="text-right">売価</TableHead>
          <TableHead className="text-right">在庫数</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow
            key={item.product_code}
            className={item.is_discontinued ? "text-muted-foreground" : undefined}
          >
            <TableCell className="font-mono text-sm font-medium">{item.product_code}</TableCell>
            <TableCell className="min-w-[14rem] whitespace-normal">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{item.name}</span>
                {item.is_discontinued && <Badge variant="secondary">廃番</Badge>}
              </div>
              {item.jan_code !== null && (
                <div className="text-xs text-muted-foreground">JAN {item.jan_code}</div>
              )}
            </TableCell>
            <TableCell>{item.department_name}</TableCell>
            <TableCell className="text-right tabular-nums">
              {yenFormatter.format(item.selling_price)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.stock_quantity.toLocaleString("ja-JP")} {item.stock_unit}
            </TableCell>
            <TableCell className="text-right">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link
                  to="/products/$code/edit"
                  params={{ code: item.product_code }}
                  search={{ returnTo }}
                >
                  修正
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
