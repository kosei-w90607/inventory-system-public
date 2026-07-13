// src/features/stock-movements/components/MovementTable.tsx
//
// REQ-303 / REQ-207: 商品別 movement table。
// 設計: docs/function-design/66-ui-stock-movements.md §66.5

import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MovementRecord } from "@/lib/bindings";
import {
  formatMovementDateTime,
  formatMovementQuantity,
  formatMovementType,
} from "../lib/movement-formatters";

export interface MovementTableProps {
  movements: MovementRecord[];
  returnTo?: string;
}

function QuantityDirectionIcon({ quantity }: { quantity: number }) {
  if (quantity > 0) return <ArrowUp aria-hidden="true" className="text-success" />;
  if (quantity < 0) return <ArrowDown aria-hidden="true" className="text-destructive" />;
  return <ArrowRight aria-hidden="true" className="text-muted-foreground" />;
}

function sourceHref(route: string, returnTo: string | undefined): string {
  if (returnTo === undefined) return route;
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

export function MovementTable({ movements, returnTo }: MovementTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>日時</TableHead>
          <TableHead>種別</TableHead>
          <TableHead>増減</TableHead>
          <TableHead className="text-right">変動後在庫</TableHead>
          <TableHead>元記録</TableHead>
          <TableHead>備考</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {movements.map((movement) => {
          const quantity = formatMovementQuantity(movement.quantity);
          return (
            <TableRow key={movement.id}>
              <TableCell className="font-mono tabular-nums">
                {formatMovementDateTime(movement.created_at)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{formatMovementType(movement.movement_type)}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <QuantityDirectionIcon quantity={movement.quantity} />
                  <span className="font-mono font-medium tabular-nums">{quantity.value}</span>
                  <span className="text-xs text-muted-foreground">{quantity.label}</span>
                </div>
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {movement.stock_after}
              </TableCell>
              <TableCell>
                {movement.source ? (
                  <a
                    className="font-medium text-primary underline-offset-4 hover:underline"
                    href={sourceHref(movement.source.route, returnTo)}
                  >
                    {movement.source.label}
                  </a>
                ) : (
                  <span className="text-muted-foreground">元記録なし</span>
                )}
              </TableCell>
              <TableCell className="max-w-80 truncate">
                {movement.note?.trim() ? movement.note : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
